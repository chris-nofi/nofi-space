// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {WaterProofRegistry} from "../src/WaterProofRegistry.sol";

/// @notice Deploys WaterProofRegistry and registers the three Moquegua demo farms.
/// @dev    No private key lives in this file or in env vars. Sign with an encrypted Foundry
///         keystore (`cast wallet import ceres-deployer --interactive`) or a hardware wallet:
///
///   ORACLE_ADDRESS=0x...  forge script script/DeployFuji.s.sol:DeployFuji \
///       --rpc-url fuji --account ceres-deployer --sender 0xYourDeployer --broadcast --verify
///
///   Dry run first (no --broadcast) to simulate against Fuji state.
///   Optional env: STEWARD_CARUMAS, STEWARD_SAMEGUA, STEWARD_ALGARROBAL (default: none → no credits).
contract DeployFuji is Script {
    function run() external returns (WaterProofRegistry reg) {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address sCarumas = vm.envOr("STEWARD_CARUMAS", address(0));
        address sSamegua = vm.envOr("STEWARD_SAMEGUA", address(0));
        address sAlgarrobal = vm.envOr("STEWARD_ALGARROBAL", address(0));

        if (block.chainid != 43113 && block.chainid != 31337 && block.chainid != 880024) {
            revert("Unexpected chain: use Fuji (43113), local anvil (31337) or NOFI testnet (880024)");
        }

        vm.startBroadcast();
        reg = new WaterProofRegistry(oracle);
        reg.registerFarm(keccak256("moquegua:carumas"), sCarumas, unicode"Carumas · papa (secano) · 3,000 m");
        reg.registerFarm(keccak256("moquegua:samegua"), sSamegua, unicode"Samegua · alfalfa (Pasto Grande) · 1,550 m");
        reg.registerFarm(
            keccak256("moquegua:algarrobal"), sAlgarrobal, unicode"El Algarrobal · olivo (riego) · 150 m"
        );
        vm.stopBroadcast();

        console2.log("WaterProofRegistry:", address(reg));
        console2.log("chainId:", block.chainid);
        console2.log("oracle:", oracle);
        if (block.chainid == 43113) {
            console2.log("Snowtrace:");
            console2.log(string.concat("https://testnet.snowtrace.io/address/", vm.toString(address(reg))));
        }
    }
}
