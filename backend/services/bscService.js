const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 加载ethers库
const ethers = require('ethers');

class BSCService {
  constructor() {
    // 初始化 BSC 提供者
    this.initProvider();

    // 初始化 API 密钥索引
    this.currentApiKeyIndex = 0;
  }

  // 初始化 BSC 提供者
  initProvider() {
    try {
      // 检查配置中是否有BSC节点配置
      if (!config.bscNode || !config.bscNode.rpcUrls || !config.bscNode.rpcUrls.length) {
        console.warn('BSC节点配置不存在或为空，使用默认RPC URL');
        this.provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.binance.org');
      } else {
        this.provider = new ethers.providers.JsonRpcProvider(config.bscNode.rpcUrls[0]);
      }
      console.log('BSC 提供者初始化成功');
    } catch (error) {
      console.error('BSC 提供者初始化失败:', error);
      // 使用备用RPC URL
      try {
        console.log('尝试使用备用RPC URL');
        this.provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.binance.org');
        console.log('使用备用RPC URL初始化成功');
      } catch (backupError) {
        console.error('备用RPC URL初始化也失败:', backupError);
        throw error; // 抛出原始错误
      }
    }
  }

  // 获取下一个 API 密钥
  getNextApiKey() {
    // 检查配置中是否有BSCScan API密钥配置
    if (!config.bscScan || !config.bscScan.apiKeys || !config.bscScan.apiKeys.length) {
      console.warn('BSCScan API密钥配置不存在或为空');
      return '';
    }

    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % config.bscScan.apiKeys.length;
    return config.bscScan.apiKeys[this.currentApiKeyIndex];
  }

  // 获取当前 API 密钥
  getCurrentApiKey() {
    // 检查配置中是否有BSCScan API密钥配置
    if (!config.bscScan || !config.bscScan.apiKeys || !config.bscScan.apiKeys.length) {
      console.warn('BSCScan API密钥配置不存在或为空');
      return '';
    }

    return config.bscScan.apiKeys[this.currentApiKeyIndex];
  }

