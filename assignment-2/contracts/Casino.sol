pragma solidity ^0.4.22;
import "./oraclizeAPI_0.4.sol";

/// @title Assignment adaptation of Merunas Grincalaitis's Casino tutorial.
/// @dev Original preserved in upstream/Casino.original.sol.txt; changes in docs/CHANGES.md.
contract Casino is usingOraclize {
    uint public minimumBet;
    uint public maxAmountOfBets;
    uint public constant LIMIT_AMOUNT_BETS = 100;
    uint public totalBet;
    uint public numberOfBets;
    uint public numberWinner;
    uint public currentRoundId = 1;
    uint public reservedPrizes;
    bool public awaitingRandomness;
    bytes32 public pendingQueryId;
    bool private entered;

    struct Round { uint winner; uint prizePerWinner; bool settled; }
    mapping(uint => Round) public completedRounds;
    mapping(uint => mapping(address => uint)) public playerBetsNumber;
    mapping(uint => mapping(uint => uint)) public numberPlayerCount;
    mapping(uint => mapping(address => bool)) public claimed;

    event BetPlaced(uint indexed roundId, address indexed player, uint number, uint amount);
    event RandomnessRequested(uint indexed roundId, bytes32 indexed queryId);
    event RoundSettled(uint indexed roundId, uint winningNumber, uint winners, uint prizePerWinner, uint carryover);
    event PrizeClaimed(uint indexed roundId, address indexed player, address indexed recipient, uint amount);
    event OracleFunded(address indexed sender, uint amount);

    constructor(uint _minimumBet, uint _maxAmountOfBets) public payable {
        require(_minimumBet > 0 && _maxAmountOfBets > 0 && _maxAmountOfBets <= LIMIT_AMOUNT_BETS);
        minimumBet = _minimumBet;
        maxAmountOfBets = _maxAmountOfBets;
        // Exactly the tutorial's Oraclize random datasource and Ledger proof type.
        oraclize_setProof(proofType_Ledger);
    }
    function oracleMode() public pure returns (string) { return "ORACLIZE_RANDOM_DS"; }
    function checkPlayerExists(address player) public view returns (bool) {
        return playerBetsNumber[currentRoundId][player] != 0;
    }
    function oracleBudget() public view returns (uint) { return address(this).balance - totalBet - reservedPrizes; }
    function fundOracle() public payable { require(msg.value > 0); emit OracleFunded(msg.sender, msg.value); }
    function randomnessPrice() public returns (uint) { return oraclize_getPrice("random", 500000); }

    function bet(uint numberToBet) public payable {
        require(!entered && !awaitingRandomness && numberOfBets < maxAmountOfBets);
        require(!checkPlayerExists(msg.sender) && numberToBet >= 1 && numberToBet <= 10);
        require(msg.value >= minimumBet && totalBet + msg.value >= totalBet);
        playerBetsNumber[currentRoundId][msg.sender] = numberToBet;
        numberPlayerCount[currentRoundId][numberToBet]++;
        numberOfBets++;
        totalBet += msg.value;
        emit BetPlaced(currentRoundId, msg.sender, numberToBet, msg.value);
        // Preserve the tutorial's automatic request on the last bet.
        if (numberOfBets == maxAmountOfBets) generateNumberWinner();
    }
    function generateNumberWinner() public {
        require(!entered && !awaitingRandomness && numberOfBets == maxAmountOfBets);
        uint fee = oraclize_getPrice("random", 500000);
        require(oracleBudget() >= fee);
        awaitingRandomness = true;
        bytes32 queryId = oraclize_newRandomDSQuery(0, 7, 500000);
        require(queryId != bytes32(0));
        require(address(this).balance >= totalBet + reservedPrizes);
        pendingQueryId = queryId;
        emit RandomnessRequested(currentRoundId, queryId);
    }
    function __callback(bytes32 _queryId, string _result, bytes _proof)
        public oraclize_randomDS_proofVerify(_queryId, _result, _proof)
    {
        require(msg.sender == oraclize_cbAddress());
        acceptResult(_queryId, _result);
    }
    function acceptResult(bytes32 queryId, string result) internal {
        require(awaitingRandomness && queryId == pendingQueryId);
        uint winner = uint(keccak256(result)) % 10 + 1;
        uint winners = numberPlayerCount[currentRoundId][winner];
        uint share = winners == 0 ? 0 : totalBet / winners;
        uint reserved = share * winners;
        uint carry = totalBet - reserved;
        require(reservedPrizes + reserved >= reservedPrizes);
        completedRounds[currentRoundId] = Round(winner, share, true);
        reservedPrizes += reserved;
        numberWinner = winner;
        emit RoundSettled(currentRoundId, winner, winners, share, carry);
        currentRoundId++;
        numberOfBets = 0;
        totalBet = carry;
        awaitingRandomness = false;
        pendingQueryId = bytes32(0);
    }
    function claimable(uint roundId, address player) public view returns (uint) {
        Round storage round = completedRounds[roundId];
        if (!round.settled || claimed[roundId][player] || playerBetsNumber[roundId][player] != round.winner) return 0;
        return round.prizePerWinner;
    }
    function claimPrize(uint roundId, address recipient) public {
        require(!entered && recipient != address(0));
        uint amount = claimable(roundId, msg.sender);
        require(amount > 0);
        entered = true;
        claimed[roundId][msg.sender] = true;
        reservedPrizes -= amount;
        require(recipient.call.value(amount)());
        emit PrizeClaimed(roundId, msg.sender, recipient, amount);
        entered = false;
    }
}
