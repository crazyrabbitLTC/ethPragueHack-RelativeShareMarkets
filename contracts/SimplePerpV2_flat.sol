// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 ^0.8.19;

// lib/forge-std/src/interfaces/IERC20.sol

/// @dev Interface of the ERC20 standard as defined in the EIP.
/// @dev This includes the optional name, symbol, and decimals metadata.
interface IERC20 {
    /// @dev Emitted when `value` tokens are moved from one account (`from`) to another (`to`).
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @dev Emitted when the allowance of a `spender` for an `owner` is set, where `value`
    /// is the new allowance.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Returns the amount of tokens in existence.
    function totalSupply() external view returns (uint256);

    /// @notice Returns the amount of tokens owned by `account`.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Moves `amount` tokens from the caller's account to `to`.
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Returns the remaining number of tokens that `spender` is allowed
    /// to spend on behalf of `owner`
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Sets `amount` as the allowance of `spender` over the caller's tokens.
    /// @dev Be aware of front-running risks: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Moves `amount` tokens from `from` to `to` using the allowance mechanism.
    /// `amount` is then deducted from the caller's allowance.
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Returns the name of the token.
    function name() external view returns (string memory);

    /// @notice Returns the symbol of the token.
    function symbol() external view returns (string memory);

    /// @notice Returns the decimals places of the token.
    function decimals() external view returns (uint8);
}

// src/interfaces/IPyth.sol

interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publishTime;
    }

    function getPriceUnsafe(bytes32 id) external view returns (Price memory price);
    function getPrice(bytes32 id) external view returns (Price memory price);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint fee);
}

// src/RatioOracle.sol

contract RatioOracle {
    IPyth public pyth;
    address public owner;
    
    mapping(string => uint256) public mockPrices;
    mapping(string => bytes32) public priceIds;
    
    bool public useMockPrices = true;
    uint256 public constant MAX_PRICE_AGE = 5 minutes;
    
    event PricesUpdated(uint256 timestamp);
    event PythOracleSet(address pyth);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        // Arbitrum mainnet price IDs
        priceIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        priceIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    }
    
    function setPythOracle(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
        useMockPrices = false;
        emit PythOracleSet(_pyth);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    function setPrice(string memory token, uint256 price) external {
        mockPrices[token] = price;
    }
    
    function setPriceId(string memory token, bytes32 priceId) external {
        priceIds[token] = priceId;
    }
    
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        require(address(pyth) != address(0), "Pyth oracle not set");
        
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        emit PricesUpdated(block.timestamp);
        
        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    function getPrice(string memory token) public view returns (uint256) {
        if (useMockPrices) {
            return mockPrices[token];
        }
        
        bytes32 priceId = priceIds[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        IPyth.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
        
        // Check price validity
        require(pythPrice.price > 0, "Invalid price");
        
        // Check staleness
        require(block.timestamp - pythPrice.publishTime <= MAX_PRICE_AGE, "Price too stale");
        
        // Convert price with simplified exponent handling
        // Pyth ETH/USD and BTC/USD always have expo = -8
        // So price is in 1e8, we need 1e18
        uint256 price = uint256(uint64(pythPrice.price));
        
        // Since we know expo is -8 for ETH/BTC, just multiply by 1e10
        return price * 1e10; // 1e8 * 1e10 = 1e18
    }
    
    function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256) {
        uint256 basePrice = getPrice(baseToken);
        uint256 quotePrice = getPrice(quoteToken);
        
        uint256 totalValue = basePrice + quotePrice;
        
        require(totalValue > 0, "Total value cannot be zero");
        
        // Return share as 1e18 scaled value
        return (basePrice * 1e18) / totalValue;
    }
    
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256) {
        require(address(pyth) != address(0), "Pyth oracle not set");
        return pyth.getUpdateFee(priceUpdateData);
    }
    
    // Keeper helper to push both ETH and BTC prices in one transaction
    function pushPyth(bytes[] calldata priceUpdateData) external payable {
        require(address(pyth) != address(0), "Pyth oracle not set");
        require(priceUpdateData.length == 2, "Must provide exactly 2 price updates");
        require(!useMockPrices, "Cannot push prices in mock mode");
        
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        emit PricesUpdated(block.timestamp);
        
        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
}

// src/SimplePerpV2.sol

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

