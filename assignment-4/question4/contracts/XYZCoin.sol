pragma solidity 0.5.1;

import "./ERC20.sol";
import "./SafeMath.sol";

contract XYZCoin is ERC20 {
    using SafeMath for uint256;

    string public name = "XYZCoin";
    string public symbol = "XYZ";
    uint8 public decimals = 0;
    uint256 public totalSupply = 1000;

    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowed;

    constructor() public {
        balances[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function balanceOf(address owner) external view returns (uint256) {
        return balances[owner];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowed[owner][spender];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0), "XYZCoin: zero spender");
        allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(allowed[from][msg.sender] >= value, "XYZCoin: insufficient allowance");
        allowed[from][msg.sender] = allowed[from][msg.sender].sub(value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "XYZCoin: zero sender");
        require(to != address(0), "XYZCoin: zero recipient");
        require(balances[from] >= value, "XYZCoin: insufficient balance");
        balances[from] = balances[from].sub(value);
        balances[to] = balances[to].add(value);
        emit Transfer(from, to, value);
    }
}
