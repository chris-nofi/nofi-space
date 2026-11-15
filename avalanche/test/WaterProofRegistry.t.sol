// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WaterProofRegistry} from "../src/WaterProofRegistry.sol";

/// Keys below are ephemeral test keys derived inside the Foundry VM. They are never real wallets.
contract WaterProofRegistryTest is Test {
    WaterProofRegistry reg;
    address oracle;
    uint256 oracleKey;
    address farmer = makeAddr("farmer-carumas");
    address coop = makeAddr("coop-samegua");
    address stranger = makeAddr("stranger");

    bytes32 constant CARUMAS = keccak256("moquegua:carumas");
    bytes32 constant SAMEGUA = keccak256("moquegua:samegua");

    function setUp() public {
        (oracle, oracleKey) = makeAddrAndKey("ceres-earth-oracle");
        reg = new WaterProofRegistry(oracle);
        reg.registerFarm(CARUMAS, farmer, unicode"Carumas · papa (secano)");
        reg.registerFarm(SAMEGUA, coop, unicode"Samegua · alfalfa (riego)");
    }

    function _att(bytes32 farm, uint32 period, uint32 revision, uint32 saved, int16 ndvi)
        internal
        pure
        returns (WaterProofRegistry.Attestation memory a)
    {
        a.farmId = farm;
        a.period = period;
        a.revision = revision;
        a.etMmX10 = 812;
        a.et0MmX10 = 1405;
        a.precipMmX10 = 233;
        a.ndviX1000 = ndvi;
        a.strategyId = 2;
        a.waterSavedM3 = saved;
        a.dataHash = keccak256(abi.encode("evidence", farm, period, revision));
        a.sourcesHash = keccak256("POWER_AG_daily|GPM_3IMERGDF_v07|HLS_S30_v2.0|ECOSTRESS_L3T_JET_v002");
        a.uri = "https://ceres.example/evidence/carumas/202610.json";
    }

    function _sign(WaterProofRegistry.Attestation memory a, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, reg.hashAttestation(a));
        return abi.encodePacked(r, s, v);
    }

    // ── access control ──

    function test_OracleCanAttest() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        vm.prank(oracle);
        reg.attest(a);
        WaterProofRegistry.Record memory r = reg.latest(CARUMAS, 202610);
        assertEq(r.a.dataHash, a.dataHash);
        assertEq(r.oracle, oracle);
        assertEq(r.submitter, oracle);
        assertEq(reg.revisionCount(keccak256(abi.encode(CARUMAS, uint32(202610)))), 1);
        assertTrue(reg.verify(CARUMAS, 202610, a.dataHash));
        assertFalse(reg.verify(CARUMAS, 202610, bytes32(uint256(1))));
        assertFalse(reg.verify(CARUMAS, 202609, a.dataHash));
    }

    function test_RevertWhen_StrangerAttests() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        vm.prank(stranger);
        vm.expectRevert(WaterProofRegistry.NotOracle.selector);
        reg.attest(a);
    }

    function test_RevertWhen_NonOwnerAdmin() public {
        vm.startPrank(stranger);
        vm.expectRevert(WaterProofRegistry.NotOwner.selector);
        reg.setOracle(stranger, true);
        vm.expectRevert(WaterProofRegistry.NotOwner.selector);
        reg.registerFarm(keccak256("x"), stranger, "x");
        vm.stopPrank();
    }

    function test_RevokedOracleCannotAttest() public {
        reg.setOracle(oracle, false);
        vm.prank(oracle);
        vm.expectRevert(WaterProofRegistry.NotOracle.selector);
        reg.attest(_att(CARUMAS, 202610, 0, 0, 600));
    }

    // ── signature path (farmer's Core Wallet submits, oracle signed) ──

    function test_FarmerSubmitsOracleSignedRecord() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        bytes memory sig = _sign(a, oracleKey);
        vm.prank(farmer);
        reg.attestWithSig(a, sig);
        WaterProofRegistry.Record memory r = reg.latest(CARUMAS, 202610);
        assertEq(r.oracle, oracle);
        assertEq(r.submitter, farmer);
    }

    function test_RevertWhen_SignatureFromNonOracle() public {
        (, uint256 badKey) = makeAddrAndKey("impostor");
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        bytes memory sig = _sign(a, badKey);
        vm.expectRevert(WaterProofRegistry.BadSignature.selector);
        reg.attestWithSig(a, sig);
    }

    function test_RevertWhen_TamperedAfterSigning() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        bytes memory sig = _sign(a, oracleKey);
        a.waterSavedM3 = 999_999; // farmer tries to inflate savings
        vm.expectRevert(WaterProofRegistry.BadSignature.selector);
        reg.attestWithSig(a, sig);
    }

    function test_RevertWhen_SignatureReplayed() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        bytes memory sig = _sign(a, oracleKey);
        reg.attestWithSig(a, sig);
        vm.expectRevert(abi.encodeWithSelector(WaterProofRegistry.BadRevision.selector, uint32(1), uint32(0)));
        reg.attestWithSig(a, sig);
    }

    // ── validation ──

    function test_RevertWhen_UnknownFarm() public {
        WaterProofRegistry.Attestation memory a = _att(keccak256("nope"), 202610, 0, 0, 600);
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(WaterProofRegistry.UnknownFarm.selector, keccak256("nope")));
        reg.attest(a);
    }

    function test_RevertWhen_BadPeriod() public {
        vm.startPrank(oracle);
        vm.expectRevert(abi.encodeWithSelector(WaterProofRegistry.BadPeriod.selector, uint32(202613)));
        reg.attest(_att(CARUMAS, 202613, 0, 0, 600));
        vm.expectRevert(abi.encodeWithSelector(WaterProofRegistry.BadPeriod.selector, uint32(202600)));
        reg.attest(_att(CARUMAS, 202600, 0, 0, 600));
        vm.stopPrank();
    }

    function test_RevertWhen_EmptyHashOrBadNdvi() public {
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, 202610, 0, 0, 600);
        a.dataHash = bytes32(0);
        vm.startPrank(oracle);
        vm.expectRevert(WaterProofRegistry.EmptyDataHash.selector);
        reg.attest(a);
        a = _att(CARUMAS, 202610, 0, 0, 1001);
        vm.expectRevert(abi.encodeWithSelector(WaterProofRegistry.BadNdvi.selector, int16(1001)));
        reg.attest(a);
        vm.stopPrank();
    }

    // ── corrections + credits ──

    function test_CreditIssuedOnlyWhenCropAlive() public {
        vm.startPrank(oracle);
        reg.attest(_att(SAMEGUA, 202610, 0, 1_200, 650)); // alive, saved 1,200 m3
        reg.attest(_att(SAMEGUA, 202611, 0, 1_500, 120)); // NDVI 0.12: dried out → no credit
        vm.stopPrank();
        assertEq(reg.creditsOf(coop), 1_200);
    }

    function test_CorrectionReplacesRecordAndCredits() public {
        vm.startPrank(oracle);
        WaterProofRegistry.Attestation memory first = _att(SAMEGUA, 202610, 0, 1_200, 650);
        reg.attest(first);
        WaterProofRegistry.Attestation memory fix = _att(SAMEGUA, 202610, 1, 900, 650);
        reg.attest(fix);
        vm.stopPrank();
        assertEq(reg.creditsOf(coop), 900);
        assertTrue(reg.verify(SAMEGUA, 202610, fix.dataHash));
        assertFalse(reg.verify(SAMEGUA, 202610, first.dataHash));
        assertEq(reg.latest(SAMEGUA, 202610).a.revision, 1);
    }

    function test_CorrectionAfterStewardChangeReversesOriginalSteward() public {
        vm.prank(oracle);
        reg.attest(_att(SAMEGUA, 202610, 0, 1_200, 650));
        reg.setSteward(SAMEGUA, farmer);
        vm.prank(oracle);
        reg.attest(_att(SAMEGUA, 202610, 1, 800, 650));
        assertEq(reg.creditsOf(coop), 0);
        assertEq(reg.creditsOf(farmer), 800);
    }

    function test_NoStewardNoCredit() public {
        bytes32 ilo = keccak256("moquegua:algarrobal");
        reg.registerFarm(ilo, address(0), unicode"El Algarrobal · olivo (riego)");
        vm.prank(oracle);
        reg.attest(_att(ilo, 202610, 0, 700, 500));
        assertEq(reg.latest(ilo, 202610).credited, 0);
    }

    function testFuzz_SignedRecordRoundTrip(uint32 saved, int16 ndvi, uint8 month) public {
        ndvi = int16(bound(int256(ndvi), -1000, 1000));
        uint32 period = 202500 + uint32(bound(uint256(month), 1, 12));
        WaterProofRegistry.Attestation memory a = _att(CARUMAS, period, 0, saved, ndvi);
        reg.attestWithSig(a, _sign(a, oracleKey));
        assertTrue(reg.verify(CARUMAS, period, a.dataHash));
        uint256 expected = (saved > 0 && ndvi >= reg.minNdviForCredit()) ? saved : 0;
        assertEq(reg.creditsOf(farmer), expected);
    }
}
