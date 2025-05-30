// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";
import "./RatioOracle.sol";
import "./TokenRegistry.sol";

contract SimplePerpV3Enhanced {
    // Structs
    struct Position {
        uint256 openTimestamp;
        uint256 entryRatioETHBTC;  // Store entry ratio for PnL calc
        uint256 totalNotional;
        uint256 marginUsed;
        bool isActive;
    }
    
    struct ProtocolStats {
        uint256 totalDeposits;
        uint256 totalOpenInterest;
        uint256 activeUsers;
        uint256 totalPositions;
        uint256 lastUpdateBlock;
    }
    
    // Core contracts
    IERC20 public immutable collateralToken;
    RatioOracle public immutable oracle;
    TokenRegistry public immutable tokenRegistry;
    
    // Vector-based exposure tracking
    mapping(address => mapping(uint16 => int256)) public userExposure;
    mapping(uint16 => int256) public tokenNetExposure;
    
    // User accounting
    mapping(address => uint256) public balances;
    mapping(address => Position) public positions;
    
    // Protocol state
    address public owner;
    bool public paused;
    ProtocolStats public protocolStats;
    
    // Risk parameters
    uint256 public constant MAX_LEVERAGE = 10;
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80% in bps
    uint256 public constant LIQUIDATION_PENALTY = 500; // 5% in bps
    
    // Enhanced Events
    event Deposit(
        address indexed user, 
        uint256 amount, 
        uint256 newBalance,
        uint256 freeMargin,
        uint256 timestamp
    );
    
    event Withdraw(
        address indexed user, 
        uint256 amount, 
        uint256 newBalance,
        uint256 timestamp
    );
    
    event TradeExecuted(
        address indexed user,
        uint16[] tokenIds,
        int256[] exposureDeltas,
        uint256 requiredMargin,
        uint256 entryRatio,
        uint256 totalNotional,
        uint256 timestamp
    );
    
    event ExposureUpdated(
        address indexed user,
        uint16 indexed tokenId,
        int256 oldExposure,
        int256 newExposure,
        int256 delta
    );
    
    event PositionClosed(
        address indexed user,
        int256 realizedPnl,
        uint256 closingRatio,
        uint256 timestamp
    );
    
    event MarginUpdated(
        address indexed user,
        uint256 oldMargin,
        uint256 newMargin,
        uint256 marginRatio
    );
    
    event ProtocolPaused(address indexed by, uint256 timestamp);
    event ProtocolUnpaused(address indexed by, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    event NetExposureUpdated(
        uint16 indexed tokenId,
        int256 oldNetExposure,
        int256 newNetExposure
    );
    
    event LiquidationAlert(
        address indexed user,
        uint256 marginRatio,
        uint256 requiredMargin
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor(address _collateralToken, address _oracle, address _tokenRegistry) {
        collateralToken = IERC20(_collateralToken);
        oracle = RatioOracle(_oracle);
        tokenRegistry = TokenRegistry(_tokenRegistry);
        owner = msg.sender;
    }
    
    // Core functions with enhanced events
    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        protocolStats.totalDeposits += amount;
        
        uint256 freeMargin = getFreeMargin(msg.sender);
        
        emit Deposit(msg.sender, amount, balances[msg.sender], freeMargin, block.timestamp);
    }
    
    function withdraw(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(!positions[msg.sender].isActive, "Cannot withdraw with open position");
        
        balances[msg.sender] -= amount;
        protocolStats.totalDeposits -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount, balances[msg.sender], block.timestamp);
    }
    
    function openPosition(
        uint16[] memory tokenIds,
        int256[] memory notionals
    ) external whenNotPaused {
        require(tokenIds.length == notionals.length, "Array length mismatch");
        require(tokenIds.length > 0 && tokenIds.length <= 8, "Invalid basket size");
        require(!positions[msg.sender].isActive, "Position already open");
        
        uint256 totalNotional = calculateTotalNotional(notionals);
        uint256 requiredMargin = calculateRequiredMargin(tokenIds, notionals);
        require(balances[msg.sender] >= requiredMargin, "Insufficient margin");
        
        uint256 leverage = (totalNotional * 10000) / balances[msg.sender];
        require(leverage <= MAX_LEVERAGE * 10000, "Leverage too high");
        
        // Get entry ratio for PnL tracking
        uint256 entryRatio = oracle.getRatioShare("ETH", "BTC");
        
        // Update exposures with events
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenRegistry.isValidToken(tokenIds[i]), "Invalid token");
            require(notionals[i] != 0, "Zero notional");
            
            int256 oldExposure = userExposure[msg.sender][tokenIds[i]];
            int256 newExposure = oldExposure + notionals[i];
            userExposure[msg.sender][tokenIds[i]] = newExposure;
            
            int256 oldNetExposure = tokenNetExposure[tokenIds[i]];
            tokenNetExposure[tokenIds[i]] += notionals[i];
            
            emit ExposureUpdated(msg.sender, tokenIds[i], oldExposure, newExposure, notionals[i]);
            emit NetExposureUpdated(tokenIds[i], oldNetExposure, oldNetExposure + notionals[i]);
        }
        
        // Update position
        positions[msg.sender] = Position({
            openTimestamp: block.timestamp,
            entryRatioETHBTC: entryRatio,
            totalNotional: totalNotional,
            marginUsed: requiredMargin,
            isActive: true
        });
        
        // Update protocol stats
        protocolStats.totalOpenInterest += totalNotional;
        if (!positions[msg.sender].isActive) {
            protocolStats.activeUsers++;
        }
        protocolStats.totalPositions++;
        
        emit TradeExecuted(
            msg.sender,
            tokenIds,
            notionals,
            requiredMargin,
            entryRatio,
            totalNotional,
            block.timestamp
        );
        
        // Check margin health
        uint256 marginRatio = getMarginRatio(msg.sender);
        if (marginRatio < LIQUIDATION_THRESHOLD) {
            emit LiquidationAlert(msg.sender, marginRatio, requiredMargin);
        }
    }
    
    function closePosition() external {
        Position memory position = positions[msg.sender];
        require(position.isActive, "No position to close");
        
        uint256 currentRatio = oracle.getRatioShare("ETH", "BTC");
        int256 totalPnl = calculatePositionPnl(msg.sender);
        
        // Clear all exposures
        uint16 maxTokens = tokenRegistry.nextTokenId();
        for (uint16 tokenId = 0; tokenId < maxTokens; tokenId++) {
            int256 exposure = userExposure[msg.sender][tokenId];
            if (exposure != 0) {
                int256 oldNetExposure = tokenNetExposure[tokenId];
                tokenNetExposure[tokenId] -= exposure;
                userExposure[msg.sender][tokenId] = 0;
                
                emit ExposureUpdated(msg.sender, tokenId, exposure, 0, -exposure);
                emit NetExposureUpdated(tokenId, oldNetExposure, oldNetExposure - exposure);
            }
        }
        
        // Update balances
        if (totalPnl > 0) {
            balances[msg.sender] += uint256(totalPnl);
        } else if (totalPnl < 0) {
            uint256 loss = uint256(-totalPnl);
            if (loss > balances[msg.sender]) {
                balances[msg.sender] = 0;
            } else {
                balances[msg.sender] -= loss;
            }
        }
        
        // Update protocol stats
        protocolStats.totalOpenInterest -= position.totalNotional;
        protocolStats.activeUsers--;
        
        // Clear position
        delete positions[msg.sender];
        
        emit PositionClosed(msg.sender, totalPnl, currentRatio, block.timestamp);
    }
    
    // Enhanced view functions
    function getUserPosition(address user) external view returns (
        uint16[] memory tokenIds,
        int256[] memory exposures,
        uint256 totalNotional,
        uint256 marginUsed,
        uint256 freeMargin,
        int256 unrealizedPnl,
        uint256 marginRatio,
        bool isLiquidatable
    ) {
        Position memory position = positions[user];
        
        if (!position.isActive) {
            return (new uint16[](0), new int256[](0), 0, 0, balances[user], 0, 0, false);
        }
        
        (tokenIds, exposures) = getUserExposures(user);
        totalNotional = position.totalNotional;
        marginUsed = position.marginUsed;
        freeMargin = getFreeMargin(user);
        unrealizedPnl = calculatePositionPnl(user);
        marginRatio = getMarginRatio(user);
        isLiquidatable = marginRatio < LIQUIDATION_THRESHOLD;
    }
    
    function getGlobalExposures() external view returns (
        uint16[] memory activeTokens,
        int256[] memory exposures
    ) {
        uint16 maxTokens = tokenRegistry.nextTokenId();
        uint16[] memory tempTokens = new uint16[](maxTokens);
        int256[] memory tempExposures = new int256[](maxTokens);
        uint256 count = 0;
        
        for (uint16 i = 0; i < maxTokens; i++) {
            if (tokenNetExposure[i] != 0) {
                tempTokens[count] = i;
                tempExposures[count] = tokenNetExposure[i];
                count++;
            }
        }
        
        activeTokens = new uint16[](count);
        exposures = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            activeTokens[i] = tempTokens[i];
            exposures[i] = tempExposures[i];
        }
    }
    
    function getProtocolStats() external view returns (
        uint256 totalDeposits,
        uint256 totalOpenInterest,
        uint256 activeUsers,
        uint256 totalPositions,
        uint256 utilizationRate,
        bool isPaused
    ) {
        totalDeposits = protocolStats.totalDeposits;
        totalOpenInterest = protocolStats.totalOpenInterest;
        activeUsers = protocolStats.activeUsers;
        totalPositions = protocolStats.totalPositions;
        utilizationRate = totalDeposits > 0 ? (totalOpenInterest * 10000) / totalDeposits : 0;
        isPaused = paused;
    }
    
    function getTokenMetrics(uint16 tokenId) external view returns (
        int256 netExposure,
        uint256 totalLongExposure,
        uint256 totalShortExposure,
        uint256 openInterest
    ) {
        netExposure = tokenNetExposure[tokenId];
        
        if (netExposure > 0) {
            totalLongExposure = uint256(netExposure);
            totalShortExposure = 0;
        } else {
            totalLongExposure = 0;
            totalShortExposure = uint256(-netExposure);
        }
        
        openInterest = totalLongExposure + totalShortExposure;
    }
    
    function simulateOpenPosition(
        address user,
        uint16[] memory tokenIds,
        int256[] memory notionals
    ) external view returns (
        uint256 requiredMargin,
        uint256 totalNotional,
        uint256 resultingLeverage,
        bool canOpen
    ) {
        requiredMargin = calculateRequiredMargin(tokenIds, notionals);
        totalNotional = calculateTotalNotional(notionals);
        
        uint256 userBalance = balances[user];
        if (userBalance > 0) {
            resultingLeverage = (totalNotional * 10000) / userBalance;
        }
        
        canOpen = !positions[user].isActive && 
                  userBalance >= requiredMargin && 
                  resultingLeverage <= MAX_LEVERAGE * 10000;
    }
    
    // Helper functions
    function calculateRequiredMargin(
        uint16[] memory tokenIds,
        int256[] memory notionals
    ) public view returns (uint256) {
        uint256 margin = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            (, , uint16 riskWeight, ,) = tokenRegistry.tokens(tokenIds[i]);
            uint256 absNotional = notionals[i] >= 0 ? uint256(notionals[i]) : uint256(-notionals[i]);
            margin += (absNotional * riskWeight) / 10000;
        }
        
        return margin;
    }
    
    function calculateTotalNotional(int256[] memory notionals) internal pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < notionals.length; i++) {
            total += notionals[i] >= 0 ? uint256(notionals[i]) : uint256(-notionals[i]);
        }
        return total;
    }
    
    function calculatePositionPnl(address user) public view returns (int256) {
        Position memory position = positions[user];
        if (!position.isActive) return 0;
        
        uint256 currentRatio = oracle.getRatioShare("ETH", "BTC");
        int256 ratioChange = int256(currentRatio) - int256(position.entryRatioETHBTC);
        
        int256 ethExposure = userExposure[user][0];
        if (ethExposure != 0) {
            return (ethExposure * ratioChange) / 1e18;
        }
        
        return 0;
    }
    
    function getFreeMargin(address user) public view returns (uint256) {
        Position memory position = positions[user];
        if (!position.isActive) {
            return balances[user];
        }
        
        int256 unrealizedPnl = calculatePositionPnl(user);
        uint256 equity = unrealizedPnl > 0 ? 
            balances[user] + uint256(unrealizedPnl) : 
            balances[user] - uint256(-unrealizedPnl);
            
        return equity > position.marginUsed ? equity - position.marginUsed : 0;
    }
    
    function getMarginRatio(address user) public view returns (uint256) {
        Position memory position = positions[user];
        if (!position.isActive) return type(uint256).max;
        
        int256 unrealizedPnl = calculatePositionPnl(user);
        uint256 equity = unrealizedPnl > 0 ? 
            balances[user] + uint256(unrealizedPnl) : 
            balances[user] - uint256(-unrealizedPnl);
            
        return position.marginUsed > 0 ? (equity * 10000) / position.marginUsed : 0;
    }
    
    function isLiquidatable(address user) external view returns (bool) {
        return getMarginRatio(user) < LIQUIDATION_THRESHOLD;
    }
    
    function getUserExposures(address user) public view returns (
        uint16[] memory tokenIds,
        int256[] memory exposures
    ) {
        uint16 maxTokens = tokenRegistry.nextTokenId();
        uint16[] memory tempTokens = new uint16[](maxTokens);
        int256[] memory tempExposures = new int256[](maxTokens);
        uint256 count = 0;
        
        for (uint16 i = 0; i < maxTokens; i++) {
            if (userExposure[user][i] != 0) {
                tempTokens[count] = i;
                tempExposures[count] = userExposure[user][i];
                count++;
            }
        }
        
        tokenIds = new uint16[](count);
        exposures = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempTokens[i];
            exposures[i] = tempExposures[i];
        }
    }
    
    // Admin functions
    function pause() external onlyOwner {
        paused = true;
        emit ProtocolPaused(msg.sender, block.timestamp);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit ProtocolUnpaused(msg.sender, block.timestamp);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}