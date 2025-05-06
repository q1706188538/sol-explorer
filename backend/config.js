// 配置文件
require('dotenv').config();

module.exports = {
  port: 3000,
  sessionSecret: "sol-explorer-secret-key",
  // 分页配置
  pagination: {
    defaultPage: 1,      // 默认页码（从1开始）
    defaultPageSize: 50, // 默认每页数量
    maxPageSize: 10000   // 最大每页数量
  },
  // SolScan API配置
  solScan: {
    enabled: false, // 是否启用SolScan API
    apiUrl: "https://public-api.solscan.io",
    apiKeys: [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDY0NjI1MDEyODIsImVtYWlsIjoiMTcwNjE4ODUzOEBxcS5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3NDY0NjI1MDF9.rDtIM_LuwGuI1SUQwh-AGaJQwYOculGAwkm1xLDKZwM",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDY0NjYxMzYwNDYsImVtYWlsIjoib21sZ2V4MHZzQHlhc3NvbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3NDY0NjYxMzZ9.CQ-u6VKqG4qOL5H-Wta9iTuEs02RhEmtyfEMwDgW2Y8"
    ],
    maxConcurrent: 100, // 最大并发请求数
    priority: 2 // 优先级，数字越小优先级越高
  },

  // 原生Solana RPC API配置
  solNode: {
    enabled: true, // 是否启用原生Solana RPC API
    apiUrls: [
      "https://api.mainnet-beta.solana.com",
      "https://solana-mainnet.g.alchemy.com/v2/demo",
      "https://rpc.ankr.com/solana"
    ],
    apiKeys: [], // 原生API通常不需要密钥
    maxConcurrent: 50, // 最大并发请求数
    priority: 4 // 优先级，数字越小优先级越高
  },
  // QuickNode API配置
  quickNode: {
    enabled: true, // 是否启用QuickNode API
    apiUrl: "https://wild-fluent-pool.solana-mainnet.quiknode.pro/17b531391a7c78100ca11c28092a7ab9d3e38964/", // 主要API端点
    wsUrl: "wss://wild-fluent-pool.solana-mainnet.quiknode.pro/17b531391a7c78100ca11c28092a7ab9d3e38964/", // WebSocket端点
    apiKeys: [
      "17b531391a7c78100ca11c28092a7ab9d3e38964"
    ],
    maxConcurrent: 200, // 最大并发请求数
    priority: 1 // 优先级，数字越小优先级越高
  },
  burnVerification: {
    enabled: false,
    targetContractAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    targetAmount: "101",
    burnAddress: "1nc1nerator11111111111111111111111111111111"
  },
  security: {
    rateLimitWindow: 900000,
    rateLimitMax: 500000,
    corsOrigins: [
      "http://localhost:8080"
    ]
  },
  // Shyft API配置
  shyft: {
    enabled: false, // 是否启用Shyft API
    apiUrl: "https://api.shyft.to/sol/v1",
    apiKeys: [
      "XtMnBJkYCX3N5C2s" // 在此添加您的Shyft API密钥
    ],
    maxConcurrent: 50,
    priority: 3
  },
  // 不再需要查询创建者配置
};
