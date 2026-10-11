pragma solidity ^0.4.22;
import "contracts/Casino.sol";

// LOCAL TEST ONLY. This harness skips Ledger proof verification; never submit its
// address as the public Casino. Its constructor requires the local test bridge.
contract CasinoLocalHarness is Casino {
    constructor(uint min, uint max) Casino(min, max) public payable {
        require(address(OAR) == 0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
        require(LocalBridgeMarker(address(oraclize)).localSimulationMarker() == keccak256("ASSIGNMENT_LOCAL_ONLY"));
    }
    function oracleMode() public pure returns (string) { return "LOCAL_ORACLIZE_TEST_HARNESS"; }
    function __callback(bytes32 id, string result, bytes) public {
        require(msg.sender == oraclize_cbAddress());
        acceptResult(id, result);
    }
}
contract LocalBridgeMarker { function localSimulationMarker() public view returns(bytes32); }
contract LocalResolver {
    address private target;
    function setAddress(address value) public { require(target == address(0)); target = value; }
    function getAddress() public view returns(address) { return target; }
}
contract LocalOracle {
    address public cbAddress;
    uint public price;
    uint private nextId;
    mapping(bytes32 => address) public consumers;
    constructor() public { cbAddress = address(this); }
    function localSimulationMarker() public pure returns(bytes32) { return keccak256("ASSIGNMENT_LOCAL_ONLY"); }
    function setPrice(uint value) public { price = value; }
    function setProofType(byte) public {}
    function getPrice(string) public view returns(uint) { return price; }
    function getPrice(string, uint) public view returns(uint) { return price; }
    function randomDS_getSessionPubKeyHash() public pure returns(bytes32) { return keccak256("local-session"); }
    function queryN_withGasLimit(uint, string, bytes, uint) public payable returns(bytes32 id) {
        require(msg.value == price); id = bytes32(++nextId); consumers[id] = msg.sender;
    }
    function fulfill(bytes32 id, string result) public {
        address consumer = consumers[id]; require(consumer != address(0)); delete consumers[id];
        Casino(consumer).__callback(id, result, new bytes(0));
    }
}
contract TestWinner {
    Casino private casino;
    bool public rejectPayment = true;
    bool public tryReentry;
    bool public reentryBlocked;
    constructor(address target) public { casino = Casino(target); }
    function placeBet(uint number) public payable { casino.bet.value(msg.value)(number); }
    function claim(address recipient) public { casino.claimPrize(1, recipient); }
    function configure(bool reject, bool reenter) public { rejectPayment = reject; tryReentry = reenter; }
    function() public payable {
        require(!rejectPayment);
        if (tryReentry) {
            bool success = address(casino).call(bytes4(keccak256("claimPrize(uint256,address)")), uint(1), address(this));
            require(!success); reentryBlocked = true;
        }
    }
}
