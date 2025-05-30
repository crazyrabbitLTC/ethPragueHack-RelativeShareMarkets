// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/interfaces/IERC20.sol";
import "./RatioOracle.sol";
import "./TokenRegistry.sol";

contract SimplePerpV3 {
    // Core contracts
    IERC20 public immutable collateralToken;
    RatioOracle public immutable oracle;
    TokenRegistry public immutable tokenRegistry;
    
    // Vector-based exposure tracking
    mapping(address => mapping(uint16 => int256)) public userExposure; // user -> tokenId -> signed notional
    mapping(uint16 => int256) public tokenNetExposure; // tokenId -> system net exposure
    
    // User accounting
    mapping(address => uint256) public balances;
    mapping(address => uint256) public usedMargin;
    mapping(address => bool) public hasPosition;
    
    // Protocol state
    address public owner;
    bool public paused;
    uint256 public totalDeposits;
    uint256 public totalOpenInterest;
    
    // Events
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    event TradeExecuted(
        address indexed user,
        uint16[] tokenIds,
        int256[] exposureDeltas,
        uint256 requiredMargin,
        uint256 timestamp
    );
    event ExposureUpdated(
        address indexed user,
        uint16 indexed tokenId,
        int256 newExposure,
        int256 delta
    );
    event PositionClosed(
        address indexed user,
        int256 realizedPnl,
        uint256 timestamp
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
    
    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }
    
    function withdraw(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(!hasPosition[msg.sender], "Cannot withdraw with open position");
        
        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }
    
    function openPosition(
        uint16[] memory tokenIds,
        int256[] memory notionals
    ) external whenNotPaused {
        require(tokenIds.length == notionals.length, "Array length mismatch");
        require(tokenIds.length > 0 && tokenIds.length <= 8, "Invalid basket size");
        require(!hasPosition[msg.sender], "Position already open");
        
        // Calculate required margin
        uint256 requiredMargin = calculateRequiredMargin(tokenIds, notionals);
        require(balances[msg.sender] >= usedMargin[msg.sender] + requiredMargin, "Insufficient margin");
        
        // Update exposures
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenRegistry.isValidToken(tokenIds[i]), "Invalid token");
            require(notionals[i] != 0, "Zero notional");
            
            // Update user exposure
            int256 oldExposure = userExposure[msg.sender][tokenIds[i]];
            int256 newExposure = oldExposure + notionals[i];
            userExposure[msg.sender][tokenIds[i]] = newExposure;
            
            // Update global net exposure
            tokenNetExposure[tokenIds[i]] += notionals[i];
            
            emit ExposureUpdated(msg.sender, tokenIds[i], newExposure, notionals[i]);
        }
        
        hasPosition[msg.sender] = true;
        usedMargin[msg.sender] += requiredMargin;
        totalOpenInterest += requiredMargin;
        
        emit TradeExecuted(msg.sender, tokenIds, notionals, requiredMargin, block.timestamp);
    }
    
    function closePosition() external {
        require(hasPosition[msg.sender], "No position to close");
        
        // Calculate PnL
        int256 totalPnl = calculatePositionPnl(msg.sender);
        
        // Clear all exposures
        uint16 maxTokens = tokenRegistry.nextTokenId();
        for (uint16 tokenId = 0; tokenId < maxTokens; tokenId++) {
            int256 exposure = userExposure[msg.sender][tokenId];
            if (exposure != 0) {
                // Update global net exposure
                tokenNetExposure[tokenId] -= exposure;
                
                // Clear user exposure
                userExposure[msg.sender][tokenId] = 0;
                
                emit ExposureUpdated(msg.sender, tokenId, 0, -exposure);
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
        
        // Clear position state
        totalOpenInterest -= usedMargin[msg.sender];
        usedMargin[msg.sender] = 0;
        hasPosition[msg.sender] = false;
        
        emit PositionClosed(msg.sender, totalPnl, block.timestamp);
    }
    
    function calculateRequiredMargin(
        uint16[] memory tokenIds,
        int256[] memory notionals
    ) public view returns (uint256) {
        uint256 margin = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            (, , uint16 riskWeight, ,) = tokenRegistry.tokens(tokenIds[i]);
            uint256 absNotional = notionals[i] >= 0 ? uint256(notionals[i]) : uint256(-notionals[i]);
            margin += (absNotional * riskWeight) / 10000; // riskWeight is in bps
        }
        
        return margin;
    }
    
    function calculatePositionPnl(address user) public view returns (int256) {
        // For hackathon, simplified PnL based on ETH/BTC ratio change
        // In production, this would calculate per-token PnL based on price changes
        
        int256 totalPnl = 0;
        uint256 currentRatio = oracle.getRatioShare("ETH", "BTC");
        
        // Simplified: assume initial ratio was 5% (0.05 * 1e18)
        uint256 initialRatio = 5e16;
        int256 ratioChange = int256(currentRatio) - int256(initialRatio);
        
        // PnL = exposure * ratioChange / 1e18
        int256 ethExposure = userExposure[user][0]; // ETH_ID = 0
        if (ethExposure != 0) {
            totalPnl += (ethExposure * ratioChange) / 1e18;
        }
        
        return totalPnl;
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
        
        // Resize arrays
        activeTokens = new uint16[](count);
        exposures = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            activeTokens[i] = tempTokens[i];
            exposures[i] = tempExposures[i];
        }
    }
    
    function getUserExposures(address user) external view returns (
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
        
        // Resize arrays
        tokenIds = new uint16[](count);
        exposures = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempTokens[i];
            exposures[i] = tempExposures[i];
        }
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
}