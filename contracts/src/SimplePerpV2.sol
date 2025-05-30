// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";
import "./RatioOracle.sol";

contract SimplePerpV2 {
    struct Position {
        string baseToken;
        string quoteToken;
        uint256 notional;
        bool isLong;
        uint256 entryShare;
        uint256 openedAt;
        uint256 lastUpdated;
    }
    
    struct UserInfo {
        uint256 balance;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 realizedPnl;
        uint256 positionCount;
    }
    
    IERC20 public immutable collateralToken;
    RatioOracle public immutable oracle;
    
    uint256 public constant INITIAL_MARGIN_RATIO = 30;
    uint256 public constant PRECISION = 100;
    
    mapping(address => uint256) public balances;
    mapping(address => Position) public positions;
    mapping(address => UserInfo) public userInfo;
    
    address public owner;
    bool public paused;
    
    uint256 public totalDeposits;
    uint256 public totalOpenInterest;
    uint256 public totalPositions;
    
    // Enhanced events
    event Deposit(
        address indexed user, 
        uint256 amount, 
        uint256 newBalance,
        uint256 timestamp
    );
    
    event Withdraw(
        address indexed user, 
        uint256 amount, 
        uint256 newBalance,
        uint256 timestamp
    );
    
    event PositionOpened(
        address indexed user,
        string baseToken,
        string quoteToken,
        uint256 notional,
        bool isLong,
        uint256 entryShare,
        uint256 requiredMargin,
        uint256 timestamp
    );
    
    event PositionClosed(
        address indexed user,
        string baseToken,
        string quoteToken,
        uint256 notional,
        bool isLong,
        uint256 entryShare,
        uint256 exitShare,
        int256 pnl,
        uint256 closedAt
    );
    
    event PositionUpdated(
        address indexed user,
        uint256 currentShare,
        int256 unrealizedPnl,
        uint256 timestamp
    );
    
    event EmergencyPause(address indexed by, uint256 timestamp);
    event Unpause(address indexed by, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor(address _collateralToken, address _oracle) {
        collateralToken = IERC20(_collateralToken);
        oracle = RatioOracle(_oracle);
        owner = msg.sender;
    }
    
    // Admin functions
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(msg.sender, block.timestamp);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpause(msg.sender, block.timestamp);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    // Core functions
    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        
        userInfo[msg.sender].balance = balances[msg.sender];
        userInfo[msg.sender].totalDeposited += amount;
        
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount, balances[msg.sender], block.timestamp);
    }
    
    function withdraw(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(positions[msg.sender].notional == 0, "Cannot withdraw with open position");
        
        balances[msg.sender] -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        userInfo[msg.sender].balance = balances[msg.sender];
        userInfo[msg.sender].totalWithdrawn += amount;
        
        totalDeposits -= amount;
        
        emit Withdraw(msg.sender, amount, balances[msg.sender], block.timestamp);
    }
    
    function openPosition(
        string memory baseToken,
        string memory quoteToken,
        uint256 notional,
        bool isLong
    ) external whenNotPaused {
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
            entryShare: entryShare,
            openedAt: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        userInfo[msg.sender].positionCount++;
        totalOpenInterest += notional;
        totalPositions++;
        
        emit PositionOpened(
            msg.sender,
            baseToken,
            quoteToken,
            notional,
            isLong,
            entryShare,
            requiredMargin,
            block.timestamp
        );
    }
    
    function closePosition() external {
        Position memory position = positions[msg.sender];
        require(position.notional > 0, "No position to close");
        
        uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        
        int256 pnl = calculatePnl(position, currentShare);
        
        delete positions[msg.sender];
        
        if (pnl > 0) {
            balances[msg.sender] += uint256(pnl);
            userInfo[msg.sender].realizedPnl += uint256(pnl);
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            if (loss > balances[msg.sender]) {
                balances[msg.sender] = 0;
            } else {
                balances[msg.sender] -= loss;
            }
        }
        
        userInfo[msg.sender].balance = balances[msg.sender];
        totalOpenInterest -= position.notional;
        totalPositions--;
        
        emit PositionClosed(
            msg.sender,
            position.baseToken,
            position.quoteToken,
            position.notional,
            position.isLong,
            position.entryShare,
            currentShare,
            pnl,
            block.timestamp
        );
    }
    
    function updatePositionTracking(address user) external {
        Position storage position = positions[user];
        require(position.notional > 0, "No position");
        
        uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        int256 unrealizedPnl = calculatePnl(position, currentShare);
        
        position.lastUpdated = block.timestamp;
        
        emit PositionUpdated(user, currentShare, unrealizedPnl, block.timestamp);
    }
    
    function calculatePnl(Position memory position, uint256 currentShare) internal pure returns (int256) {
        int256 shareChange = int256(currentShare) - int256(position.entryShare);
        
        int256 pnl = (int256(position.notional) * shareChange) / 1e18;
        
        if (!position.isLong) {
            pnl = -pnl;
        }
        
        return pnl;
    }
    
    // View functions
    function getPositionValue(address user) external view returns (int256) {
        Position memory position = positions[user];
        if (position.notional == 0) {
            return 0;
        }
        
        uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        return calculatePnl(position, currentShare);
    }
    
    function getPositionDetails(address user) external view returns (
        string memory baseToken,
        string memory quoteToken,
        uint256 notional,
        bool isLong,
        uint256 entryShare,
        uint256 currentShare,
        int256 unrealizedPnl,
        uint256 openedAt,
        uint256 duration
    ) {
        Position memory position = positions[user];
        require(position.notional > 0, "No position");
        
        currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
        unrealizedPnl = calculatePnl(position, currentShare);
        
        return (
            position.baseToken,
            position.quoteToken,
            position.notional,
            position.isLong,
            position.entryShare,
            currentShare,
            unrealizedPnl,
            position.openedAt,
            block.timestamp - position.openedAt
        );
    }
    
    function getUserDetails(address user) external view returns (
        uint256 balance,
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 realizedPnl,
        uint256 positionCount,
        bool hasOpenPosition,
        int256 unrealizedPnl
    ) {
        UserInfo memory info = userInfo[user];
        Position memory position = positions[user];
        
        hasOpenPosition = position.notional > 0;
        
        if (hasOpenPosition) {
            uint256 currentShare = oracle.getRatioShare(position.baseToken, position.quoteToken);
            unrealizedPnl = calculatePnl(position, currentShare);
        }
        
        return (
            balances[user],
            info.totalDeposited,
            info.totalWithdrawn,
            info.realizedPnl,
            info.positionCount,
            hasOpenPosition,
            unrealizedPnl
        );
    }
    
    function getProtocolStats() external view returns (
        uint256 totalDepositAmount,
        uint256 totalOpenInterestAmount,
        uint256 totalPositionCount,
        address collateralTokenAddress,
        bool isPaused
    ) {
        return (
            totalDeposits,
            totalOpenInterest,
            totalPositions,
            address(collateralToken),
            paused
        );
    }
    
    function getMarginRequirement(uint256 notional) external pure returns (uint256) {
        return (notional * INITIAL_MARGIN_RATIO) / PRECISION;
    }
    
    function canOpenPosition(address user, uint256 notional) external view returns (bool) {
        if (paused || positions[user].notional > 0) {
            return false;
        }
        
        uint256 requiredMargin = (notional * INITIAL_MARGIN_RATIO) / PRECISION;
        return balances[user] >= requiredMargin;
    }
}