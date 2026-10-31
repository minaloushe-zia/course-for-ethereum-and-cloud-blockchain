pragma solidity 0.5.1;

// Checked arithmetic for the operations used by this voting contract.
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction underflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
}

contract FixedVoting {
    using SafeMath for uint256;

    mapping(address => uint256) public remainingVotes;
    uint256[] public candidates;
    address owner;
    bool hasEnded = false;

    modifier notEnded() {
        require(!hasEnded, "Voting has ended");
        _;
    }

    constructor(uint256 amountOfCandidates) public {
        candidates.length = amountOfCandidates;
        owner = msg.sender;
    }

    function buyVotes() public payable notEnded {
        require(msg.value >= 1 ether, "At least one ether is required");
        remainingVotes[msg.sender] = remainingVotes[msg.sender].add(
            msg.value / 1 ether
        );
        msg.sender.transfer(msg.value % 1 ether);
    }

    function vote(uint256 _candidateID, uint256 _amountOfVotes)
        public
        notEnded
    {
        require(_candidateID < candidates.length, "Invalid candidate");
        remainingVotes[msg.sender] = remainingVotes[msg.sender].sub(
            _amountOfVotes
        );
        candidates[_candidateID] = candidates[_candidateID].add(
            _amountOfVotes
        );
    }

    function payoutVotes(uint256 _amount) public notEnded {
        require(remainingVotes[msg.sender] >= _amount, "Insufficient votes");
        uint256 payment = _amount.mul(1 ether);
        remainingVotes[msg.sender] = remainingVotes[msg.sender].sub(_amount);
        msg.sender.transfer(payment);
    }

    function endVoting() public notEnded {
        require(msg.sender == owner, "Only the owner can end voting");
        hasEnded = true;
        msg.sender.transfer(address(this).balance);
    }

    function displayBalanceInEther() public view returns (uint256 balance) {
        return address(this).balance / 1 ether;
    }
}
