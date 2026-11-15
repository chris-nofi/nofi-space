// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {X402TestUSDC} from "../src/X402TestUSDC.sol";

contract X402TestUSDCTest is Test {
    X402TestUSDC t;
    uint256 payerPk = 0xA11CE; // throwaway test-only scalar, never a real key
    address payer;
    address oracleApi = address(0x0EA27);
    address facilitator = address(0xFAC);

    function setUp() public {
        vm.chainId(880024);
        vm.warp(1_800_000_000);
        t = new X402TestUSDC();
        payer = vm.addr(payerPk);
        vm.prank(payer);
        t.faucet();
    }

    function _sign(bytes32 typehash, address from, address to, uint256 value, uint256 va, uint256 vb, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 sh = keccak256(abi.encode(typehash, from, to, value, va, vb, nonce));
        bytes32 d = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), sh));
        (v, r, s) = vm.sign(payerPk, d);
    }

    function test_faucetAndCooldown() public {
        assertEq(t.balanceOf(payer), 100e6);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(X402TestUSDC.FaucetCooldownActive.selector, block.timestamp + 1 hours));
        t.faucet();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(payer);
        t.faucet();
        assertEq(t.balanceOf(payer), 200e6);
    }

    function test_domainMatchesEip712() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Ceres x402 Test USDC"),
                keccak256("1"),
                uint256(880024),
                address(t)
            )
        );
        assertEq(t.DOMAIN_SEPARATOR(), expected);
    }

    function test_transferWithAuthorization_relayedByFacilitator() public {
        bytes32 nonce = keccak256("q1");
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 50_000, 0, block.timestamp + 60, nonce
        );
        vm.prank(facilitator); // facilitator pays gas, payer never needs native tUSD
        t.transferWithAuthorization(payer, oracleApi, 50_000, 0, block.timestamp + 60, nonce, v, r, s);
        assertEq(t.balanceOf(oracleApi), 50_000);
        assertTrue(t.authorizationState(payer, nonce));
    }

    function test_bytesSignatureOverload() public {
        bytes32 nonce = keccak256("q2");
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 1, 0, block.timestamp + 60, nonce
        );
        t.transferWithAuthorization(payer, oracleApi, 1, 0, block.timestamp + 60, nonce, abi.encodePacked(r, s, v));
        assertEq(t.balanceOf(oracleApi), 1);
    }

    function test_replayRejected() public {
        bytes32 nonce = keccak256("q3");
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 10, 0, block.timestamp + 60, nonce
        );
        t.transferWithAuthorization(payer, oracleApi, 10, 0, block.timestamp + 60, nonce, v, r, s);
        vm.expectRevert(X402TestUSDC.AuthorizationAlreadyUsed.selector);
        t.transferWithAuthorization(payer, oracleApi, 10, 0, block.timestamp + 60, nonce, v, r, s);
    }

    function test_tamperedAmountOrPayeeRejected() public {
        bytes32 nonce = keccak256("q4");
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 10, 0, block.timestamp + 60, nonce
        );
        vm.expectRevert(X402TestUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(payer, oracleApi, 11, 0, block.timestamp + 60, nonce, v, r, s);
        vm.expectRevert(X402TestUSDC.InvalidSignature.selector);
        t.transferWithAuthorization(payer, facilitator, 10, 0, block.timestamp + 60, nonce, v, r, s);
    }

    function test_validityWindow() public {
        bytes32 nonce = keccak256("q5");
        uint256 va = block.timestamp + 10;
        (uint8 v, bytes32 r, bytes32 s) =
            _sign(t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 10, va, va + 60, nonce);
        vm.expectRevert(X402TestUSDC.AuthorizationNotYetValid.selector);
        t.transferWithAuthorization(payer, oracleApi, 10, va, va + 60, nonce, v, r, s);
        vm.warp(va + 61);
        vm.expectRevert(X402TestUSDC.AuthorizationExpired.selector);
        t.transferWithAuthorization(payer, oracleApi, 10, va, va + 60, nonce, v, r, s);
    }

    function test_receiveWithAuthorization_onlyPayee() public {
        bytes32 nonce = keccak256("q6");
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 10, 0, block.timestamp + 60, nonce
        );
        vm.expectRevert(X402TestUSDC.CallerMustBePayee.selector);
        t.receiveWithAuthorization(payer, oracleApi, 10, 0, block.timestamp + 60, nonce, v, r, s);
        vm.prank(oracleApi);
        t.receiveWithAuthorization(payer, oracleApi, 10, 0, block.timestamp + 60, nonce, v, r, s);
        assertEq(t.balanceOf(oracleApi), 10);
    }

    function test_cancelAuthorization() public {
        bytes32 nonce = keccak256("q7");
        bytes32 d = keccak256(
            abi.encodePacked(
                "\x19\x01", t.DOMAIN_SEPARATOR(), keccak256(abi.encode(t.CANCEL_AUTHORIZATION_TYPEHASH(), payer, nonce))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, d);
        t.cancelAuthorization(payer, nonce, v, r, s);
        (v, r, s) = _sign(t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, 10, 0, block.timestamp + 60, nonce);
        vm.expectRevert(X402TestUSDC.AuthorizationAlreadyUsed.selector);
        t.transferWithAuthorization(payer, oracleApi, 10, 0, block.timestamp + 60, nonce, v, r, s);
    }

    function testFuzz_insufficientBalance(uint256 value) public {
        value = bound(value, 100e6 + 1, type(uint128).max);
        bytes32 nonce = keccak256(abi.encode(value));
        (uint8 v, bytes32 r, bytes32 s) = _sign(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), payer, oracleApi, value, 0, block.timestamp + 60, nonce
        );
        vm.expectRevert(X402TestUSDC.InsufficientBalance.selector);
        t.transferWithAuthorization(payer, oracleApi, value, 0, block.timestamp + 60, nonce, v, r, s);
    }
}
