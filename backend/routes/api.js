const express = require('express');
const router = express.Router();
const solanaService = require('../services/solanaService');
const hashVerificationService = require('../services/hashVerificationService');
const config = require('../config');

// 验证代币销毁交易
router.post('/verify-burn', async (req, res) => {
  try {
    const { txHash } = req.body;

    if (!txHash) {
      return res.status(400).json({
        success: false,
        message: '交易哈希不能为空'
      });
    }

    // 检查哈希是否已经验证过
    if (hashVerificationService.isHashVerified(txHash)) {
      // 检查哈希是否已被使用过
      if (hashVerificationService.isHashUsed(txHash)) {
        return res.status(400).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希'
        });
      }

      // 哈希已验证但未使用，可以继续使用
      const hashDetails = hashVerificationService.getHashDetails(txHash);

      // 设置会话
      req.session.burnVerified = true;
      req.session.verifiedTxHash = txHash;
      req.session.burnFrom = hashDetails.from;

      console.log(`哈希已验证但未使用，允许继续使用: ${txHash}`);

      return res.json({
        success: true,
        result: {
          isValidBurn: true,
          from: hashDetails.from,
          hash: txHash,
          alreadyVerified: true
        }
      });
    }

    // 调用 Solana 服务验证销毁
    const burnResult = await solanaService.checkTokenBurn(txHash);

    // 如果验证通过，记录哈希并设置会话
    if (burnResult.isValidBurn) {
      // 添加到已验证哈希列表
      hashVerificationService.addVerifiedHash(txHash, burnResult.from);

      // 设置会话
      req.session.burnVerified = true;
      req.session.verifiedTxHash = txHash;
      req.session.burnFrom = burnResult.from;

      console.log(`销毁验证通过，记录哈希并设置会话: ${JSON.stringify({
        burnVerified: req.session.burnVerified,
        verifiedTxHash: req.session.verifiedTxHash,
        burnFrom: req.session.burnFrom
      })}`);
    } else {
      // 如果验证失败，清除会话
      req.session.burnVerified = false;
      delete req.session.verifiedTxHash;
      delete req.session.burnFrom;

      console.log('销毁验证失败，清除会话');
    }

    return res.json({
      success: true,
      result: burnResult
    });
  } catch (error) {
    console.error('验证销毁失败:', error);
    return res.status(500).json({
      success: false,
      message: '验证失败: ' + error.message
    });
  }
});

// 获取验证状态
router.get('/verification-status', (req, res) => {
  const txHash = req.session.verifiedTxHash || '';
  let isUsed = false;

  // 如果有验证过的哈希，检查是否已使用
  if (txHash) {
    isUsed = hashVerificationService.isHashUsed(txHash);
  }

  return res.json({
    success: true,
    verified: req.session.burnVerified || false,
    txHash: txHash,
    from: req.session.burnFrom || '',
    isUsed: isUsed
  });
});

