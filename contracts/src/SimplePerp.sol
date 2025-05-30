// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";
import "./RatioOracle.sol";

contract SimplePerp {
    struct Position {
        string baseToken;
        string quoteToken;
        uint256 notional;
        bool isLong;
        uint256 entryShare;
    }
    
    IERC20 public immutable collateralToken;
    RatioOracle public immutable oracle;
    
    uint256 public constant INITIAL_MARGIN_RATIO = 30;
    uint256 public constant PRECISION = 100;
    
    mapping(address => uint256) public balances;
    mapping(address => Position) public positions;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event PositionOpened(address indexed user, string baseToken, string quoteToken, uint256 notional, bool isLong);
    event PositionClosed(address indexed user, int256 pnl);
    
    constructor(address _collateralToken, address _oracle) {
        collateralToken = IERC20(_collateralToken);
        oracle = RatioOracle(_oracle);
    }
    
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        
        emit Deposit(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(positions[msg.sender].notional == 0, "Cannot withdraw with open position");
        
        balances[msg.sender] -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount);
    }
    
    function openPosition(
        string memory baseToken,
        string memory quoteToken,
        uint256 notional,
        bool isLong
    ) external {
        require(positions[msg.sender].notional == 0, "Position already open");
        require(notional > 0, "Notional must be greater than 0");
        
        uint256 requiredMargin = (notional * INITIAL_MARGIN_RATIO) / PRECISION;
        require(balances[msg.sender] >= requiredMargin, "Insufficient margin");
        
        uint256 entryShare = oracle.getRatioShare(baseToken, quoteToken);
        
        positions[msg.sender] = Position({
            baseToken: baseToken,
            quoteToken: quoteToken,
            notional: notional,
            isLong: isLong,
            entryShare: entryShare
        });
        
        emit PositionOpened(msg.sender, baseToken, quoteToken, notional, isLong);
    }
    
    function closePosition() external {
        Position memory position = positions[msg.sender];
        require(position.notional > 0, "No position to close");
        
        uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        
        int256 pnl = calculatePnl(position, currentShare);
        
        delete positions[msg.sender];
        
        if (pnl > 0) {
            balances[msg.sender] += uint256(pnl);
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            if (loss > balances[msg.sender]) {
                balances[msg.sender] = 0;
            } else {
                balances[msg.sender] -= loss;
            }
        }
        
        emit PositionClosed(msg.sender, pnl);
    }
    
    function calculatePnl(Position memory position, uint256 currentShare) internal pure returns (int256) {
        int256 shareChange = int256(currentShare) - int256(position.entryShare);
        
        int256 pnl = (int256(position.notional) * shareChange) / 1e18;
        
        if (!position.isLong) {
            pnl = -pnl;
        }
        
        return pnl;
    }
    
    function getPositionValue(address user) external view returns (int256) {
        Position memory position = positions[user];
        if (position.notional == 0) {
            return 0;
        }
        
        uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        return calculatePnl(position, currentShare);
    }
}