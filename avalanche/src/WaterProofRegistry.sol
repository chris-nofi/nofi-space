// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  WaterProofRegistry — "Registro verificable" de agua para Ceres Ventures
/// @notice Stores one tamper-evident record per farm per month: NASA-derived water
///         indicators (ET, ET0, precipitation, NDVI), the engine's recommended strategy,
///         and a hash of the full off-chain evidence bundle (JSON with dataset IDs,
///         granule IDs, dates and script version). Anyone can later check that the
///         evidence a farmer, cooperative or buyer is shown is exactly what was recorded.
/// @dev    Self-contained (no external imports) so it compiles anywhere. Records are written
///         either directly by an authorized oracle address, or by anyone (e.g. the farmer's
///         Core Wallet) carrying an EIP-712 signature from an authorized oracle signer.
///         Optional "water-saving credits" are non-transferable counters, not tokens.
contract WaterProofRegistry {
    // ───────────────────────────── Types ─────────────────────────────

    /// @notice Fixed-point conventions: all *X10 values are tenths (mm*10, % *10);
    ///         ndviX1000 is NDVI*1000 (range -1000..1000).
    struct Attestation {
        bytes32 farmId; // keccak256("moquegua:carumas") etc.
        uint32 period; // YYYYMM, e.g. 202610
        uint32 revision; // 0 for first record of (farm, period); +1 for each correction
        int32 etMmX10; // actual evapotranspiration for the month (ECOSTRESS L3T JET / OpenET-style alt), mm*10
        int32 et0MmX10; // reference ET0 (FAO-56 from NASA POWER), mm*10
        int32 precipMmX10; // precipitation (GPM IMERG; POWER PRECTOTCORR fallback), mm*10
        int16 ndviX1000; // monthly median NDVI (HLS L30/S30; MODIS fallback)
        uint8 strategyId; // engine's top-ranked strategy index for this farm
        uint32 waterSavedM3; // engine estimate of water saved vs. current practice this month, m3 (0 if none)
        bytes32 dataHash; // sha256/keccak of canonical evidence JSON (inputs + outputs + versions)
        bytes32 sourcesHash; // hash of sorted list of dataset short-names + granule IDs used
        string uri; // where the evidence JSON lives (https / ipfs)
    }

    struct Record {
        Attestation a;
        address oracle; // oracle that vouched for the data
        address submitter; // tx sender (oracle itself, farmer wallet, relayer)
        uint64 timestamp;
        address creditedTo; // steward credited for this record (0 if none)
        uint256 credited; // credits issued for this record
    }

    struct Farm {
        bool registered;
        address steward; // farmer or cooperative wallet that receives credits (may be 0)
        string label; // public, non-personal label e.g. "Carumas · papa (secano)"
    }

    // ───────────────────────────── Storage ─────────────────────────────

    address public owner;
    mapping(address => bool) public isOracle;
    mapping(bytes32 => Farm) public farms;
    bytes32[] public farmIds;

    /// @dev key = keccak256(farmId, period) → latest record
    mapping(bytes32 => Record) private _latest;
    /// @dev key = keccak256(farmId, period) → number of records written (latest revision + 1)
    mapping(bytes32 => uint32) public revisionCount;

    /// @notice Non-transferable water-saving credits (1 credit = 1 m3 verified saved). Not an ERC-20.
    mapping(address => uint256) public creditsOf;
    /// @notice Minimum NDVI for credits: drying out / abandoning a crop must never earn credits.
    int16 public minNdviForCredit = 200; // NDVI 0.20

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(bytes32 farmId,uint32 period,uint32 revision,int32 etMmX10,int32 et0MmX10,int32 precipMmX10,int16 ndviX1000,uint8 strategyId,uint32 waterSavedM3,bytes32 dataHash,bytes32 sourcesHash,string uri)"
    );

    // ───────────────────────────── Events ─────────────────────────────

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleSet(address indexed oracle, bool allowed);
    event FarmRegistered(bytes32 indexed farmId, address indexed steward, string label);
    event StewardChanged(bytes32 indexed farmId, address indexed steward);
    event MinNdviSet(int16 minNdviX1000);
    event Attested(
        bytes32 indexed farmId,
        uint32 indexed period,
        uint32 revision,
        bytes32 dataHash,
        uint8 strategyId,
        address indexed oracle,
        address submitter,
        bytes32 previousDataHash
    );
    event CreditIssued(bytes32 indexed farmId, uint32 indexed period, address indexed steward, uint256 amount);
    event CreditReversed(bytes32 indexed farmId, uint32 indexed period, address indexed steward, uint256 amount);

    // ───────────────────────────── Errors ─────────────────────────────

    error NotOwner();
    error NotOracle();
    error UnknownFarm(bytes32 farmId);
    error FarmExists(bytes32 farmId);
    error BadPeriod(uint32 period);
    error BadRevision(uint32 expected, uint32 got);
    error BadNdvi(int16 ndviX1000);
    error EmptyDataHash();
    error BadSignature();
    error ZeroAddress();

    // ───────────────────────────── Modifiers ─────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOracle) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        if (initialOracle != address(0)) {
            isOracle[initialOracle] = true;
            emit OracleSet(initialOracle, true);
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("WaterProofRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ───────────────────────────── Admin ─────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOracle(address oracle, bool allowed) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        isOracle[oracle] = allowed;
        emit OracleSet(oracle, allowed);
    }

    function setMinNdviForCredit(int16 minNdviX1000) external onlyOwner {
        if (minNdviX1000 < -1000 || minNdviX1000 > 1000) revert BadNdvi(minNdviX1000);
        minNdviForCredit = minNdviX1000;
        emit MinNdviSet(minNdviX1000);
    }

    function registerFarm(bytes32 farmId, address steward, string calldata label) external onlyOwner {
        if (farms[farmId].registered) revert FarmExists(farmId);
        farms[farmId] = Farm({registered: true, steward: steward, label: label});
        farmIds.push(farmId);
        emit FarmRegistered(farmId, steward, label);
    }

    function setSteward(bytes32 farmId, address steward) external onlyOwner {
        if (!farms[farmId].registered) revert UnknownFarm(farmId);
        farms[farmId].steward = steward;
        emit StewardChanged(farmId, steward);
    }

    // ───────────────────────────── Write paths ─────────────────────────────

    /// @notice Oracle writes directly.
    function attest(Attestation calldata a) external {
        if (!isOracle[msg.sender]) revert NotOracle();
        _record(a, msg.sender);
    }

    /// @notice Anyone (farmer's Core Wallet, cooperative, relayer) submits a record signed by an oracle.
    /// @dev    Replay-safe: the signed struct includes `revision`, which must equal the next free slot,
    ///         and the domain separator pins chainId + this contract address.
    function attestWithSig(Attestation calldata a, bytes calldata signature) external {
        address signer = _recover(hashAttestation(a), signature);
        if (!isOracle[signer]) revert BadSignature();
        _record(a, signer);
    }

    // ───────────────────────────── Views ─────────────────────────────

    /// @notice EIP-712 digest the oracle signs off-chain.
    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                a.farmId,
                a.period,
                a.revision,
                a.etMmX10,
                a.et0MmX10,
                a.precipMmX10,
                a.ndviX1000,
                a.strategyId,
                a.waterSavedM3,
                a.dataHash,
                a.sourcesHash,
                keccak256(bytes(a.uri))
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function latest(bytes32 farmId, uint32 period) external view returns (Record memory) {
        return _latest[_key(farmId, period)];
    }

    /// @notice The "¿es auténtico?" check: does this evidence hash match the latest record?
    function verify(bytes32 farmId, uint32 period, bytes32 dataHash) external view returns (bool) {
        Record storage r = _latest[_key(farmId, period)];
        return r.timestamp != 0 && r.a.dataHash == dataHash;
    }

    function farmCount() external view returns (uint256) {
        return farmIds.length;
    }

    // ───────────────────────────── Internals ─────────────────────────────

    function _record(Attestation calldata a, address oracle) internal {
        Farm storage f = farms[a.farmId];
        if (!f.registered) revert UnknownFarm(a.farmId);
        uint32 month = a.period % 100;
        if (a.period < 198101 || a.period > 210012 || month == 0 || month > 12) revert BadPeriod(a.period);
        if (a.ndviX1000 < -1000 || a.ndviX1000 > 1000) revert BadNdvi(a.ndviX1000);
        if (a.dataHash == bytes32(0)) revert EmptyDataHash();

        bytes32 k = _key(a.farmId, a.period);
        uint32 expected = revisionCount[k];
        if (a.revision != expected) revert BadRevision(expected, a.revision);

        Record storage r = _latest[k];
        bytes32 prevHash = r.a.dataHash;

        // Reverse credits from the superseded record (corrections must not double-count).
        if (r.credited > 0) {
            creditsOf[r.creditedTo] -= r.credited;
            emit CreditReversed(a.farmId, a.period, r.creditedTo, r.credited);
        }

        r.a = a;
        r.oracle = oracle;
        r.submitter = msg.sender;
        // forge-lint: disable-next-line(unsafe-typecast)
        r.timestamp = uint64(block.timestamp); // safe until year 584,942,417,355
        revisionCount[k] = expected + 1;

        emit Attested(a.farmId, a.period, a.revision, a.dataHash, a.strategyId, oracle, msg.sender, prevHash);

        uint256 credit = _creditFor(a);
        if (credit > 0 && f.steward != address(0)) {
            creditsOf[f.steward] += credit;
            r.creditedTo = f.steward;
            r.credited = credit;
            emit CreditIssued(a.farmId, a.period, f.steward, credit);
        } else {
            r.creditedTo = address(0);
            r.credited = 0;
        }
    }

    function _creditFor(Attestation memory a) internal view returns (uint256) {
        if (a.waterSavedM3 == 0 || a.ndviX1000 < minNdviForCredit) return 0;
        return a.waterSavedM3;
    }

    function _key(bytes32 farmId, uint32 period) internal pure returns (bytes32) {
        return keccak256(abi.encode(farmId, period));
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        // reject malleable high-s signatures (EIP-2)
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert BadSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