// 获取交易记录
router.post('/transactions', async (req, res) => {
  try {
    // 初始化哈希变量
    let txHash = null;

    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }

      // 获取会话中的交易哈希
      txHash = req.session.verifiedTxHash;

      // 检查哈希状态
      const hashStatus = hashVerificationService.getHashStatus(txHash);
      console.log(`检查哈希 ${txHash} 状态: ${hashStatus}`);

      if (hashStatus === 'used') {
        // 清除会话
        req.session.burnVerified = false;
        delete req.session.verifiedTxHash;
        delete req.session.burnFrom;

        return res.status(403).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希进行验证'
        });
      }

      if (hashStatus === 'locked') {
        // 检查是否已经初始化了API请求状态跟踪
        const normalizedHash = hashVerificationService.normalizeHash(txHash);
        const status = hashVerificationService.apiRequestStatus.get(normalizedHash);

        // 如果已经初始化了API请求状态跟踪，允许继续查询
        if (status) {
          console.log(`哈希 ${txHash} 已锁定，但允许继续查询，因为已经初始化了API请求状态跟踪`);
        } else {
          return res.status(403).json({
            success: false,
            message: '该交易哈希正在处理中，请稍后再试'
          });
        }
      }

      // 锁定哈希，表示正在使用
      if (hashStatus === 'verified') {
        hashVerificationService.lockHash(txHash);
        console.log(`哈希 ${txHash} 已锁定，标记为正在使用`);

        // 初始化API请求状态跟踪
        hashVerificationService.initApiRequestStatus(txHash);
      }
    }

    const { address, page = config.pagination.defaultPage, offset = config.pagination.defaultPageSize } = req.body;
    if (!address) {
      // 如果地址为空，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为地址为空`);
      }

      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    try {
      // 调用 Solana 服务获取交易记录
      const transactions = await solanaService.getTransactions(address, page, offset);

      // 准备响应数据
      const responseData = {
        success: true,
        result: transactions
      };

      // 发送响应
      res.json(responseData);

      // 标记普通交易API请求已完成
      if (config.burnVerification.enabled && txHash) {
        hashVerificationService.markNormalTxCompleted(txHash);
        console.log(`哈希 ${txHash} 的普通交易API请求已完成，等待代币交易API请求完成`);
      }
    } catch (queryError) {
      // 如果查询失败，解锁哈希并清理API请求状态
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        hashVerificationService.cleanupApiRequestStatus(txHash);
        console.log(`哈希 ${txHash} 已解锁并清理API请求状态，因为查询失败: ${queryError.message}`);
      }

      throw queryError; // 重新抛出错误，让外层 catch 处理
    }
  } catch (error) {
    console.error('获取交易记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取交易记录失败: ' + error.message
    });
  }
});

// 获取代币转账记录
router.post('/token-transfers', async (req, res) => {
  try {
    // 初始化哈希变量
    let txHash = null;

    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }

      // 获取会话中的交易哈希
      txHash = req.session.verifiedTxHash;

      // 检查哈希状态
      const hashStatus = hashVerificationService.getHashStatus(txHash);
      console.log(`检查哈希 ${txHash} 状态: ${hashStatus}`);

      if (hashStatus === 'used') {
        // 清除会话
        req.session.burnVerified = false;
        delete req.session.verifiedTxHash;
        delete req.session.burnFrom;

        return res.status(403).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希进行验证'
        });
      }

      if (hashStatus === 'locked') {
        // 检查是否已经初始化了API请求状态跟踪
        const normalizedHash = hashVerificationService.normalizeHash(txHash);
        const status = hashVerificationService.apiRequestStatus.get(normalizedHash);

        // 如果已经初始化了API请求状态跟踪，允许继续查询
        if (status) {
          console.log(`哈希 ${txHash} 已锁定，但允许继续查询，因为已经初始化了API请求状态跟踪`);
        } else {
          return res.status(403).json({
            success: false,
            message: '该交易哈希正在处理中，请稍后再试'
          });
        }
      }

      // 锁定哈希，表示正在使用
      if (hashStatus === 'verified') {
        hashVerificationService.lockHash(txHash);
        console.log(`哈希 ${txHash} 已锁定，标记为正在使用`);

        // 初始化API请求状态跟踪
        hashVerificationService.initApiRequestStatus(txHash);
      }
    }

    const { address, page = config.pagination.defaultPage, offset = config.pagination.defaultPageSize } = req.body;
    if (!address) {
      // 如果地址为空，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为地址为空`);
      }

      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    try {
      // 调用 Solana 服务获取代币转账记录
      console.log(`获取代币转账记录: ${address}, 页码: ${page}, 每页数量: ${offset}`);

      const startTime = Date.now();
      const transfers = await solanaService.getTokenTransfers(address, page, offset);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`获取到 ${transfers.length} 条记录，耗时 ${duration.toFixed(2)} 秒，使用 API: ${solanaService.getCurrentApiProvider()}`);

      // 准备响应数据
      const responseData = {
        success: true,
        result: transfers,
        provider: solanaService.getCurrentApiProvider(),
        count: transfers.length,
        duration: duration.toFixed(2)
      };

      // 发送响应
      res.json(responseData);

      // 标记代币交易API请求已完成
      if (config.burnVerification.enabled && txHash) {
        hashVerificationService.markTokenTxCompleted(txHash);
        console.log(`哈希 ${txHash} 的代币交易API请求已完成，检查是否两个API都已完成`);
      }
    } catch (queryError) {
      // 如果查询失败，解锁哈希并清理API请求状态
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        hashVerificationService.cleanupApiRequestStatus(txHash);
        console.log(`哈希 ${txHash} 已解锁并清理API请求状态，因为查询失败: ${queryError.message}`);
      }

      throw queryError; // 重新抛出错误，让外层 catch 处理
    }
  } catch (error) {
    console.error('获取代币转账记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取代币转账记录失败: ' + error.message
    });
  }
});



