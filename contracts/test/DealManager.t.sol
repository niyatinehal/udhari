// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {DealManager} from "../src/hedera/DealManager.sol";
import {Isin} from "../src/hedera/Isin.sol";
import {Actions} from "../src/shared/Actions.sol";
import {MockAtsFactory, MockBond, MockUsdc} from "./mocks/AtsMocks.sol";

contract DealManagerTest is Test {
    uint64 internal constant FUJI = 14767482510784806043;
    uint256 internal constant FACE = 100e6; // buyer owes 100 USDC
    uint16 internal constant DISCOUNT = 500; // investors fund 95 USDC

    DealManager internal manager;
    MockUsdc internal usdc;
    MockAtsFactory internal factory;
    address internal router = makeAddr("router");
    address internal relay = makeAddr("relay");
    address internal business = makeAddr("business");
    address internal buyer = makeAddr("buyer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal nonce;

    function setUp() public {
        usdc = new MockUsdc();
        factory = new MockAtsFactory();
        manager = new DealManager(router, FUJI, address(usdc), address(factory), makeAddr("resolver"));
        manager.setRelay(relay);

        for (uint256 i = 0; i < 3; i++) {
            address who = [alice, bob, buyer][i];
            usdc.mint(who, 1_000e6);
            vm.prank(who);
            usdc.approve(address(manager), type(uint256).max);
        }
    }

    // ---------------------------------------------------------------- helpers

    function _deliver(uint8 action, bytes memory payload) internal {
        Client.Any2EVMMessage memory m;
        m.messageId = keccak256(abi.encode(++nonce));
        m.sourceChainSelector = FUJI;
        m.sender = abi.encode(relay);
        m.data = abi.encode(action, payload);
        vm.prank(router);
        manager.ccipReceive(m);
    }

    function _approve(bytes32 docHash) internal returns (uint256 dealId) {
        _deliver(
            Actions.APPROVE_DEAL,
            abi.encode(
                business, uint8(2), DISCOUNT, uint64(block.timestamp + 1 days), FACE, docHash, "INV-0001"
            )
        );
        dealId = manager.dealCount();
    }

    function _verify(address who) internal {
        _deliver(Actions.VERIFY_INVESTOR, abi.encode(who, true, keccak256(abi.encode(who))));
    }

    function _fundedDeal() internal returns (uint256 dealId, MockBond bond) {
        dealId = _approve(keccak256("doc"));
        bond = MockBond(manager.openDeal(dealId));
        _verify(alice);
        _verify(bob);
        vm.prank(alice);
        manager.invest(dealId, 60e6);
        vm.prank(bob);
        manager.invest(dealId, 35e6);
    }

    // ---------------------------------------------------------------- approval

    function test_ApproveStoresDealWithTarget() public {
        uint256 dealId = _approve(keccak256("doc"));
        DealManager.Deal memory d = manager.getDeal(dealId);
        assertEq(uint8(d.status), uint8(DealManager.Status.Approved));
        assertEq(d.business, business);
        assertEq(d.target, 95e6);
        assertEq(d.ref, "INV-0001");
    }

    function test_ApproveRejectsPolicyBreaches() public {
        vm.prank(router);
        Client.Any2EVMMessage memory m;
        m.sourceChainSelector = FUJI;
        m.sender = abi.encode(relay);
        m.data = abi.encode(
            Actions.APPROVE_DEAL,
            abi.encode(
                business, uint8(5), DISCOUNT, uint64(block.timestamp + 1 days), FACE, bytes32("d"), "X"
            )
        );
        vm.expectRevert(abi.encodeWithSelector(DealManager.PolicyRejected.selector, uint8(5), DISCOUNT));
        manager.ccipReceive(m);
    }

    function test_ApproveRejectsReusedDocument() public {
        _approve(keccak256("doc"));
        vm.expectRevert(abi.encodeWithSelector(DealManager.RefUsed.selector, keccak256("doc")));
        this.approveExternal(keccak256("doc"));
    }

    function approveExternal(bytes32 docHash) external {
        _approve(docHash);
    }

    function test_PingIsRecorded() public {
        _deliver(Actions.PING, abi.encode("hello", block.timestamp));
        assertEq(manager.pingCount(), 1);
    }

    function test_RejectsMessagesFromOtherSenders() public {
        Client.Any2EVMMessage memory m;
        m.sourceChainSelector = FUJI;
        m.sender = abi.encode(address(this));
        m.data = abi.encode(Actions.PING, abi.encode("x", uint256(0)));
        vm.prank(router);
        vm.expectRevert(abi.encodeWithSelector(DealManager.UnknownSender.selector, address(this)));
        manager.ccipReceive(m);
    }

    // ---------------------------------------------------------------- opening

    function test_OpenDeploysBondAdministeredByManager() public {
        uint256 dealId = _approve(keccak256("doc"));
        MockBond bond = MockBond(manager.openDeal(dealId));
        assertEq(bond.admin(), address(manager));
        assertEq(address(bond.kycList()), address(manager));
        assertEq(bond.isin(), "ZZ0000000016");
        assertEq(factory.lastMaxSupply(), 95e6);
        assertEq(factory.lastRoleCount(), 7);
        assertEq(uint8(manager.getDeal(dealId).status), uint8(DealManager.Status.Open));
    }

    function test_OnlyOwnerOpens() public {
        uint256 dealId = _approve(keccak256("doc"));
        vm.prank(alice);
        vm.expectRevert();
        manager.openDeal(dealId);
    }

    function test_IsinCheckDigits() public pure {
        assertEq(Isin.forId(1), "ZZ0000000016");
        assertEq(Isin.checkDigit(bytes("US037833100")), 5); // Apple
    }

    // ---------------------------------------------------------------- funding

    function test_UnverifiedInvestorCannotFund() public {
        uint256 dealId = _approve(keccak256("doc"));
        manager.openDeal(dealId);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DealManager.NotVerified.selector, alice));
        manager.invest(dealId, 10e6);
    }

    function test_FullFundingPaysBusiness() public {
        (uint256 dealId, MockBond bond) = _fundedDeal();
        DealManager.Deal memory d = manager.getDeal(dealId);
        assertEq(uint8(d.status), uint8(DealManager.Status.Active));
        assertEq(usdc.balanceOf(business), 95e6);
        assertEq(bond.balanceOf(alice), 60e6);
        assertEq(bond.balanceOf(bob), 35e6);
        assertEq(manager.reserved(), 0);
    }

    function test_CannotOverfund() public {
        uint256 dealId = _approve(keccak256("doc"));
        manager.openDeal(dealId);
        _verify(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DealManager.OverTarget.selector, 95e6));
        manager.invest(dealId, 96e6);
    }

    // ---------------------------------------------------------------- repayment

    function test_RepayAndRedeemProRata() public {
        (uint256 dealId, MockBond bond) = _fundedDeal();
        vm.prank(buyer);
        manager.repay(dealId);
        assertEq(manager.reserved(), FACE);

        vm.prank(alice);
        manager.redeem(dealId);
        vm.prank(bob);
        manager.redeem(dealId);

        // 60/95 and 35/95 of the 100 USDC face value.
        assertEq(usdc.balanceOf(alice), 1_000e6 - 60e6 + 63_157_894);
        assertEq(usdc.balanceOf(bob), 1_000e6 - 35e6 + 36_842_105);
        assertEq(bond.totalSupply(), 0);
        assertLe(manager.reserved(), 1); // rounding dust
    }

    function test_CreConfirmedRepaymentNeedsUsdcOnHand() public {
        (uint256 dealId,) = _fundedDeal();
        vm.prank(router);
        Client.Any2EVMMessage memory m;
        m.sourceChainSelector = FUJI;
        m.sender = abi.encode(relay);
        m.data = abi.encode(Actions.CONFIRM_REPAYMENT, abi.encode(dealId, FACE, bytes32("bank-ref-1")));
        vm.expectRevert(abi.encodeWithSelector(DealManager.InsufficientUnallocated.selector, 0, FACE));
        manager.ccipReceive(m);

        usdc.mint(address(manager), FACE); // operator on-ramps the bank payment
        _deliver(Actions.CONFIRM_REPAYMENT, abi.encode(dealId, FACE, bytes32("bank-ref-1")));
        assertEq(uint8(manager.getDeal(dealId).status), uint8(DealManager.Status.Repaid));
    }

    // ---------------------------------------------------------------- late and circuit breaker

    function test_MarkLateOnlyAfterDueDate() public {
        (uint256 dealId,) = _fundedDeal();
        vm.prank(router);
        Client.Any2EVMMessage memory m;
        m.sourceChainSelector = FUJI;
        m.sender = abi.encode(relay);
        m.data = abi.encode(Actions.MARK_LATE, abi.encode(dealId, false));
        vm.expectRevert();
        manager.ccipReceive(m);
    }

    function test_LatePausesBondFreezesBusinessAndRepaymentRestores() public {
        (uint256 dealId, MockBond bond) = _fundedDeal();
        vm.warp(block.timestamp + 2 days);
        _deliver(Actions.MARK_LATE, abi.encode(dealId, false));

        assertTrue(bond.paused());
        assertTrue(manager.frozenBusiness(business));
        assertEq(uint8(manager.getDeal(dealId).status), uint8(DealManager.Status.Late));

        vm.prank(buyer);
        manager.repay(dealId);
        assertFalse(bond.paused());
        assertFalse(manager.frozenBusiness(business));
        vm.prank(alice);
        manager.redeem(dealId);
    }

    function test_BusinessStaysFrozenUntilEveryLateDealIsRepaid() public {
        (uint256 first,) = _fundedDeal();
        uint256 second = _approve(keccak256("doc-2"));
        manager.openDeal(second);
        vm.prank(alice);
        manager.invest(second, 95e6);

        vm.warp(block.timestamp + 2 days);
        _deliver(Actions.MARK_LATE, abi.encode(first, false));
        _deliver(Actions.MARK_LATE, abi.encode(second, false));
        _deliver(Actions.MARK_LATE, abi.encode(second, true)); // escalation is not a new delinquency
        assertEq(manager.delinquentDeals(business), 2);

        vm.prank(buyer);
        manager.repay(first);
        assertTrue(manager.frozenBusiness(business));

        vm.prank(buyer);
        manager.repay(second);
        assertFalse(manager.frozenBusiness(business));
        assertEq(manager.delinquentDeals(business), 0);
    }

    function test_ReconciliationMismatchPausesFunding() public {
        uint256 dealId = _approve(keccak256("doc"));
        manager.openDeal(dealId);
        _verify(alice);
        _deliver(Actions.RECONCILE, abi.encode(false, uint256(0), bytes32("snapshot")));
        assertTrue(manager.fundingPaused());

        vm.prank(alice);
        vm.expectRevert(DealManager.FundingIsPaused.selector);
        manager.invest(dealId, 10e6);

        manager.resumeFunding();
        vm.prank(alice);
        manager.invest(dealId, 10e6);
    }

    // ---------------------------------------------------------------- expiry

    function test_UnfundedDealExpiresAndRefunds() public {
        uint256 dealId = _approve(keccak256("doc"));
        MockBond bond = MockBond(manager.openDeal(dealId));
        _verify(alice);
        vm.prank(alice);
        manager.invest(dealId, 40e6);

        vm.expectRevert();
        manager.expire(dealId);

        vm.warp(block.timestamp + 1 days);
        vm.prank(bob); // anyone can expire
        manager.expire(dealId);
        assertEq(uint8(manager.getDeal(dealId).status), uint8(DealManager.Status.Expired));

        vm.prank(alice);
        manager.redeem(dealId);
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(bond.balanceOf(alice), 0);
        assertEq(manager.reserved(), 0);
    }

    function test_FundedDealCannotExpire() public {
        (uint256 dealId,) = _fundedDeal();
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(
            abi.encodeWithSelector(DealManager.BadStatus.selector, dealId, DealManager.Status.Active)
        );
        manager.expire(dealId);
    }

    function test_KycListGrantsVerifiedInvestorsAndSelf() public {
        _verify(alice);
        assertEq(uint8(manager.getKycStatus(alice)), 1);
        assertEq(uint8(manager.getKycStatus(bob)), 0);
        assertEq(uint8(manager.getKycStatus(address(manager))), 1);
    }
}
