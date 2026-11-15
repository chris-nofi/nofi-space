// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {WaterProofRegistry} from "../src/WaterProofRegistry.sol";
import {X402TestUSDC} from "../src/X402TestUSDC.sol";

/// @notice Deploys the Ceres Ventures Avalanche layer and registers the three Moquegua demo farms.
///         DEMO TARGET (locked 14 Nov 2026): Avalanche Fuji C-Chain (43113), WaterProofRegistry ONLY.
///         x402 pays in Circle's Fuji USDC (EIP-3009), so X402TestUSDC is NOT deployed by default.
///         The same script runs unchanged on the NØFI L1 (880024) later, with DEPLOY_X402_TOKEN=true there,
///         and on local anvil (31337) for rehearsal.
/// @dev    No private keys in files or env. Sign with an encrypted Foundry keystore or a hardware wallet:
///
///   ORACLE_ADDRESS=0x... forge script script/DeployNofi.s.sol:DeployNofi --rpc-url fuji \
///       --account ceres-deployer --sender 0xDEPLOYER                     # simulate first (no --broadcast)
///   ... then add --broadcast --verify                                     # Snowtrace via Routescan (foundry.toml)
///
///   Fuji gas is AVAX. The deployer needs a little Fuji AVAX (faucet: build.avax.network/console/primary-network/faucet).
///   Farm ids are keccak256 of the evidence farmKey: "moquegua:carumas", "moquegua:samegua", "moquegua:algarrobal".
contract DeployNofi is Script {
    function run() external returns (WaterProofRegistry reg, X402TestUSDC usd) {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        bool deployToken = vm.envOr("DEPLOY_X402_TOKEN", false); // Fuji demo uses Circle USDC; set true only on 880024

        uint256 id = block.chainid;
        if (id != 880024 && id != 43113 && id != 31337) {
            revert("Unexpected chain: Fuji (43113), NOFI testnet (880024) or anvil (31337)");
        }

        vm.startBroadcast();
        reg = new WaterProofRegistry(oracle);
        reg.registerFarm(keccak256("moquegua:carumas"), address(0), unicode"Carumas · papa (secano) · 3,000 m");
        reg.registerFarm(
            keccak256("moquegua:samegua"), address(0), unicode"Samegua · alfalfa (Pasto Grande) · 1,550 m"
        );
        reg.registerFarm(keccak256("moquegua:algarrobal"), address(0), unicode"El Algarrobal · olivo (riego) · 150 m");
        if (deployToken) usd = new X402TestUSDC();
        vm.stopBroadcast();

        string memory explorer = id == 880024
            ? "https://nofiscan.io/address/"
            : id == 43113 ? "https://testnet.snowtrace.io/address/" : "(local) ";
        console2.log("chainId:", id);
        console2.log("oracle:", oracle);
        console2.log("WaterProofRegistry:", address(reg));
        console2.log(string.concat(explorer, vm.toString(address(reg))));
        if (deployToken) {
            console2.log("X402TestUSDC:", address(usd));
            console2.log(string.concat(explorer, vm.toString(address(usd))));
        }
    }
}
