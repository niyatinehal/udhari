// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CreRelay} from "../src/fuji/CreRelay.sol";
import {DealManager} from "../src/hedera/DealManager.sol";
import {Actions} from "../src/shared/Actions.sol";

contract MockLink is ERC20 {
    constructor() ERC20("ChainLink Token", "LINK") {
        _mint(msg.sender, 100 ether);
    }
}

/// @dev Records the last message and charges a flat LINK fee, like the CCIP router.
contract MockRouter {
    uint256 public constant FEE = 0.1 ether;
    Client.EVM2AnyMessage internal s_last;
    uint64 public lastDest;

    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return FEE;
    }

    function ccipSend(uint64 dest, Client.EVM2AnyMessage calldata message) external returns (bytes32) {
        ERC20(message.feeToken).transferFrom(msg.sender, address(this), FEE);
        lastDest = dest;
        s_last = message;
        return keccak256(abi.encode(dest, message.data));
    }

    function lastData() external view returns (bytes memory) {
        return s_last.data;
    }

    function lastReceiver() external view returns (bytes memory) {
        return s_last.receiver;
    }
}

contract BridgeTest is Test {
    uint64 internal constant FUJI = 14767482510784806043;
    uint64 internal constant HEDERA = 222782988166878823;

    MockLink internal link;
    MockRouter internal fujiRouter;
    CreRelay internal relay;
    DealManager internal manager;
    address internal forwarder = makeAddr("forwarder");
    address internal hederaRouter = makeAddr("hederaRouter");

    function setUp() public {
        link = new MockLink();
        fujiRouter = new MockRouter();
        relay = new CreRelay(address(fujiRouter), address(link), HEDERA, forwarder);
        manager = new DealManager(hederaRouter, FUJI);
        relay.setDestReceiver(address(manager));
        manager.setRelay(address(relay));
        link.transfer(address(relay), 1 ether);
    }

    function _pingReport() internal view returns (bytes memory) {
        return abi.encode(Actions.PING, abi.encode("hello", block.timestamp));
    }

    function test_RelaySendsReportToHedera() public {
        bytes memory report = _pingReport();
        vm.prank(forwarder);
        relay.onReport("", report);

        assertEq(fujiRouter.lastDest(), HEDERA);
        assertEq(fujiRouter.lastData(), report);
        assertEq(abi.decode(fujiRouter.lastReceiver(), (address)), address(manager));
        assertEq(link.balanceOf(address(relay)), 1 ether - fujiRouter.FEE());
    }

    function test_RelayRejectsAnyoneButForwarder() public {
        bytes memory report = _pingReport();
        vm.expectRevert(abi.encodeWithSelector(CreRelay.NotForwarder.selector, address(this)));
        relay.onReport("", report);
    }

    function _message(uint64 source, address sender) internal view returns (Client.Any2EVMMessage memory m) {
        m.messageId = keccak256("id");
        m.sourceChainSelector = source;
        m.sender = abi.encode(sender);
        m.data = _pingReport();
    }

    function test_ManagerAppliesPingFromRelay() public {
        vm.prank(hederaRouter);
        manager.ccipReceive(_message(FUJI, address(relay)));
        assertEq(manager.pingCount(), 1);
        assertEq(manager.lastMessageId(), keccak256("id"));
    }

    function test_ManagerRejectsOtherSenders() public {
        vm.startPrank(hederaRouter);
        vm.expectRevert(abi.encodeWithSelector(DealManager.UnknownSource.selector, HEDERA));
        manager.ccipReceive(_message(HEDERA, address(relay)));

        vm.expectRevert(abi.encodeWithSelector(DealManager.UnknownSender.selector, address(this)));
        manager.ccipReceive(_message(FUJI, address(this)));
        vm.stopPrank();
    }

    function test_ManagerOnlyAcceptsRouter() public {
        vm.expectRevert();
        manager.ccipReceive(_message(FUJI, address(relay)));
    }
}
