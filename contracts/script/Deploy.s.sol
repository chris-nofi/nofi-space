// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PlotRegistry} from "../src/PlotRegistry.sol";
import {WaterEscrow, IERC20Min, IPlotRegistry} from "../src/WaterEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// forge script script/Deploy.s.sol --rpc-url $NOCHAIN_RPC_URL --broadcast
/// env: DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, optional USDC_ADDRESS (else deploys MockUSDC)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address usdc = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(pk);
        if (usdc == address(0)) usdc = address(new MockUSDC());
        PlotRegistry registry = new PlotRegistry();
        WaterEscrow escrow = new WaterEscrow(IERC20Min(usdc), IPlotRegistry(address(registry)), oracle);
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("USDC", usdc);
        console2.log("PlotRegistry", address(registry));
        console2.log("WaterEscrow", address(escrow));

        string memory obj = "deploy";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "usdc", usdc);
        vm.serializeAddress(obj, "plotRegistry", address(registry));
        string memory json = vm.serializeAddress(obj, "waterEscrow", address(escrow));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
