// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract HelloWorld {
    event Greeting(address indexed caller, string message);

    function hello() external returns (string memory) {
        string memory message = "Hello, world!";
        emit Greeting(msg.sender, message);
        return message;
    }

    function readHello() external pure returns (string memory) {
        return "Hello, world!";
    }
}
