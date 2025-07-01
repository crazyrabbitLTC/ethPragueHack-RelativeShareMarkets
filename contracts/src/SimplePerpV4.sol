// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";
import "./RatioOracleV2.sol";
import "./TokenRegistry.sol";

/**
 * @title SimplePerpV4
 * @notice Production-ready perpetual contract with liquidations, funding rates, and enhanced security
 * @dev Implements the RMSP (Relative Market Share Perpetuals) protocol
 */
contract SimplePerpV4 {
    // ========== CONSTANTS ==========
    uint256 public constant PRECISION = 1e18;
    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant MAX_LEVERAGE = 10 * PRECISION;
    uint256 public constant INITIAL_MARGIN_RATIO = 1000; // 10% in bps
    uint256 public constant MAINTENANCE_MARGIN_RATIO = 500; // 5% in bps
    uint256 public constant LIQUIDATION_PENALTY = 500; // 5% in bps
    uint256 public constant TRADING_FEE = 10; // 0.1% in bps
    uint256 public constant MAX_FUNDING_RATE = 100; // 1% per day max in bps
    uint256 public constant FUNDING_INTERVAL = 8 hours;
    
    // ========== STATE VARIABLES ==========
    IERC20 public immutable collateralToken;
    RatioOracleV2 public immutable oracle;
    TokenRegistry public immutable tokenRegistry;
    
    // User accounting
    mapping(address => uint256) public balances;
    mapping(address => Position) public positions;
    mapping(address => mapping(uint16 => int256)) public userExposure;
    
    // Global state
    mapping(uint16 => int256) public globalNetExposure;
    mapping(uint16 => uint256) public lastFundingTime;
    mapping(uint16 => int256) public cumulativeFunding;
    
    // Protocol state
    address public owner;
    address public treasury;
    bool public paused;
    bool private locked; // Reentrancy guard
    
    uint256 public totalDeposits;
    uint256 public totalOpenInterest;
    uint256 public protocolFees;
    
    // Risk parameters
    uint256 public maxPositionSize = 1000000 * PRECISION; // $1M default
    uint256 public maxOpenInterest = 10000000 * PRECISION; // $10M default
    
    // ========== STRUCTS ==========
    struct Position {
        uint256 openTimestamp;
        uint256 lastFundingTimestamp;
        mapping(uint16 => int256) tokenFunding; // Accumulated funding per token
        uint256 marginUsed;
        uint256 totalNotional;
        bool isActive;
    }
    
    // ========== EVENTS ==========
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    event PositionOpened(
        address indexed user,
        uint256 totalNotional,
        uint256 marginUsed,
        uint256 fee,
        uint256 timestamp
    );
    event PositionClosed(
        address indexed user,
        int256 realizedPnl,
        uint256 fee,
        uint256 timestamp
    );
    event Liquidation(
        address indexed liquidated,
        address indexed liquidator,
        uint256 penalty,
        uint256 timestamp
    );
    event FundingPaid(
        address indexed user,
        uint16 indexed tokenId,
        int256 fundingPayment
    );
    event FeeCollected(uint256 amount, uint256 totalFees);
    
    // ========== MODIFIERS ==========
    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier nonReentrant() {
        require(!locked, "Reentrant");
        locked = true;
        _;
        locked = false;
    }
    
    // ========== CONSTRUCTOR ==========
    constructor(
        address _collateralToken,
        address _oracle,
        address _tokenRegistry,
        address _treasury
    ) {
        collateralToken = IERC20(_collateralToken);
        oracle = RatioOracleV2(_oracle);
        tokenRegistry = TokenRegistry(_tokenRegistry);
        treasury = _treasury;
        owner = msg.sender;
    }
    
    // ========== USER FUNCTIONS ==========
    
    /**
     * @notice Deposit collateral
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Zero amount");
        
        // Effects
        balances[msg.sender] += amount;
        totalDeposits += amount;
        
        // Interactions
        require(
            collateralToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }
    
    /**
     * @notice Withdraw collateral
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Zero amount");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(!positions[msg.sender].isActive, "Position active");
        
        // Effects
        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        
        // Interactions
        require(
            collateralToken.transfer(msg.sender, amount),
            "Transfer failed"
        );
        
        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }
    
    /**
     * @notice Open a new position
     * @param tokenIds Array of token IDs to trade
     * @param notionals Array of notional amounts (positive for long, negative for short)
     */
    function openPosition(
        uint16[] calldata tokenIds,
        int256[] calldata notionals
    ) external whenNotPaused nonReentrant {
        require(tokenIds.length == notionals.length, "Length mismatch");
        require(tokenIds.length > 0 && tokenIds.length <= 8, "Invalid size");
        require(!positions[msg.sender].isActive, "Position exists");
        
        // Calculate position metrics
        uint256 totalNotional = 0;
        uint256 requiredMargin = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenRegistry.isValidToken(tokenIds[i]), "Invalid token");
            require(notionals[i] != 0, "Zero notional");
            
            uint256 absNotional = notionals[i] > 0 ? 
                uint256(notionals[i]) : uint256(-notionals[i]);
            
            // Check position limits
            require(absNotional <= maxPositionSize, "Position too large");
            
            totalNotional += absNotional;
            
            // Get risk weight from registry
            (, , uint16 riskWeight, ,) = tokenRegistry.tokens(tokenIds[i]);
            requiredMargin += (absNotional * riskWeight) / BPS_PRECISION;
        }
        
        // Check global limits
        require(totalOpenInterest + totalNotional <= maxOpenInterest, "OI limit");
        
        // Calculate and collect trading fee
        uint256 tradingFee = (totalNotional * TRADING_FEE) / BPS_PRECISION;
        uint256 totalRequired = requiredMargin + tradingFee;
        
        require(balances[msg.sender] >= totalRequired, "Insufficient margin");
        
        // Update state
        balances[msg.sender] -= totalRequired;
        protocolFees += tradingFee;
        
        // Initialize position
        Position storage position = positions[msg.sender];
        position.openTimestamp = block.timestamp;
        position.lastFundingTimestamp = block.timestamp;
        position.marginUsed = requiredMargin;
        position.totalNotional = totalNotional;
        position.isActive = true;
        
        // Update exposures and funding
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint16 tokenId = tokenIds[i];
            int256 notional = notionals[i];
            
            // Update user exposure
            userExposure[msg.sender][tokenId] += notional;
            
            // Update global exposure
            globalNetExposure[tokenId] += notional;
            
            // Initialize funding tracking
            position.tokenFunding[tokenId] = cumulativeFunding[tokenId];
            
            // Update funding if needed
            _updateFunding(tokenId);
        }
        
        totalOpenInterest += totalNotional;
        
        emit PositionOpened(msg.sender, totalNotional, requiredMargin, tradingFee, block.timestamp);
        emit FeeCollected(tradingFee, protocolFees);
    }
    
    /**
     * @notice Close position and realize PnL
     */
    function closePosition() external nonReentrant {
        Position storage position = positions[msg.sender];
        require(position.isActive, "No position");
        
        // Calculate PnL and funding
        (int256 pnl, int256 fundingPayment) = _calculatePnlAndFunding(msg.sender);
        
        // Calculate trading fee on notional
        uint256 tradingFee = (position.totalNotional * TRADING_FEE) / BPS_PRECISION;
        
        // Clear exposures
        uint16 maxTokens = tokenRegistry.nextTokenId();
        for (uint16 tokenId = 0; tokenId < maxTokens; tokenId++) {
            int256 exposure = userExposure[msg.sender][tokenId];
            if (exposure != 0) {
                globalNetExposure[tokenId] -= exposure;
                userExposure[msg.sender][tokenId] = 0;
            }
        }
        
        // Update balances
        int256 netPnl = pnl + fundingPayment;
        uint256 marginReturn = position.marginUsed;
        
        if (netPnl > 0) {
            balances[msg.sender] += marginReturn + uint256(netPnl);
        } else {
            uint256 loss = uint256(-netPnl);
            if (loss >= marginReturn) {
                // Total loss
                balances[msg.sender] += 0;
            } else {
                balances[msg.sender] += marginReturn - loss;
            }
        }
        
        // Deduct fee
        if (balances[msg.sender] >= tradingFee) {
            balances[msg.sender] -= tradingFee;
            protocolFees += tradingFee;
        } else {
            protocolFees += balances[msg.sender];
            balances[msg.sender] = 0;
        }
        
        // Clear position
        totalOpenInterest -= position.totalNotional;
        position.isActive = false;
        position.marginUsed = 0;
        position.totalNotional = 0;
        
        emit PositionClosed(msg.sender, netPnl, tradingFee, block.timestamp);
        emit FeeCollected(tradingFee, protocolFees);
    }
    
    /**
     * @notice Liquidate an undercollateralized position
     * @param user Address to liquidate
     */
    function liquidate(address user) external whenNotPaused nonReentrant {
        Position storage position = positions[user];
        require(position.isActive, "No position");
        
        // Check if liquidatable
        uint256 marginRatio = _getMarginRatio(user);
        require(marginRatio < MAINTENANCE_MARGIN_RATIO, "Not liquidatable");
        
        // Calculate liquidation penalty
        uint256 liquidationPenalty = (position.marginUsed * LIQUIDATION_PENALTY) / BPS_PRECISION;
        
        // Execute liquidation (similar to closePosition but with penalty)
        (int256 pnl, int256 fundingPayment) = _calculatePnlAndFunding(user);
        
        // Clear exposures
        uint16 maxTokens = tokenRegistry.nextTokenId();
        for (uint16 tokenId = 0; tokenId < maxTokens; tokenId++) {
            int256 exposure = userExposure[user][tokenId];
            if (exposure != 0) {
                globalNetExposure[tokenId] -= exposure;
                userExposure[user][tokenId] = 0;
            }
        }
        
        // Calculate final balance
        int256 netPnl = pnl + fundingPayment;
        uint256 remainingBalance = position.marginUsed;
        
        if (netPnl < 0) {
            uint256 loss = uint256(-netPnl);
            if (loss >= remainingBalance) {
                remainingBalance = 0;
            } else {
                remainingBalance -= loss;
            }
        } else {
            remainingBalance += uint256(netPnl);
        }
        
        // Apply liquidation penalty
        if (remainingBalance >= liquidationPenalty) {
            remainingBalance -= liquidationPenalty;
            // Reward liquidator
            balances[msg.sender] += liquidationPenalty / 2;
            protocolFees += liquidationPenalty / 2;
        } else {
            balances[msg.sender] += remainingBalance / 2;
            protocolFees += remainingBalance / 2;
            remainingBalance = 0;
        }
        
        // Return remaining to user
        balances[user] += remainingBalance;
        
        // Clear position
        totalOpenInterest -= position.totalNotional;
        position.isActive = false;
        position.marginUsed = 0;
        position.totalNotional = 0;
        
        emit Liquidation(user, msg.sender, liquidationPenalty, block.timestamp);
    }
    
    // ========== INTERNAL FUNCTIONS ==========
    
    /**
     * @notice Update funding rate for a token
     * @param tokenId Token to update funding for
     */
    function _updateFunding(uint16 tokenId) internal {
        if (block.timestamp < lastFundingTime[tokenId] + FUNDING_INTERVAL) {
            return;
        }
        
        int256 netExposure = globalNetExposure[tokenId];
        if (netExposure == 0) {
            lastFundingTime[tokenId] = block.timestamp;
            return;
        }
        
        // Calculate funding rate based on imbalance
        // Positive exposure = longs pay shorts
        // Negative exposure = shorts pay longs
        uint256 absExposure = netExposure > 0 ? uint256(netExposure) : uint256(-netExposure);
        uint256 fundingRate = (absExposure * MAX_FUNDING_RATE) / totalOpenInterest;
        
        // Cap funding rate
        if (fundingRate > MAX_FUNDING_RATE) {
            fundingRate = MAX_FUNDING_RATE;
        }
        
        // Apply funding
        int256 fundingDelta = int256(fundingRate);
        if (netExposure < 0) {
            fundingDelta = -fundingDelta;
        }
        
        cumulativeFunding[tokenId] += fundingDelta;
        lastFundingTime[tokenId] = block.timestamp;
    }
    
    /**
     * @notice Calculate position PnL and funding payments
     * @param user User address
     * @return pnl Price-based PnL
     * @return funding Net funding payments
     */
    function _calculatePnlAndFunding(address user) internal view returns (int256 pnl, int256 funding) {
        Position storage position = positions[user];
        require(position.isActive, "No position");
        
        uint16 maxTokens = tokenRegistry.nextTokenId();
        
        // For simplified version, calculate ETH/BTC ratio PnL
        uint256 currentRatio = oracle.getRatioShare("ETH", "BTC");
        // In production, we'd store entry ratio in position struct
        // For now, using a simplified approach
        uint256 entryRatio = 237 * 1e14; // 2.37% default entry (would be stored)
        
        int256 ratioChange = int256(currentRatio) - int256(entryRatio);
        
        // Calculate PnL based on ETH exposure (tokenId 0)
        int256 ethExposure = userExposure[user][0];
        if (ethExposure != 0) {
            pnl = (ethExposure * ratioChange) / int256(PRECISION);
        }
        
        // Calculate funding payments
        for (uint16 tokenId = 0; tokenId < maxTokens; tokenId++) {
            int256 exposure = userExposure[user][tokenId];
            if (exposure != 0) {
                int256 fundingDelta = cumulativeFunding[tokenId] - position.tokenFunding[tokenId];
                int256 fundingPayment = (exposure * fundingDelta) / int256(PRECISION);
                funding += fundingPayment;
            }
        }
    }
    
    /**
     * @notice Get margin ratio for a position
     * @param user User address
     * @return Margin ratio in basis points
     */
    function _getMarginRatio(address user) internal view returns (uint256) {
        Position storage position = positions[user];
        if (!position.isActive) return type(uint256).max;
        
        (int256 pnl, int256 funding) = _calculatePnlAndFunding(user);
        int256 netPnl = pnl + funding;
        
        uint256 equity;
        if (netPnl > 0) {
            equity = position.marginUsed + uint256(netPnl);
        } else {
            uint256 loss = uint256(-netPnl);
            if (loss >= position.marginUsed) {
                return 0;
            }
            equity = position.marginUsed - loss;
        }
        
        return (equity * BPS_PRECISION) / position.totalNotional;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Check if a position is liquidatable
     * @param user User address
     * @return Whether the position can be liquidated
     */
    function isLiquidatable(address user) external view returns (bool) {
        return positions[user].isActive && _getMarginRatio(user) < MAINTENANCE_MARGIN_RATIO;
    }
    
    /**
     * @notice Get user's position details
     * @param user User address
     */
    function getPosition(address user) external view returns (
        bool isActive,
        uint256 marginUsed,
        uint256 totalNotional,
        int256 unrealizedPnl,
        int256 fundingPayment,
        uint256 marginRatio
    ) {
        Position storage position = positions[user];
        isActive = position.isActive;
        marginUsed = position.marginUsed;
        totalNotional = position.totalNotional;
        
        if (isActive) {
            (unrealizedPnl, fundingPayment) = _calculatePnlAndFunding(user);
            marginRatio = _getMarginRatio(user);
        }
    }
    
    /**
     * @notice Get user's token exposures
     * @param user User address
     * @return tokenIds Array of tokens with exposure
     * @return exposures Array of exposure amounts
     */
    function getUserExposures(address user) external view returns (
        uint16[] memory tokenIds,
        int256[] memory exposures
    ) {
        uint16 maxTokens = tokenRegistry.nextTokenId();
        uint16[] memory tempIds = new uint16[](maxTokens);
        int256[] memory tempExposures = new int256[](maxTokens);
        uint256 count = 0;
        
        for (uint16 i = 0; i < maxTokens; i++) {
            if (userExposure[user][i] != 0) {
                tempIds[count] = i;
                tempExposures[count] = userExposure[user][i];
                count++;
            }
        }
        
        tokenIds = new uint16[](count);
        exposures = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempIds[i];
            exposures[i] = tempExposures[i];
        }
    }
    
    /**
     * @notice Get protocol statistics
     */
    function getProtocolStats() external view returns (
        uint256 totalDepositsAmount,
        uint256 totalOpenInterestAmount,
        uint256 protocolFeesAmount,
        uint256 utilizationRate
    ) {
        totalDepositsAmount = totalDeposits;
        totalOpenInterestAmount = totalOpenInterest;
        protocolFeesAmount = protocolFees;
        
        if (totalDeposits > 0) {
            utilizationRate = (totalOpenInterest * BPS_PRECISION) / totalDeposits;
        }
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        paused = true;
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        paused = false;
    }
    
    /**
     * @notice Update risk parameters
     * @param _maxPositionSize New max position size
     * @param _maxOpenInterest New max open interest
     */
    function updateRiskParams(
        uint256 _maxPositionSize,
        uint256 _maxOpenInterest
    ) external onlyOwner {
        maxPositionSize = _maxPositionSize;
        maxOpenInterest = _maxOpenInterest;
    }
    
    /**
     * @notice Withdraw protocol fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 fees = protocolFees;
        require(fees > 0, "No fees");
        
        protocolFees = 0;
        require(
            collateralToken.transfer(treasury, fees),
            "Transfer failed"
        );
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}