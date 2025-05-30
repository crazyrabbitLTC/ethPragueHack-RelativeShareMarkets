// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TokenRegistry {
    struct TokenMeta {
        address token;
        uint8 decimals;
        uint16 riskWeight; // in basis points (100 = 1%)
        bool active;
        string symbol;
    }
    
    mapping(uint16 => TokenMeta) public tokens;
    mapping(string => uint16) public symbolToId;
    mapping(uint16 => string) public idToSymbol;
    
    uint16 public nextTokenId;
    uint16 public constant MAX_TOKENS = 8; // Hackathon limit
    
    address public owner;
    bool public registryLocked;
    
    event TokenAdded(uint16 indexed tokenId, string symbol, address token, uint8 decimals, uint16 riskWeight);
    event TokenUpdated(uint16 indexed tokenId, uint16 newRiskWeight);
    event RegistryLocked();
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotLocked() {
        require(!registryLocked, "Registry is locked");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function addToken(
        string memory symbol,
        address token,
        uint8 decimals,
        uint16 riskWeight
    ) external onlyOwner whenNotLocked {
        require(nextTokenId < MAX_TOKENS, "Max tokens reached");
        require(token != address(0), "Invalid token address");
        require(bytes(symbol).length > 0, "Invalid symbol");
        require(symbolToId[symbol] == 0 && (keccak256(bytes(symbol)) != keccak256(bytes(idToSymbol[0])) || nextTokenId == 0), "Symbol already exists");
        require(riskWeight > 0 && riskWeight <= 10000, "Invalid risk weight");
        
        uint16 tokenId = nextTokenId;
        
        tokens[tokenId] = TokenMeta({
            token: token,
            decimals: decimals,
            riskWeight: riskWeight,
            active: true,
            symbol: symbol
        });
        
        symbolToId[symbol] = tokenId;
        idToSymbol[tokenId] = symbol;
        nextTokenId++;
        
        emit TokenAdded(tokenId, symbol, token, decimals, riskWeight);
    }
    
    function updateRiskWeight(uint16 tokenId, uint16 newRiskWeight) external onlyOwner {
        require(tokenId < nextTokenId, "Invalid token ID");
        require(newRiskWeight > 0 && newRiskWeight <= 10000, "Invalid risk weight");
        require(tokens[tokenId].active, "Token not active");
        
        tokens[tokenId].riskWeight = newRiskWeight;
        
        emit TokenUpdated(tokenId, newRiskWeight);
    }
    
    function lockRegistry() external onlyOwner {
        registryLocked = true;
        emit RegistryLocked();
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    function getTokens(uint16[] memory tokenIds) external view returns (TokenMeta[] memory) {
        TokenMeta[] memory result = new TokenMeta[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenIds[i] < nextTokenId, "Invalid token ID");
            result[i] = tokens[tokenIds[i]];
        }
        
        return result;
    }
    
    function getAllActiveTokens() external view returns (TokenMeta[] memory) {
        TokenMeta[] memory result = new TokenMeta[](nextTokenId);
        uint256 count = 0;
        
        for (uint16 i = 0; i < nextTokenId; i++) {
            if (tokens[i].active) {
                result[count] = tokens[i];
                count++;
            }
        }
        
        // Resize array
        assembly {
            mstore(result, count)
        }
        
        return result;
    }
    
    function isValidToken(uint16 tokenId) external view returns (bool) {
        return tokenId < nextTokenId && tokens[tokenId].active;
    }
}