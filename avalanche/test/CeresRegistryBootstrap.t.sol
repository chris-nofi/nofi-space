// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WaterProofRegistry} from "../src/WaterProofRegistry.sol";
import {CeresRegistryBootstrap} from "../src/CeresRegistryBootstrap.sol";

contract CeresRegistryBootstrapTest is Test {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address chris = makeAddr("chris");

    function _viaFactory(address oracle, address owner_, bytes32 salt) internal returns (CeresRegistryBootstrap b) {
        bytes memory initcode = abi.encodePacked(type(CeresRegistryBootstrap).creationCode, abi.encode(oracle, owner_));
        vm.prank(chris);
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initcode));
        assertTrue(ok, "create2 deploy failed");
        b = CeresRegistryBootstrap(address(bytes20(ret)));
        assertEq(address(b), vm.computeCreate2Address(salt, keccak256(initcode), CREATE2_DEPLOYER));
    }

    function test_bootstrapViaCreate2_givesChrisOwnershipAndFarms() public {
        vm.etch(CREATE2_DEPLOYER, hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3");
        CeresRegistryBootstrap b = _viaFactory(chris, chris, bytes32("ceres-fuji-v1"));
        WaterProofRegistry reg = b.registry();
        assertEq(reg.owner(), chris);
        assertTrue(reg.isOracle(chris));
        assertEq(reg.farmCount(), 3);
        (bool registered,,) = reg.farms(keccak256("moquegua:algarrobal"));
        assertTrue(registered);
        // the registry's CREATE address is nonce 1 of the bootstrap contract
        assertEq(address(reg), vm.computeCreateAddress(address(b), 1));
        // the bootstrap keeps no power
        vm.prank(address(b));
        vm.expectRevert(WaterProofRegistry.NotOwner.selector);
        reg.registerFarm(keccak256("x"), address(0), "x");
        // Chris (owner) can still administer
        vm.prank(chris);
        reg.registerFarm(keccak256("moquegua:new"), address(0), "new");
        assertEq(reg.farmCount(), 4);
    }

    function test_zeroOwnerReverts() public {
        vm.expectRevert(WaterProofRegistry.ZeroAddress.selector);
        new CeresRegistryBootstrap(chris, address(0));
    }
}
