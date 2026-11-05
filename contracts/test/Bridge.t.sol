// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CreRelay} from "../src/fuji/CreRelay.sol";
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

contract CreRelayTest is Test {
    uint64 internal constant HEDERA = 222782988166878823;

    MockLink internal link;
    MockRouter internal fujiRouter;
    CreRelay internal relay;
    address internal forwarder = makeAddr("forwarder");
    address internal manager = makeAddr("dealManager");

    function setUp() public {
        link = new MockLink();
        fujiRouter = new MockRouter();
        relay = new CreRelay(address(fujiRouter), address(link), HEDERA, forwarder);
        relay.setDestReceiver(manager);
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
        assertEq(abi.decode(fujiRouter.lastReceiver(), (address)), manager);
        assertEq(link.balanceOf(address(relay)), 1 ether - fujiRouter.FEE());
    }

    function test_RelayRejectsAnyoneButForwarder() public {
        bytes memory report = _pingReport();
        vm.expectRevert(abi.encodeWithSelector(CreRelay.NotForwarder.selector, address(this)));
        relay.onReport("", report);
    }
}
