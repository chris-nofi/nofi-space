// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {WaterProofRegistry} from "./WaterProofRegistry.sol";

/// @title  CeresRegistryBootstrap: one-transaction setup of WaterProofRegistry for wallets that can only send
///         transactions TO an address (e.g. Core Wallet's MCP signer, which cannot send a bare contract creation).
/// @notice Deployed through the standard CREATE2 deployer (0x4e59b44847b379578588920cA78FbF26c0B4956C) with
///         calldata = salt ‖ initcode. Its constructor deploys the registry (so the registry's owner is momentarily
///         this contract), registers the three Moquegua demo farms, and transfers ownership to `finalOwner`.
///         After construction this contract holds no rights over the registry. The registry is unchanged.
contract CeresRegistryBootstrap {
    WaterProofRegistry public immutable registry;

    constructor(address oracle, address finalOwner) {
        WaterProofRegistry reg = new WaterProofRegistry(oracle);
        reg.registerFarm(keccak256("moquegua:carumas"), address(0), unicode"Carumas · papa (secano) · 3,000 m");
        reg.registerFarm(keccak256("moquegua:samegua"), address(0), unicode"Samegua · alfalfa (Pasto Grande) · 1,550 m");
        reg.registerFarm(keccak256("moquegua:algarrobal"), address(0), unicode"El Algarrobal · olivo (riego) · 150 m");
        reg.transferOwnership(finalOwner); // reverts on address(0)
        registry = reg;
    }
}
