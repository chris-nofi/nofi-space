// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlotRegistry} from "../src/PlotRegistry.sol";
import {WaterEscrow, IERC20Min, IPlotRegistry} from "../src/WaterEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract WaterEscrowTest is Test {
    PlotRegistry registry;
    WaterEscrow escrow;
    MockUSDC usdc;

    uint256 oracleKey = 0xA11CE;
    address oracle;
    address farmer = address(0xF4);
    address funder = address(0xFD);

    bytes32 plot = keccak256("samegua-demo-plot");
    uint32 season = 2027;

    function setUp() public {
        oracle = vm.addr(oracleKey);
        registry = new PlotRegistry();
        usdc = new MockUSDC();
        escrow = new WaterEscrow(IERC20Min(address(usdc)), IPlotRegistry(address(registry)), oracle);

        vm.prank(farmer);
        registry.register(plot, 120, keccak256("Osmore-Moquegua"));

        usdc.mint(funder, 1_000e6);
        vm.prank(funder);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _att(uint8 rule, uint64 value, bool alive) internal view returns (WaterEscrow.Attestation memory) {
        return WaterEscrow.Attestation(plot, season, rule, value, alive, keccak256("evidence-pack"));
    }

    function _sign(WaterEscrow.Attestation memory a, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, escrow.hashAttestation(a));
        return abi.encodePacked(r, s, v);
    }

    function _openPerM3() internal {
        // 0.015 USDC per m³ = 15000 base units; max 103.50 USDC (5,750 m³/ha × 1.2 ha)
        vm.prank(funder);
        escrow.openOffer(plot, season, 0, 15_000, 103_500_000);
        vm.prank(farmer);
        escrow.accept(plot, season);
    }

    function test_perM3_pays_farmer_and_refunds_funder() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 6420, true); // (17250-11900) × 1.2 = 6,420 m³
        uint256 paid = escrow.settle(a, _sign(a, oracleKey));
        assertEq(paid, 96_300_000); // 96.30 USDC
        assertEq(usdc.balanceOf(farmer), 96_300_000);
        assertEq(usdc.balanceOf(funder), 1_000e6 - 96_300_000);
    }

    function test_payout_capped_at_max() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 50_000, true);
        assertEq(escrow.settle(a, _sign(a, oracleKey)), 103_500_000);
    }

    function test_dead_crop_pays_nothing() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 6420, false);
        assertEq(escrow.settle(a, _sign(a, oracleKey)), 0);
        assertEq(usdc.balanceOf(farmer), 0);
        assertEq(usdc.balanceOf(funder), 1_000e6);
    }

    function test_practice_rule() public {
        vm.prank(funder);
        escrow.openOffer(plot, season, 1, 0, 70e6);
        vm.prank(farmer);
        escrow.accept(plot, season);
        WaterEscrow.Attestation memory a = _att(1, 9000, true); // 90 %
        assertEq(escrow.settle(a, _sign(a, oracleKey)), 63e6);
    }

    function test_rejects_wrong_signer() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 6420, true);
        bytes memory sig = _sign(a, 0xBAD);
        vm.expectRevert(WaterEscrow.BadSignature.selector);
        escrow.settle(a, sig);
    }

    function test_rejects_double_settle() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 6420, true);
        bytes memory sig = _sign(a, oracleKey);
        escrow.settle(a, sig);
        vm.expectRevert(WaterEscrow.AlreadySettled.selector);
        escrow.settle(a, sig);
    }

    function test_requires_farmer_acceptance() public {
        vm.prank(funder);
        escrow.openOffer(plot, season, 0, 15_000, 103_500_000);
        WaterEscrow.Attestation memory a = _att(0, 6420, true);
        bytes memory sig = _sign(a, oracleKey);
        vm.expectRevert(WaterEscrow.NotAccepted.selector);
        escrow.settle(a, sig);
    }

    function test_only_plot_owner_accepts() public {
        vm.prank(funder);
        escrow.openOffer(plot, season, 0, 15_000, 103_500_000);
        vm.expectRevert(WaterEscrow.NotFarmer.selector);
        escrow.accept(plot, season);
    }

    function test_funder_can_cancel_before_acceptance() public {
        vm.startPrank(funder);
        escrow.openOffer(plot, season, 0, 15_000, 103_500_000);
        escrow.cancelOffer(plot, season);
        vm.stopPrank();
        assertEq(usdc.balanceOf(funder), 1_000e6);
    }

    /// Cross-language vector: signature produced by oracle/earth_oracle/sign.py for the
    /// same domain (chainId 31337, this escrow address) and attestation. See docs/03_CONTRACTS.md.
    function test_python_signature_vector() public {
        _openPerM3();
        WaterEscrow.Attestation memory a = _att(0, 6420, true);
        bytes memory pySig = vm.envOr("PY_SIG", bytes(""));
        if (pySig.length == 0) return; // optional: export PY_SIG=<signature from sign.py for this escrow address>
        assertEq(escrow.settle(a, pySig), 96_300_000);
    }
}
