// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PlotRegistry
/// @notice Maps a hashed field boundary to its farmer. Coordinates never go on-chain:
///         plotHash = keccak256(polygonGeoJSON + salt), computed off-chain.
contract PlotRegistry {
    struct Plot {
        address owner;
        uint32 areaHaX100; // hectares × 100
        bytes32 basin;     // e.g. keccak256("Osmore-Moquegua")
        uint64 registeredAt;
    }

    mapping(bytes32 => Plot) public plots;

    event PlotRegistered(bytes32 indexed plotHash, address indexed owner, uint32 areaHaX100, bytes32 basin);
    event PlotTransferred(bytes32 indexed plotHash, address indexed from, address indexed to);

    error AlreadyRegistered();
    error NotOwner();
    error ZeroArea();

    function register(bytes32 plotHash, uint32 areaHaX100, bytes32 basin) external {
        if (plots[plotHash].owner != address(0)) revert AlreadyRegistered();
        if (areaHaX100 == 0) revert ZeroArea();
        plots[plotHash] = Plot(msg.sender, areaHaX100, basin, uint64(block.timestamp));
        emit PlotRegistered(plotHash, msg.sender, areaHaX100, basin);
    }

    function transferPlot(bytes32 plotHash, address to) external {
        if (plots[plotHash].owner != msg.sender) revert NotOwner();
        plots[plotHash].owner = to;
        emit PlotTransferred(plotHash, msg.sender, to);
    }

    function ownerOf(bytes32 plotHash) external view returns (address) {
        return plots[plotHash].owner;
    }

    function areaOf(bytes32 plotHash) external view returns (uint32) {
        return plots[plotHash].areaHaX100;
    }
}