  // 调用 BSCScan API
  async callBscScanApi(module, action, params = {}) {
    try {
      // 检查配置中是否有BSCScan API配置
      if (!config.bscScan || !config.bscScan.apiUrl) {
        throw new Error('BSCScan API配置不存在或为空');
      }

      const apiKey = this.getCurrentApiKey();

      const url = new URL(config.bscScan.apiUrl);
      url.searchParams.append('module', module);
      url.searchParams.append('action', action);

      // 只有在API密钥不为空时才添加
      if (apiKey) {
        url.searchParams.append('apikey', apiKey);
      }

      // 添加其他参数
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }

      console.log(`调用 BSCScan API: ${url.toString()}`);

      const response = await axios.get(url.toString());

      // 每次请求后立即轮换 API 密钥，以最大化利用多个 API Key
      if (apiKey) {
        this.getNextApiKey();
        const nextApiKey = this.getCurrentApiKey();
        if (nextApiKey) {
          console.log(`轮换到下一个 API 密钥: ${nextApiKey.substring(0, Math.min(10, nextApiKey.length))}...`);
        }
      }

      // 检查 API 响应状态
      if (response.data.status === '0') {
        console.error(`BSCScan API 错误 (${module}.${action}):`, response.data.message || '未知错误');

        // 对于某些错误，返回空结果而不是抛出错误
        if (response.data.message === 'No transactions found' ||
            response.data.message === 'No records found') {
          return [];
        }

        throw new Error(response.data.message || '调用 BSCScan API 失败');
      }

      return response.data.result;
    } catch (error) {
      console.error(`调用 BSCScan API 失败 (${module}.${action}):`, error);

      // 在发生错误时轮换 API Key
      const apiKey = this.getCurrentApiKey();
      if (apiKey) {
        console.log('发生错误，轮换到下一个 API 密钥');
        this.getNextApiKey();
      }

      // 返回适当的默认值，而不是抛出错误
      if (module === 'contract') {
        if (action === 'getabi') {
          return 'Error: ' + error.message;
        } else if (action === 'getsourcecode') {
          return [];
        } else if (action === 'getcontractcreation') {
          return [];
        }
      }

      throw error;
    }
  }

  // 获取交易收据
  async getTransactionReceipt(txHash) {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error('获取交易收据失败:', error);
      throw error;
    }
  }

  // 获取交易详情
  async getTransaction(txHash) {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      console.error('获取交易详情失败:', error);
      throw error;
    }
  }

  // 检查交易是否包含代币销毁操作
  async checkTokenBurn(txHash) {
    console.log(`检查交易 ${txHash} 是否包含代币销毁操作...`);

    if (!txHash || txHash.trim() === '') {
      throw new Error('交易哈希不能为空');
    }

    try {
      // 获取交易收据
      const receipt = await this.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('未找到交易收据，请确认交易哈希是否正确');
      }

      // 检查交易是否成功
      if (receipt.status === 0) {
        throw new Error('交易执行失败，无法检查代币销毁');
      }

      // 获取交易详情
      const tx = await this.getTransaction(txHash);
      if (!tx) {
        throw new Error('未找到交易详情，请确认交易哈希是否正确');
      }

      console.log(`交易发送者: ${tx.from}, 接收者: ${tx.to || '合约创建'}`);

      // 存储销毁信息
      const burnInfo = {
        found: false,
        token: null,
        amount: '0',
        symbol: '',
        decimals: 18,
        from: tx.from,
        burnAddress: ''
      };

      // 检查交易日志中是否有代币销毁事件
      if (receipt.logs && receipt.logs.length > 0) {
        console.log(`分析交易日志，共 ${receipt.logs.length} 条`);

        // 定义销毁地址
        const burnAddress = config.burnVerification.bsc.burnAddress;

        // 遍历所有日志
        for (const log of receipt.logs) {
          // 检查是否是 Transfer 事件（ERC20 标准事件）
          if (log.topics && log.topics.length >= 3 &&
              log.topics[0].toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {

            // 解析 from 地址（topics[1]）
            const fromAddress = '0x' + log.topics[1].substring(26);

            // 解析 to 地址（topics[2]）
            const toAddress = '0x' + log.topics[2].substring(26);

            // 检查是否转账到销毁地址
            if (toAddress.toLowerCase() === burnAddress.toLowerCase()) {
              console.log(`发现代币销毁事件: 从 ${fromAddress} 到销毁地址 ${toAddress}`);

              // 获取代币合约地址
              const tokenAddress = log.address;

              // 解析销毁金额
              let amount = '0';
              if (log.data && log.data !== '0x') {
                amount = ethers.BigNumber.from(log.data).toString();
              }

              console.log(`代币地址: ${tokenAddress}, 销毁金额: ${amount}`);

              // 获取代币信息（符号、小数位等）
              try {
                const tokenContract = new ethers.Contract(
                  tokenAddress,
                  [
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function decimals() view returns (uint8)'
                  ],
                  this.provider
                );

                // 获取代币符号
                let symbol = await tokenContract.symbol();
                // 获取代币名称
                let name = await tokenContract.name();
                // 获取代币小数位
                const decimals = await tokenContract.decimals();

                console.log(`原始代币名称: ${name}, 原始符号: ${symbol}, 小数位: ${decimals}`);

                // 格式化销毁金额
                const formattedAmount = ethers.utils.formatUnits(amount, decimals);

                console.log(`销毁了 ${formattedAmount} ${symbol} 代币`);

                // 更新销毁信息
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: name,
                  symbol: symbol,
                  decimals: decimals
                };
                burnInfo.amount = formattedAmount;
                burnInfo.symbol = symbol;
                burnInfo.decimals = decimals;
                burnInfo.burnAddress = toAddress;

                // 检查是否是特定的代币合约和数量
                const targetContractAddress = config.burnVerification.bsc.targetContractAddress;
                const targetAmount = config.burnVerification.bsc.targetAmount;

                // 精确比较合约地址（不区分大小写）
                burnInfo.isTargetContract = tokenAddress.toLowerCase() === targetContractAddress.toLowerCase();

                // 精确比较数量
                // 使用字符串比较以避免浮点数精度问题
                const exactAmount = formattedAmount.includes('.')
                  ? formattedAmount.replace(/\.?0+$/, '') // 移除尾部的零和小数点
                  : formattedAmount;
                const exactTargetAmount = targetAmount.includes('.')
                  ? targetAmount.replace(/\.?0+$/, '')
                  : targetAmount;

                burnInfo.isTargetAmount = exactAmount === exactTargetAmount;
                burnInfo.isValidBurn = burnInfo.isTargetContract && burnInfo.isTargetAmount;

                console.log(`销毁数量比较: 实际=${exactAmount}, 目标=${exactTargetAmount}, 匹配=${burnInfo.isTargetAmount}`);

                // 找到销毁事件后，可以继续查找其他销毁事件，或者直接返回
                // 这里选择继续查找，以支持一个交易中销毁多种代币的情况
              } catch (error) {
                console.error(`获取代币信息失败: ${error.message}`);

                // 即使获取代币信息失败，也标记为找到销毁事件
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: 'Unknown Token',
                  symbol: 'UNKNOWN',
                  decimals: 18
                };
                burnInfo.amount = ethers.utils.formatUnits(amount, 18); // 假设小数位是18
                burnInfo.symbol = 'UNKNOWN';
                burnInfo.burnAddress = toAddress;

                // 检查是否是特定的代币合约
                const targetContractAddress = config.burnVerification.bsc.targetContractAddress;
                burnInfo.isTargetContract = tokenAddress.toLowerCase() === targetContractAddress.toLowerCase();
                burnInfo.isTargetAmount = false; // 无法确定数量，默认为 false
                burnInfo.isValidBurn = false; // 无法确定，默认为 false
              }
            }
          }
        }
      }

      // 返回销毁信息
      return burnInfo;

    } catch (error) {
      console.error(`检查代币销毁失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new BSCService();