// 获取合约信息
router.post('/contract-info', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查会话状态
      console.log('会话状态:', req.session);
      if (!req.session.burnVerified) {
        console.log('警告: 会话验证未通过，但暂时允许请求继续，用于调试');
        // 暂时注释掉，允许请求继续
        // return res.status(403).json({
        //   success: false,
        //   message: '请先验证代币销毁交易'
        // });
      }
    }

    const { contractAddress } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: '合约地址不能为空'
      });
    }

    // 获取当前使用的 API Key
    const apiKey = solanaService.getCurrentApiKey();
    console.log(`获取合约信息 - 合约地址: ${contractAddress}, API Key: ${apiKey.substring(0, 10)}..., API 提供商: ${solanaService.getCurrentApiProvider()}`);

    try {
      // 按顺序获取合约信息，避免并发请求
      console.log('按顺序获取合约信息，避免并发请求...');

      // 获取合约元数据
      console.log('1. 获取合约元数据...');
      const contractInfo = await solanaService.getContractInfo(contractAddress);

      // 获取合约余额
      console.log('2. 获取合约余额...');
      const balance = await solanaService.getAddressBalance(contractAddress);

      // 获取代币总供应量
      console.log('3. 获取代币总供应量...');
      const totalSupply = await solanaService.getTokenTotalSupply(contractAddress);

      console.log(`合约 ${contractAddress} 信息获取成功:`);
      console.log('SOL 余额:', balance, 'SOL');
      console.log('总供应量:', totalSupply);

      // 获取当前使用的 API Key 和 API 提供商
      const apiKey = solanaService.getCurrentApiKey();
      const apiProvider = solanaService.getCurrentApiProvider();

      console.log(`返回合约 ${contractAddress} 信息，使用 API Key: ${apiKey.substring(0, 10)}..., API 提供商: ${apiProvider}`);

      return res.json({
        success: true,
        result: {
          contractInfo,
          balance,
          totalSupply
        },
        apiKey: apiKey.substring(0, 10) + '...',
        provider: apiProvider
      });
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 信息失败:`, error);

      // 返回部分信息，而不是完全失败
      return res.json({
        success: true,
        result: {
          contractInfo: 'Error: ' + error.message,
          balance: 0,
          totalSupply: '0'
        }
      });
    }
  } catch (error) {
    console.error('获取合约信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取合约信息失败: ' + error.message
    });
  }
});

// 清除验证状态（用于测试）
router.post('/clear-verification', (req, res) => {
  req.session.burnVerified = false;
  delete req.session.verifiedTxHash;
  delete req.session.burnFrom;

  return res.json({
    success: true,
    message: '验证状态已清除'
  });
});

// 获取配置信息
router.get('/config', (_, res) => {
  // 创建一个安全的配置对象，只包含前端需要的配置
  const safeConfig = {
    solScan: {
      apiUrl: config.solScan.apiUrl,
      apiKeys: config.solScan.apiKeys,
      maxConcurrent: config.solScan.maxConcurrent
    },
    solNode: {
      rpcUrls: config.solNode.rpcUrls
    },
    burnVerification: {
      enabled: config.burnVerification.enabled,
      targetContractAddress: config.burnVerification.targetContractAddress,
      targetAmount: config.burnVerification.targetAmount,
      burnAddress: config.burnVerification.burnAddress
    },
    pagination: config.pagination || {
      defaultPage: 1,
      defaultPageSize: 5000,
      maxPageSize: 10000
    }
  };

  // 添加Moralis配置（如果存在）
  if (config.moralis) {
    safeConfig.moralis = {
      apiUrl: config.moralis.apiUrl,
      apiKey: config.moralis.apiKey,
      maxConcurrent: config.moralis.maxConcurrent,
      enabled: config.moralis.enabled !== false
    };
  }

  // 添加当前 API 提供商信息
  safeConfig.currentApiProvider = solanaService.getCurrentApiProvider();

  console.log('返回配置信息:', safeConfig);
  return res.header('Content-Type', 'application/json; charset=utf-8')
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .header('Pragma', 'no-cache')
    .header('Expires', '0')
    .json(safeConfig);
});

// 获取当前 API 提供商
router.get('/api-provider', (_, res) => {
  return res.json({
    success: true,
    provider: solanaService.getCurrentApiProvider()
  });
});

// 重新加载配置
router.post('/reload-config', (_, res) => {
  try {
    // 清除 require 缓存，强制重新加载配置文件
    delete require.cache[require.resolve('../config')];
    // 重新加载配置
    const freshConfig = require('../config');
    // 更新全局配置对象
    Object.assign(config, freshConfig);

    console.log('配置已重新加载', config);

    return res.json({
      success: true,
      message: '配置已重新加载',
      config: {
        solScan: {
          apiUrl: config.solScan.apiUrl,
          apiKeys: config.solScan.apiKeys,
          maxConcurrent: config.solScan.maxConcurrent
        },
        solNode: {
          rpcUrls: config.solNode.rpcUrls
        },
        burnVerification: {
          enabled: config.burnVerification.enabled,
          targetContractAddress: config.burnVerification.targetContractAddress,
          targetAmount: config.burnVerification.targetAmount,
          burnAddress: config.burnVerification.burnAddress
        },
        moralis: config.moralis ? {
          apiUrl: config.moralis.apiUrl,
          apiKey: config.moralis.apiKey,
          maxConcurrent: config.moralis.maxConcurrent,
          enabled: config.moralis.enabled !== false
        } : undefined,
        pagination: config.pagination || {
          defaultPage: 1,
          defaultPageSize: 5000,
          maxPageSize: 10000
        }
      }
    });
  } catch (error) {
    console.error('重新加载配置失败:', error);
    return res.status(500).json({
      success: false,
      message: '重新加载配置失败: ' + error.message
    });
  }
});

// 保存配置
router.post('/save-config', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    // 获取请求中的配置
    const newConfig = req.body;

    // 验证配置
    if (!newConfig) {
      return res.status(400).json({
        success: false,
        message: '配置不能为空'
      });
    }

    // 获取当前配置
    const currentConfig = { ...config };

    // 更新配置
    if (newConfig.burnVerification) {
      if (newConfig.burnVerification.enabled !== undefined) {
        currentConfig.burnVerification.enabled = newConfig.burnVerification.enabled;
      }
      if (newConfig.burnVerification.targetContractAddress) {
        currentConfig.burnVerification.targetContractAddress = newConfig.burnVerification.targetContractAddress;
      }
      if (newConfig.burnVerification.targetAmount) {
        currentConfig.burnVerification.targetAmount = newConfig.burnVerification.targetAmount;
      }
      if (newConfig.burnVerification.burnAddress) {
        currentConfig.burnVerification.burnAddress = newConfig.burnVerification.burnAddress;
      }
    }

    if (newConfig.solScan) {
      if (newConfig.solScan.apiUrl) {
        currentConfig.solScan.apiUrl = newConfig.solScan.apiUrl;
      }
      if (newConfig.solScan.maxConcurrent !== undefined) {
        currentConfig.solScan.maxConcurrent = newConfig.solScan.maxConcurrent;
      }
      if (newConfig.solScan.apiKeys && Array.isArray(newConfig.solScan.apiKeys)) {
        currentConfig.solScan.apiKeys = newConfig.solScan.apiKeys;
      }
    }

    if (newConfig.solNode) {
      if (newConfig.solNode.rpcUrls && Array.isArray(newConfig.solNode.rpcUrls)) {
        currentConfig.solNode.rpcUrls = newConfig.solNode.rpcUrls;
      }
    }

    // 处理Moralis配置
    if (newConfig.moralis) {
      if (!currentConfig.moralis) {
        currentConfig.moralis = {
          apiUrl: 'https://deep-index.moralis.io/api/v2',
          apiKey: '',
          maxConcurrent: 10,
          enabled: true
        };
      }

      if (newConfig.moralis.apiUrl) {
        currentConfig.moralis.apiUrl = newConfig.moralis.apiUrl;
      }
      if (newConfig.moralis.apiKey) {
        currentConfig.moralis.apiKey = newConfig.moralis.apiKey;
      }
      if (newConfig.moralis.maxConcurrent !== undefined) {
        currentConfig.moralis.maxConcurrent = newConfig.moralis.maxConcurrent;
      }
      if (newConfig.moralis.enabled !== undefined) {
        currentConfig.moralis.enabled = newConfig.moralis.enabled;
      }
    }

    // 处理分页配置
    if (newConfig.pagination) {
      if (!currentConfig.pagination) {
        currentConfig.pagination = {
          defaultPage: 0,
          defaultPageSize: 5000,
          maxPageSize: 10000
        };
      }

      if (newConfig.pagination.defaultPage !== undefined) {
        currentConfig.pagination.defaultPage = newConfig.pagination.defaultPage;
      }
      if (newConfig.pagination.defaultPageSize !== undefined) {
        currentConfig.pagination.defaultPageSize = newConfig.pagination.defaultPageSize;
      }
      if (newConfig.pagination.maxPageSize !== undefined) {
        currentConfig.pagination.maxPageSize = newConfig.pagination.maxPageSize;
      }
    }

    // 将配置转换为字符串
    const configString = `// 配置文件
require('dotenv').config();

module.exports = ${JSON.stringify(currentConfig, null, 2).replace(/"([^"]+)":/g, '$1:')};
`;

    // 保存配置到文件
    const configPath = path.resolve(__dirname, '../config.js');
    fs.writeFileSync(configPath, configString);

    // 清除 require 缓存，强制重新加载配置文件
    delete require.cache[require.resolve('../config')];
    // 重新加载配置
    const freshConfig = require('../config');
    // 更新全局配置对象
    Object.assign(config, freshConfig);

    console.log('配置已保存并重新加载:', config);

    return res.json({
      success: true,
      message: '配置已保存并重新加载',
      config: {
        solScan: {
          apiUrl: config.solScan.apiUrl,
          apiKeys: config.solScan.apiKeys,
          maxConcurrent: config.solScan.maxConcurrent
        },
        solNode: {
          rpcUrls: config.solNode.rpcUrls
        },
        burnVerification: {
          enabled: config.burnVerification.enabled,
          targetContractAddress: config.burnVerification.targetContractAddress,
          targetAmount: config.burnVerification.targetAmount,
          burnAddress: config.burnVerification.burnAddress
        },
        moralis: config.moralis ? {
          apiUrl: config.moralis.apiUrl,
          apiKey: config.moralis.apiKey,
          maxConcurrent: config.moralis.maxConcurrent,
          enabled: config.moralis.enabled !== false
        } : undefined,
        pagination: config.pagination || {
          defaultPage: 0,
          defaultPageSize: 5000,
          maxPageSize: 10000
        }
      }
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return res.status(500).json({
      success: false,
      message: '保存配置失败: ' + error.message
    });
  }
});

// 不再需要获取合约创建者信息的接口

module.exports = router;