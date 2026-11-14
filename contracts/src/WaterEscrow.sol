// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPlotRegistry {
    function ownerOf(bytes32 plotHash) external view returns (address);
}

/// @title WaterEscrow
/// @notice A funder (e.g. a MERESE water fund) locks USDC for one plot and season.
///         The farmer accepts. The Earth oracle signs an EIP-712 attestation built from
///         NASA data. Anyone can submit it; the contract pays the farmer and refunds the rest.
/// @dev    Anti-gaming: if cropAlive is false the payout is zero (water "saved" by abandoning
///         or drying the field never pays). Types must match oracle/earth_oracle/sign.py.
contract WaterEscrow {
    uint8 public constant RULE_PER_M3 = 0;       // value = m³ saved (whole plot); payout = value × rate
    uint8 public constant RULE_PER_PRACTICE = 1; // value = complianceBps; payout = maxPayout × value / 10000

    struct Attestation {
        bytes32 plotId;
        uint32 season;
        uint8 rule;
        uint64 value;
        bool cropAlive;
        bytes32 evidenceHash;
    }

    struct Offer {
        address funder;
        uint8 rule;
        uint256 rate;      // USDC base units per m³ (rule 0); unused for rule 1
        uint256 maxPayout; // USDC base units locked
        bool accepted;
        bool settled;
    }

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(bytes32 plotId,uint32 season,uint8 rule,uint64 value,bool cropAlive,bytes32 evidenceHash)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("AguaClara");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    IERC20Min public immutable usdc;
    IPlotRegistry public immutable registry;
    address public oracle;
    address public admin;

    mapping(bytes32 => Offer) public offers; // key(plotId, season)

    event OfferOpened(bytes32 indexed plotId, uint32 indexed season, address indexed funder, uint8 rule, uint256 rate, uint256 maxPayout);
    event OfferCancelled(bytes32 indexed plotId, uint32 indexed season);
    event OfferAccepted(bytes32 indexed plotId, uint32 indexed season, address indexed farmer);
    event Settled(bytes32 indexed plotId, uint32 indexed season, address indexed farmer, uint256 payout, uint256 refund, bool cropAlive, uint64 value, bytes32 evidenceHash);
    event OracleChanged(address oracle);

    error NotAdmin();
    error UnknownPlot();
    error OfferExists();
    error NoOffer();
    error NotFunder();
    error NotFarmer();
    error NotAccepted();
    error AlreadyAccepted();
    error AlreadySettled();
    error RuleMismatch();
    error BadRule();
    error BadSignature();
    error TransferFailed();

    constructor(IERC20Min usdc_, IPlotRegistry registry_, address oracle_) {
        usdc = usdc_;
        registry = registry_;
        oracle = oracle_;
        admin = msg.sender;
    }

    // ---------------- offers ----------------

    function key(bytes32 plotId, uint32 season) public pure returns (bytes32) {
        return keccak256(abi.encode(plotId, season));
    }

    function openOffer(bytes32 plotId, uint32 season, uint8 rule, uint256 rate, uint256 maxPayout) external {
        if (registry.ownerOf(plotId) == address(0)) revert UnknownPlot();
        if (rule > RULE_PER_PRACTICE) revert BadRule();
        bytes32 k = key(plotId, season);
        if (offers[k].funder != address(0)) revert OfferExists();
        offers[k] = Offer(msg.sender, rule, rate, maxPayout, false, false);
        if (!usdc.transferFrom(msg.sender, address(this), maxPayout)) revert TransferFailed();
        emit OfferOpened(plotId, season, msg.sender, rule, rate, maxPayout);
    }

    function cancelOffer(bytes32 plotId, uint32 season) external {
        bytes32 k = key(plotId, season);
        Offer memory o = offers[k];
        if (o.funder == address(0)) revert NoOffer();
        if (o.funder != msg.sender) revert NotFunder();
        if (o.accepted) revert AlreadyAccepted();
        delete offers[k];
        if (!usdc.transfer(o.funder, o.maxPayout)) revert TransferFailed();
        emit OfferCancelled(plotId, season);
    }

    /// @dev TODO(T3.4): add acceptWithSig for sponsored gas.
    function accept(bytes32 plotId, uint32 season) external {
        Offer storage o = offers[key(plotId, season)];
        if (o.funder == address(0)) revert NoOffer();
        if (registry.ownerOf(plotId) != msg.sender) revert NotFarmer();
        if (o.accepted) revert AlreadyAccepted();
        o.accepted = true;
        emit OfferAccepted(plotId, season, msg.sender);
    }

    // ---------------- EIP-712 ----------------

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(ATTESTATION_TYPEHASH, a.plotId, a.season, a.rule, a.value, a.cropAlive, a.evidenceHash)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) revert BadSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }

    // ---------------- settle ----------------

    function quote(bytes32 plotId, uint32 season, uint8 rule, uint64 value, bool cropAlive) public view returns (uint256 payout) {
        Offer memory o = offers[key(plotId, season)];
        if (!cropAlive) return 0;
        if (rule == RULE_PER_M3) payout = uint256(value) * o.rate;
        else payout = (o.maxPayout * (value > 10_000 ? 10_000 : value)) / 10_000;
        if (payout > o.maxPayout) payout = o.maxPayout;
    }

    function settle(Attestation calldata a, bytes calldata sig) external returns (uint256 payout) {
        bytes32 k = key(a.plotId, a.season);
        Offer storage o = offers[k];
        if (o.funder == address(0)) revert NoOffer();
        if (!o.accepted) revert NotAccepted();
        if (o.settled) revert AlreadySettled();
        if (a.rule != o.rule) revert RuleMismatch();
        if (_recover(hashAttestation(a), sig) != oracle) revert BadSignature();

        o.settled = true;
        address farmer = registry.ownerOf(a.plotId);
        payout = quote(a.plotId, a.season, a.rule, a.value, a.cropAlive);
        uint256 refund = o.maxPayout - payout;
        if (payout > 0 && !usdc.transfer(farmer, payout)) revert TransferFailed();
        if (refund > 0 && !usdc.transfer(o.funder, refund)) revert TransferFailed();
        emit Settled(a.plotId, a.season, farmer, payout, refund, a.cropAlive, a.value, a.evidenceHash);
    }

    // ---------------- admin ----------------

    function setOracle(address oracle_) external {
        if (msg.sender != admin) revert NotAdmin();
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }
}
