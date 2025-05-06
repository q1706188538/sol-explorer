// 配置文件
require('dotenv').config();

module.exports = {
  port: 3001,
  sessionSecret: "sol-explorer-secret-key",
  pagination: {
    defaultPage: 1,
    defaultPageSize: 50,
    maxPageSize: 10000
  },
  solScan: {
    enabled: false,
    apiUrl: "https://public-api.solscan.io",
    apiKeys: [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDY0NjI1MDEyODIsImVtYWlsIjoiMTcwNjE4ODUzOEBxcS5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3NDY0NjI1MDF9.rDtIM_LuwGuI1SUQwh-AGaJQwYOculGAwkm1xLDKZwM",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDY0NjYxMzYwNDYsImVtYWlsIjoib21sZ2V4MHZzQHlhc3NvbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3NDY0NjYxMzZ9.CQ-u6VKqG4qOL5H-Wta9iTuEs02RhEmtyfEMwDgW2Y8"
    ],
    maxConcurrent: 100,
    priority: 2
  },
  solNode: {
    enabled: true,
    apiUrls: [
      "https://api.mainnet-beta.solana.com",
      "https://solana-mainnet.g.alchemy.com/v2/demo",
      "https://rpc.ankr.com/solana"
    ],
    apiKeys: [],
    maxConcurrent: 50,
    priority: 4
  },
  quickNode: {
    enabled: true,
    apiUrl: "https://wild-fluent-pool.solana-mainnet.quiknode.pro/17b531391a7c78100ca11c28092a7ab9d3e38964/",
    wsUrl: "wss://wild-fluent-pool.solana-mainnet.quiknode.pro/17b531391a7c78100ca11c28092a7ab9d3e38964/",
    apiKeys: [
      "17b531391a7c78100ca11c28092a7ab9d3e38964"
    ],
    maxConcurrent: 200,
    priority: 1
  },
  bscScan: {
    apiUrl: "https://api.bscscan.com/api",
    apiKeys: [
      "R4M4YEXGGE9EKDUIP3YTXHUKVYX9TX91DA",
      "15CVJ7U55ZTY71S3IBRIM2R2MKIDJVJ1X8",
      "UJ5GP7BMKIRCFDA92QFB9VBG7ZYQI3ZI7P",
      "P8YHZQJK4JDA5AP78RP6B277CDPW82H4K9",
      "YUYVX3D7VBV89FQ39PB7UXQ6I6AUAF1F2J"
    ],
    maxConcurrent: 100
  },
  bscNode: {
    rpcUrls: [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/"
    ]
  },
  burnVerification: {
    enabled: true,
    type: "bsc",
    sol: {
      targetContractAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      targetAmount: "100",
      burnAddress: "1nc1nerator11111111111111111111111111111111"
    },
    bsc: {
      targetContractAddress: "0xB048FDA90e74931319eaCA04068d3719B4684444",
      targetAmount: "10000",
      burnAddress: "0x000000000000000000000000000000000000dead"
    }
  },
  security: {
    rateLimitWindow: 900000,
    rateLimitMax: 500000,
    corsOrigins: [
      "http://localhost:8080"
    ]
  },
  shyft: {
    enabled: false,
    apiUrl: "https://api.shyft.to/sol/v1",
    apiKeys: [
      "XtMnBJkYCX3N5C2s"
    ],
    maxConcurrent: 50,
    priority: 3
  },
  moralis: {
    apiUrl: "https://deep-index.moralis.io/api/v2",
    apiKey: "",
    maxConcurrent: 20,
    enabled: false
  }
};
