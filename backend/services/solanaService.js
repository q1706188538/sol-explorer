const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../config');

// 当前使用的 API 提供商
let currentApiProvider = 'solscan';

class SolanaService {
  constructor() {
    // 初始化 Solana 提供者
    this.initProvider();

    // 初始化 API 密钥索引
    this.currentApiKeyIndex = 0;
  }

  // 初始化 Solana 提供者
  initProvider() {
    try {
      // 初始化API提供商状态
      this.apiProviders = {
        solScan: config.solScan && config.solScan.enabled === true,
        solNode: config.solNode && config.solNode.enabled === true,
        quickNode: config.quickNode && config.quickNode.enabled === true,
        shyft: config.shyft && config.shyft.enabled === true
      };

      // 初始化API提供商优先级
      this.apiPriorities = [];

      // 添加启用的API提供商到优先级列表
      if (this.apiProviders.solScan) {
        this.apiPriorities.push({
          name: 'solScan',
          priority: config.solScan.priority || 2
        });
      }



      if (this.apiProviders.solNode) {
        this.apiPriorities.push({
          name: 'solNode',
          priority: config.solNode.priority || 4
        });
      }

      if (this.apiProviders.quickNode) {
        this.apiPriorities.push({
          name: 'quickNode',
          priority: config.quickNode.priority || 1
        });
      }

      if (this.apiProviders.shyft) {
        this.apiPriorities.push({
          name: 'shyft',
          priority: config.shyft.priority || 3
        });
      }

      // 按优先级排序
      this.apiPriorities.sort((a, b) => a.priority - b.priority);

      console.log('API提供商状态:', this.apiProviders);
      console.log('API提供商优先级:', this.apiPriorities);

      // 初始化连接
      if (this.apiProviders.quickNode) {
        // 使用QuickNode端点
        const endpoint = config.quickNode.apiUrl;
        this.connection = new Connection(endpoint, 'confirmed');
        console.log('QuickNode Solana 提供者初始化成功');
      } else if (this.apiProviders.solNode) {
        // 使用默认RPC端点
        this.connection = new Connection(config.solNode.apiUrls[0], 'confirmed');
        console.log('默认 Solana 提供者初始化成功');
      } else {
        // 至少初始化一个连接，以防其他API都失败时使用
        this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        console.log('备用 Solana 提供者初始化成功');
      }
    } catch (error) {
      console.error('Solana 提供者初始化失败:', error);
      throw error;
    }
  }

  // 调用QuickNode RPC API
  async callQuickNodeApi(method, params = []) {
    try {
      if (!this.apiProviders.quickNode) {
        throw new Error('QuickNode未启用');
      }

      const endpoint = config.quickNode.apiUrl;
      console.log(`调用QuickNode API: ${method}`);

      // 获取API密钥
      const apiKey = config.quickNode.apiKeys && config.quickNode.apiKeys.length > 0
        ? config.quickNode.apiKeys[0]
        : '';

      // 设置请求头
      const headers = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await axios.post(endpoint, {
        jsonrpc: '2.0',
        id: 1,
        method: method,
        params: params
      }, { headers });

      if (response.data.error) {
        console.error(`QuickNode API错误 (${method}):`, response.data.error);
        throw new Error(response.data.error.message || '调用QuickNode API失败');
      }

      return response.data.result;
    } catch (error) {
      console.error(`调用QuickNode API失败 (${method}):`, error);
      throw error;
    }
  }

  // 获取下一个 API 密钥
  getNextApiKey(provider = 'solScan') {
    // 初始化提供商的API密钥索引
    if (!this.apiKeyIndices) {
      this.apiKeyIndices = {
        solScan: 0,
        quickNode: 0,
        shyft: 0
      };
    }

    // 获取提供商的API密钥列表
    const apiKeys = config[provider] && config[provider].apiKeys ? config[provider].apiKeys : [];

    if (apiKeys.length === 0) {
      return '';
    }

    // 更新索引
    this.apiKeyIndices[provider] = (this.apiKeyIndices[provider] + 1) % apiKeys.length;

    // 返回下一个API密钥
    return apiKeys[this.apiKeyIndices[provider]];
  }

  // 获取当前 API 密钥
  getCurrentApiKey(provider = 'solScan') {
    // 初始化提供商的API密钥索引
    if (!this.apiKeyIndices) {
      this.apiKeyIndices = {
        solScan: 0,
        quickNode: 0,
        shyft: 0
      };
    }

    // 获取提供商的API密钥列表
    const apiKeys = config[provider] && config[provider].apiKeys ? config[provider].apiKeys : [];

    if (apiKeys.length === 0) {
      return '';
    }

    // 返回当前API密钥
    return apiKeys[this.apiKeyIndices[provider]];
  }

  // 获取当前API提供商
  getCurrentApiProvider() {
    return currentApiProvider;
  }

  // 调用 SolScan API
  async callSolScanApi(endpoint, params = {}) {
    try {
      if (!this.apiProviders.solScan) {
        throw new Error('SolScan API未启用');
      }

      const apiKey = this.getCurrentApiKey('solScan');

      const url = `${config.solScan.apiUrl}${endpoint}`;

      console.log(`调用 SolScan API: ${url}`);
      console.log(`请求参数:`, params);
      console.log(`API密钥: ${apiKey ? apiKey.substring(0, 10) + '...' : '无'}`);

      let response;
      try {
        response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'token': apiKey
          },
          params: params
        });

        console.log(`SolScan API响应状态: ${response.status}`);
        console.log(`SolScan API响应头:`, response.headers);
        console.log(`SolScan API响应数据类型:`, typeof response.data);

        if (typeof response.data === 'object') {
          console.log(`SolScan API响应数据键:`, Object.keys(response.data));
        }

        // 每次请求后立即轮换 API 密钥，以最大化利用多个 API Key
        this.getNextApiKey('solScan');

        // 如果有API密钥，则记录日志
        if (apiKey) {
          console.log(`转换到下一个 API 密钥: ${this.getCurrentApiKey('solScan').substring(0, 10)}...`);
        }
      } catch (axiosError) {
        console.error(`SolScan API请求失败:`, axiosError);
        console.error(`错误详情:`, axiosError.response ? axiosError.response.data : '无响应数据');
        throw axiosError;
      }

      // 检查 API 响应状态
      if (response && response.data && response.data.success === false) {
        console.error(`SolScan API 错误 (${endpoint}):`, response.data.message || '未知错误');

        // 对于某些错误，返回空结果而不是抛出错误
        if (response.data.message === 'No transactions found' ||
            response.data.message === 'No records found') {
          return [];
        }

        throw new Error(response.data.message || '调用 SolScan API 失败');
      }

      // 新版API返回格式为 { success: true, data: [...] }
      if (response.data && response.data.success === true && response.data.data !== undefined) {
        return response.data.data;
      }

      return response.data;
    } catch (error) {
      console.error(`调用 SolScan API 失败 (${endpoint}):`, error);

      // 在发生错误时轮换 API Key
      console.log('发生错误，轮换到下一个 API 密钥');
      this.getNextApiKey('solScan');

      throw error;
    }
  }

  // 获取交易收据
  async getTransactionReceipt(txHash) {
    try {
      const transaction = await this.connection.getTransaction(txHash, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      return transaction;
    } catch (error) {
      console.error('获取交易收据失败:', error);
      throw error;
    }
  }

  // 获取交易详情
  async getTransaction(txHash) {
    try {
      return await this.connection.getTransaction(txHash, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
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

    // 根据配置选择验证类型
    const verificationType = config.burnVerification.type || 'sol';
    console.log(`验证类型: ${verificationType}`);

    // 如果是BSC交易哈希，使用BSC服务验证
    if (verificationType === 'bsc') {
      try {
        // 动态导入BSC服务
        const bscService = require('./bscService');
        console.log('使用BSC服务验证交易哈希');
        return await bscService.checkTokenBurn(txHash);
      } catch (error) {
        console.error(`BSC验证失败: ${error.message}`);
        throw error;
      }
    }

    // 否则使用Solana服务验证
    try {
      // 获取交易详情
      const tx = await this.getTransaction(txHash);
      if (!tx) {
        throw new Error('未找到交易，请确认交易哈希是否正确');
      }

      // 检查交易是否成功
      if (!tx.meta.status.Ok) {
        throw new Error('交易执行失败，无法检查代币销毁');
      }

      // 获取交易发送者
      let sender = '';
      try {
        // 尝试使用getAccountKeys方法（如果存在）
        if (typeof tx.transaction.message.getAccountKeys === 'function') {
          const accountKeys = tx.transaction.message.getAccountKeys();
          if (accountKeys && accountKeys.length > 0) {
            sender = accountKeys[0].toString();
          }
        }
        // 不再尝试使用accountKeys属性，因为它在新版本中已被移除
        // 如果还是没有找到，尝试从staticAccountKeys获取
        else if (tx.transaction.message.staticAccountKeys && tx.transaction.message.staticAccountKeys.length > 0) {
          sender = tx.transaction.message.staticAccountKeys[0].toString();
        }
      } catch (error) {
        console.error('获取交易发送者失败:', error);
      }

      console.log(`交易发送者: ${sender}`);

      // 存储销毁信息
      const burnInfo = {
        found: false,
        token: null,
        amount: '0',
        symbol: '',
        decimals: 9,
        from: sender,
        burnAddress: ''
      };

      // 检查交易日志中是否有代币销毁事件
      if (tx.meta && tx.meta.logMessages && tx.meta.logMessages.length > 0) {
        console.log(`分析交易日志，共 ${tx.meta.logMessages.length} 条`);

        // 定义销毁地址
        const burnAddress = config.burnVerification.sol.burnAddress;

        // 遍历所有日志
        for (const log of tx.meta.logMessages) {
          // 检查是否是 Transfer 事件
          if (log.includes('Transfer') && log.includes(burnAddress)) {
            console.log(`发现代币销毁事件: ${log}`);

            // 尝试从日志中提取信息
            const tokenMatch = log.match(/program: ([a-zA-Z0-9]{32,})/);
            const amountMatch = log.match(/amount: (\d+)/);

            if (tokenMatch && amountMatch) {
              const tokenAddress = tokenMatch[1];
              const amount = amountMatch[1];

              console.log(`代币地址: ${tokenAddress}, 销毁金额: ${amount}`);

              // 获取代币信息
              try {
                const tokenInfo = await this.getTokenInfo(tokenAddress);

                // 更新销毁信息
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: tokenInfo.name || 'Unknown Token',
                  symbol: tokenInfo.symbol || 'UNKNOWN',
                  decimals: tokenInfo.decimals || 9
                };
                burnInfo.amount = amount / Math.pow(10, burnInfo.token.decimals);
                burnInfo.symbol = burnInfo.token.symbol;
                burnInfo.decimals = burnInfo.token.decimals;
                burnInfo.burnAddress = burnAddress;

                // 检查是否是特定的代币合约和数量
                const targetContractAddress = config.burnVerification.sol.targetContractAddress;
                const targetAmount = config.burnVerification.sol.targetAmount;

                // 精确比较合约地址（不区分大小写）
                burnInfo.isTargetContract = tokenAddress.toLowerCase() === targetContractAddress.toLowerCase();

                // 精确比较数量（必须恰好是100，不能多也不能少）
                // 使用字符串比较以避免浮点数精度问题
                const exactAmount = burnInfo.amount.toString().includes('.')
                  ? burnInfo.amount.toString().replace(/\.?0+$/, '') // 移除尾部的零和小数点
                  : burnInfo.amount.toString();
                const exactTargetAmount = targetAmount.includes('.')
                  ? targetAmount.replace(/\.?0+$/, '')
                  : targetAmount;

                burnInfo.isTargetAmount = exactAmount === exactTargetAmount;
                burnInfo.isValidBurn = burnInfo.isTargetContract && burnInfo.isTargetAmount;

                console.log(`销毁数量比较: 实际=${exactAmount}, 目标=${exactTargetAmount}, 匹配=${burnInfo.isTargetAmount}`);
              } catch (error) {
                console.error(`获取代币信息失败: ${error.message}`);

                // 即使获取代币信息失败，也标记为找到销毁事件
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: 'Unknown Token',
                  symbol: 'UNKNOWN',
                  decimals: 9
                };
                burnInfo.amount = amount / Math.pow(10, 9); // 假设小数位是9
                burnInfo.symbol = 'UNKNOWN';
                burnInfo.burnAddress = burnAddress;

                // 检查是否是特定的代币合约
                const targetContractAddress = config.burnVerification.sol.targetContractAddress;
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

  // 获取地址的交易记录
  async getTransactions(address, page = config.pagination.defaultPage, offset = config.pagination.defaultPageSize) {
    try {
      console.log(`获取地址 ${address} 的交易记录，页码: ${page}, 每页数量: ${offset}`);

      // 按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过`);
          continue;
        }

        console.log(`尝试使用 ${providerName} API获取交易记录`);

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            // 创建PublicKey对象
            const publicKey = new PublicKey(address);

            // 获取签名列表
            const signatures = await this.connection.getSignaturesForAddress(
              publicKey,
              {
                limit: offset,
                before: page > 1 ? undefined : undefined // 分页参数，页码从1开始
              }
            );

            console.log(`获取到 ${signatures.length} 条签名记录`);

            // 如果没有签名记录，返回空数组
            if (signatures.length === 0) {
              return [];
            }

            // 获取交易详情
            const transactions = [];

            // 批量获取交易详情，每次最多10个
            const batchSize = 10;
            for (let i = 0; i < signatures.length; i += batchSize) {
              const batch = signatures.slice(i, i + batchSize);
              const promises = batch.map(sig => this.connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
              }));

              const results = await Promise.all(promises);

              // 处理结果
              for (let j = 0; j < results.length; j++) {
                const tx = results[j];
                const sig = batch[j];

                if (tx) {
                  // 格式化交易数据
                  // 不再需要获取accountKeys

                  // 尝试提取发送方和接收方
                  let from = '';
                  let to = '';

                  // 获取账户密钥
                  let accountKeys = [];
                  try {
                    // 尝试获取账户密钥
                    if (tx.transaction.message) {
                      // 打印消息对象的属性，用于调试
                      console.log('消息对象属性:', Object.keys(tx.transaction.message));

                      // 尝试使用getAccountKeys方法
                      if (typeof tx.transaction.message.getAccountKeys === 'function') {
                        const keysObj = tx.transaction.message.getAccountKeys();
                        console.log('getAccountKeys返回类型:', typeof keysObj);

                        if (keysObj && typeof keysObj.keySegments === 'function') {
                          accountKeys = keysObj.keySegments().flat();
                        } else if (Array.isArray(keysObj)) {
                          accountKeys = keysObj;
                        }
                      }
                    }
                  } catch (error) {
                    console.error('获取账户密钥失败:', error);
                  }

                  // 打印交易详情和账户密钥
                  console.log(`交易详情 (${sig.signature.substring(0, 8)}...):`);
                  console.log(`- 区块: ${tx.slot}`);
                  console.log(`- 时间: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'N/A'}`);
                  console.log(`- 状态: ${tx.meta?.status?.Ok ? 'Success' : 'Fail'}`);
                  console.log(`- 费用: ${tx.meta?.fee || 0}`);
                  console.log(`- 账户密钥数量: ${accountKeys.length}`);
                  if (accountKeys.length > 0) {
                    console.log(`- 账户密钥示例: ${accountKeys[0]?.toString()}`);
                  }

                  // 尝试从交易中提取发送方和接收方
                  if (tx.meta && tx.meta.preBalances && tx.meta.postBalances && accountKeys.length > 0) {
                    // 假设第一个账户是发送方（通常是交易签名者）
                    from = accountKeys[0].toString();

                    // 尝试从指令中找到接收方
                    if (tx.meta.innerInstructions && tx.meta.innerInstructions.length > 0) {
                      // 检查内部指令
                      for (const innerInst of tx.meta.innerInstructions) {
                        for (const inst of innerInst.instructions) {
                          if (inst.programIdIndex && inst.accounts && inst.accounts.length > 1) {
                            // 假设第二个账户是接收方
                            const accountIndex = inst.accounts[1];
                            if (accountIndex < accountKeys.length) {
                              to = accountKeys[accountIndex].toString();
                              break;
                            }
                          }
                        }
                        if (to) break;
                      }
                    }

                    // 如果内部指令中没有找到，尝试从主指令中找
                    if (!to && tx.transaction.message.instructions && tx.transaction.message.instructions.length > 0) {
                      for (const inst of tx.transaction.message.instructions) {
                        if (inst.accounts && inst.accounts.length > 1) {
                          // 假设第二个账户是接收方
                          const accountIndex = inst.accounts[1];
                          if (accountIndex < accountKeys.length) {
                            to = accountKeys[accountIndex].toString();
                            break;
                          }
                        }
                      }
                    }
                  }

                  console.log(`提取的发送方和接收方: from=${from}, to=${to}`);

                  transactions.push({
                    signature: sig.signature,
                    slot: tx.slot,
                    blockTime: tx.blockTime,
                    status: tx.meta?.status?.Ok ? 'Success' : 'Fail',
                    fee: tx.meta?.fee || 0,
                    from: from,
                    to: to
                  });
                }
              }
            }

            console.log(`成功获取 ${transactions.length} 条交易记录 (QuickNode)`);
            currentApiProvider = 'quickNode';
            return transactions;
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log('使用SolScan API获取交易记录');
            currentApiProvider = 'solScan';
            const transactions = await this.callSolScanApi('/account/transactions', {
              account: address,
              limit: offset,
              offset: (page - 1) * offset // 页码从1开始
            });

            // 打印SolScan API返回的交易记录示例
            if (transactions && transactions.length > 0) {
              console.log('SolScan API返回的交易记录示例:', JSON.stringify(transactions[0], null, 2));

              // 检查交易记录是否包含发送方和接收方
              const hasSrcAndDst = transactions.every(tx => tx.src && tx.dst);
              if (!hasSrcAndDst) {
                console.log('警告: SolScan API返回的交易记录缺少发送方或接收方字段');

                // 尝试修复缺少的字段
                transactions.forEach(tx => {
                  if (!tx.src) tx.src = '';
                  if (!tx.dst) tx.dst = '';

                  // 将src和dst映射到from和to
                  tx.from = tx.src;
                  tx.to = tx.dst;
                });
              } else {
                console.log('SolScan API返回的交易记录包含发送方和接收方字段');

                // 将src和dst映射到from和to
                transactions.forEach(tx => {
                  tx.from = tx.src;
                  tx.to = tx.dst;
                });
              }
            } else {
              console.log('SolScan API返回的交易记录为空');
            }

            return transactions;
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            // 实现原生Solana RPC API的调用逻辑
            console.log('使用原生Solana RPC API获取交易记录');
            currentApiProvider = 'solNode';

            // 创建PublicKey对象
            const publicKey = new PublicKey(address);

            // 获取签名列表
            const signatures = await this.connection.getSignaturesForAddress(
              publicKey,
              {
                limit: offset,
                before: page > 1 ? undefined : undefined // 分页参数，页码从1开始
              }
            );

            console.log(`获取到 ${signatures.length} 条签名记录`);

            // 如果没有签名记录，返回空数组
            if (signatures.length === 0) {
              return [];
            }

            // 获取交易详情
            const transactions = [];

            // 批量获取交易详情，每次最多10个
            const batchSize = 10;
            for (let i = 0; i < signatures.length; i += batchSize) {
              const batch = signatures.slice(i, i + batchSize);
              const promises = batch.map(sig => this.connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
              }));

              const results = await Promise.all(promises);

              // 处理结果
              for (let j = 0; j < results.length; j++) {
                const tx = results[j];
                const sig = batch[j];

                if (tx) {
                  // 格式化交易数据
                  // 尝试提取发送方和接收方
                  let from = '';
                  let to = '';
                  let lamports = 0;

                  // 尝试从交易中提取lamports值
                  if (tx.meta && tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                    // 这是代币交易
                    console.log('这是代币交易');
                  } else if (tx.meta && tx.meta.preBalances && tx.meta.postBalances) {
                    // 这是SOL交易
                    console.log('这是SOL交易');

                    // 查找余额变化最大的账户
                    let maxDiff = 0;
                    let senderIndex = -1;
                    let receiverIndex = -1;

                    for (let i = 0; i < tx.meta.preBalances.length; i++) {
                      const diff = tx.meta.preBalances[i] - tx.meta.postBalances[i];
                      if (diff > maxDiff) {
                        maxDiff = diff;
                        senderIndex = i;
                      } else if (diff < 0 && Math.abs(diff) > maxDiff) {
                        receiverIndex = i;
                      }
                    }

                    // 设置lamports值
                    lamports = maxDiff;

                    // 获取账户密钥
                    let accountKeys = [];
                    try {
                      if (tx.transaction.message) {
                        if (typeof tx.transaction.message.getAccountKeys === 'function') {
                          const keysObj = tx.transaction.message.getAccountKeys();
                          if (keysObj && typeof keysObj.keySegments === 'function') {
                            accountKeys = keysObj.keySegments().flat();
                          } else if (Array.isArray(keysObj)) {
                            accountKeys = keysObj;
                          }
                        }
                      }
                    } catch (error) {
                      console.error('获取账户密钥失败:', error);
                    }

                    // 设置发送方和接收方
                    if (accountKeys.length > 0) {
                      if (senderIndex >= 0 && senderIndex < accountKeys.length) {
                        from = accountKeys[senderIndex].toString();
                      }
                      if (receiverIndex >= 0 && receiverIndex < accountKeys.length) {
                        to = accountKeys[receiverIndex].toString();
                      }
                    }
                  }

                  transactions.push({
                    signature: sig.signature,
                    slot: tx.slot,
                    blockTime: tx.blockTime,
                    status: tx.meta?.status?.Ok ? 'Success' : 'Fail',
                    fee: tx.meta?.fee || 0,
                    from: from,
                    to: to,
                    lamports: lamports
                  });
                }
              }
            }

            console.log(`成功获取 ${transactions.length} 条交易记录 (原生Solana RPC)`);
            return transactions;
          }
        } catch (error) {
          console.error(`${providerName} API调用失败:`, error);
          console.log(`尝试下一个API提供商...`);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，抛出错误
      throw new Error('所有API提供商都失败，无法获取交易记录');
    } catch (error) {
      console.error('获取交易记录失败:', error);
      throw error;
    }
  }

  // 获取地址的代币转账记录
  async getTokenTransfers(address, page = config.pagination.defaultPage, offset = config.pagination.defaultPageSize) {
    try {
      console.log(`获取地址 ${address} 的代币转账记录，页码: ${page}, 每页数量: ${offset}`);

      // 按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过`);
          continue;
        }

        console.log(`尝试使用 ${providerName} API获取代币转账记录`);

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            // 创建PublicKey对象
            const publicKey = new PublicKey(address);

            // 获取所有代币账户
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
              publicKey,
              { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            console.log(`获取到 ${tokenAccounts.value.length} 个代币账户`);

            // 如果没有代币账户，返回空数组
            if (tokenAccounts.value.length === 0) {
              return [];
            }

            // 处理代币账户信息
            const transfers = [];

            for (const account of tokenAccounts.value) {
              const tokenData = account.account.data.parsed.info;
              const mint = tokenData.mint;
              const amount = tokenData.tokenAmount.amount;
              const decimals = tokenData.tokenAmount.decimals;

              // 获取代币元数据
              let tokenInfo = {
                name: 'Unknown Token',
                symbol: 'UNKNOWN'
              };

              try {
                // 尝试获取代币信息
                tokenInfo = await this.getTokenInfo(mint);
              } catch (error) {
                console.error(`获取代币 ${mint} 信息失败:`, error);
              }

              transfers.push({
                signature: '', // 没有特定的交易签名
                blockTime: Date.now() / 1000, // 当前时间作为占位符
                from: '', // 没有特定的发送方
                to: address,
                mint: mint,
                tokenName: tokenInfo.name,
                tokenSymbol: tokenInfo.symbol,
                tokenDecimal: decimals.toString(),
                amount: amount
              });
            }

            console.log(`成功获取 ${transfers.length} 条代币记录 (QuickNode)`);
            currentApiProvider = 'quickNode';
            return transfers;
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log('使用SolScan API获取代币转账记录');
            currentApiProvider = 'solScan';
            const transfers = await this.callSolScanApi('/account/tokens', {
              account: address,
              limit: offset,
              offset: (page - 1) * offset // 页码从1开始
            });

            // 转换为标准格式
            return this.formatTokenTransfers(transfers, address);
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            // 实现原生Solana RPC API的调用逻辑
            console.log('使用原生Solana RPC API获取代币转账记录');
            currentApiProvider = 'solNode';

            // 创建PublicKey对象
            const publicKey = new PublicKey(address);

            // 获取所有代币账户
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
              publicKey,
              { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            console.log(`获取到 ${tokenAccounts.value.length} 个代币账户`);

            // 如果没有代币账户，返回空数组
            if (tokenAccounts.value.length === 0) {
              return [];
            }

            // 处理代币账户信息
            const transfers = [];

            for (const account of tokenAccounts.value) {
              const tokenData = account.account.data.parsed.info;
              const mint = tokenData.mint;
              const amount = tokenData.tokenAmount.amount;
              const decimals = tokenData.tokenAmount.decimals;

              // 获取代币元数据
              let tokenInfo = {
                name: 'Unknown Token',
                symbol: 'UNKNOWN'
              };

              try {
                // 尝试获取代币信息
                tokenInfo = await this.getTokenInfo(mint);
                console.log(`获取到代币 ${mint} 信息:`, tokenInfo);
              } catch (error) {
                console.error(`获取代币 ${mint} 信息失败:`, error);
                // 设置默认值
                tokenInfo = {
                  name: 'Unknown Token',
                  symbol: mint.substring(0, 8),
                  decimals: decimals
                };
              }

              transfers.push({
                signature: '', // 没有特定的交易签名
                blockTime: Date.now() / 1000, // 当前时间作为占位符
                from: '', // 没有特定的发送方
                to: address,
                mint: mint,
                tokenName: tokenInfo.name || 'Unknown Token',
                tokenSymbol: tokenInfo.symbol || mint.substring(0, 8),
                tokenDecimal: decimals.toString(),
                amount: amount
              });
            }

            console.log(`成功获取 ${transfers.length} 条代币记录 (原生Solana RPC)`);
            return transfers;
          }
        } catch (error) {
          console.error(`${providerName} API调用失败:`, error);
          console.log(`尝试下一个API提供商...`);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，抛出错误
      throw new Error('所有API提供商都失败，无法获取代币转账记录');
    } catch (error) {
      console.error('获取代币转账记录失败:', error);
      throw error;
    }
  }

  // 格式化代币转账记录
  formatTokenTransfers(transfers, address) {
    if (!Array.isArray(transfers)) {
      return [];
    }

    return transfers.map(token => {
      // 获取代币转账历史
      const mint = token.tokenAddress || '';

      // 如果没有代币名称或符号，使用地址的前8位作为默认值
      let tokenName = token.tokenName || 'Unknown Token';
      let tokenSymbol = token.tokenSymbol || (mint ? mint.substring(0, 8) : 'UNKNOWN');

      // 打印代币信息
      console.log(`格式化代币转账记录: mint=${mint}, name=${tokenName}, symbol=${tokenSymbol}`);

      return {
        signature: mint || '',
        blockTime: token.updateTime || Date.now() / 1000,
        from: token.owner || address,
        to: address,
        mint: mint,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        tokenDecimal: token.tokenDecimal || '9',
        amount: token.amount || '0'
      };
    });
  }



  // 获取Metaplex元数据账户地址
  async getMetadataAddress(mintAddress) {
    try {
      // Metaplex元数据程序ID
      const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
      const metadataProgramId = new PublicKey(METADATA_PROGRAM_ID);

      // 代币Mint地址
      const mintPubkey = new PublicKey(mintAddress);

      // 计算元数据账户地址
      const [metadataAddress] = await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          metadataProgramId.toBuffer(),
          mintPubkey.toBuffer()
        ],
        metadataProgramId
      );

      return metadataAddress;
    } catch (error) {
      console.error(`计算元数据地址失败: ${error.message}`);
      return null;
    }
  }

  // 获取代币元数据
  async getTokenMetadata(mintAddress) {
    try {
      console.log(`开始获取代币 ${mintAddress} 的Metaplex元数据...`);

      // 获取元数据账户地址
      console.log(`计算元数据账户地址...`);
      const metadataAddress = await this.getMetadataAddress(mintAddress);
      if (!metadataAddress) {
        console.error(`计算元数据账户地址失败`);
        return null;
      }

      console.log(`获取代币 ${mintAddress} 的元数据，元数据地址: ${metadataAddress.toString()}`);

      // 获取元数据账户信息
      console.log(`获取元数据账户信息...`);
      const accountInfo = await this.connection.getAccountInfo(metadataAddress);

      if (!accountInfo) {
        console.log(`未找到代币 ${mintAddress} 的元数据账户信息`);
        return null;
      }

      console.log(`获取到元数据账户信息:
        - 所有者: ${accountInfo.owner ? accountInfo.owner.toString() : 'null'}
        - 可执行: ${accountInfo.executable}
        - lamports: ${accountInfo.lamports}
        - 数据长度: ${accountInfo.data ? accountInfo.data.length : 0}
      `);

      // 解析元数据
      try {
        console.log(`开始解析元数据...`);

        // 元数据格式: https://docs.metaplex.com/programs/token-metadata/accounts#metadata
        const metadata = {
          name: '',
          symbol: '',
          uri: ''
        };

        // 打印前100个字节，用于调试
        if (accountInfo.data && accountInfo.data.length > 0) {
          const dataHex = Buffer.from(accountInfo.data).toString('hex').substring(0, 200);
          console.log(`元数据前100字节(十六进制): ${dataHex}`);

          // 打印前100个字节的ASCII表示
          let asciiStr = '';
          for (let i = 0; i < Math.min(100, accountInfo.data.length); i++) {
            const byte = accountInfo.data[i];
            if (byte >= 32 && byte <= 126) { // 可打印ASCII字符
              asciiStr += String.fromCharCode(byte);
            } else {
              asciiStr += '.'; // 不可打印字符用点表示
            }
          }
          console.log(`元数据前100字节(ASCII): ${asciiStr}`);
        }

        // 使用更可靠的方法解析元数据
        // Metaplex元数据格式可能有变化，我们尝试几种不同的偏移量

        try {
          // 方法1：标准偏移量
          // 尝试在数据中搜索可能的名称和符号
          let foundMetadata = false;

          // 搜索常见的代币名称和符号模式
          const dataStr = Buffer.from(accountInfo.data).toString('utf8');
          console.log(`尝试从数据字符串中搜索代币名称和符号...`);

          // 在字符串中查找可能的代币名称和符号
          // 通常代币名称和符号会连续出现，并且是可读的ASCII字符
          const matches = dataStr.match(/([A-Za-z0-9_\s]{2,20})\0{1,10}([A-Za-z0-9]{1,10})/g);
          if (matches && matches.length > 0) {
            console.log(`找到可能的名称和符号匹配: ${matches}`);

            // 使用第一个匹配项
            const parts = matches[0].split(/\0+/);
            if (parts.length >= 2) {
              metadata.name = parts[0].trim();
              metadata.symbol = parts[1].trim();
              foundMetadata = true;
              console.log(`从匹配中提取的名称: ${metadata.name}, 符号: ${metadata.symbol}`);
            }
          }

          // 尝试查找URI（通常以http或ipfs开头）
          const uriMatch = dataStr.match(/(https?:\/\/[^\0]+|ipfs:\/\/[^\0]+)/);
          if (uriMatch && uriMatch[0]) {
            metadata.uri = uriMatch[0].trim();
            console.log(`找到URI: ${metadata.uri}`);
          }

          // 如果上面的方法失败，尝试使用固定偏移量
          if (!foundMetadata) {
            console.log(`使用固定偏移量尝试解析...`);

            // 尝试不同的起始偏移量
            const possibleOffsets = [1, 32, 33, 64, 65];

            for (const offset of possibleOffsets) {
              try {
                if (offset + 1 < accountInfo.data.length) {
                  const possibleNameLength = accountInfo.data[offset];

                  if (possibleNameLength > 0 && possibleNameLength < 100 &&
                      offset + 1 + possibleNameLength < accountInfo.data.length) {

                    const nameBuffer = accountInfo.data.slice(offset + 1, offset + 1 + possibleNameLength);
                    const possibleName = nameBuffer.toString('utf8');

                    // 检查名称是否包含可打印字符
                    if (/^[\x20-\x7E]+$/.test(possibleName)) {
                      console.log(`偏移量 ${offset} 找到可能的名称: ${possibleName}`);

                      // 如果找到有效名称，尝试解析符号
                      const symbolOffset = offset + 1 + possibleNameLength;
                      if (symbolOffset < accountInfo.data.length) {
                        const symbolLength = accountInfo.data[symbolOffset];

                        if (symbolLength > 0 && symbolLength < 20 &&
                            symbolOffset + 1 + symbolLength < accountInfo.data.length) {

                          const symbolBuffer = accountInfo.data.slice(symbolOffset + 1, symbolOffset + 1 + symbolLength);
                          const possibleSymbol = symbolBuffer.toString('utf8');

                          if (/^[\x20-\x7E]+$/.test(possibleSymbol)) {
                            console.log(`找到可能的符号: ${possibleSymbol}`);

                            metadata.name = possibleName;
                            metadata.symbol = possibleSymbol;
                            foundMetadata = true;

                            // 尝试解析URI
                            const uriOffset = symbolOffset + 1 + symbolLength;
                            if (uriOffset < accountInfo.data.length) {
                              const uriLength = accountInfo.data[uriOffset];

                              if (uriLength > 0 && uriLength < 200 &&
                                  uriOffset + 1 + uriLength < accountInfo.data.length) {

                                const uriBuffer = accountInfo.data.slice(uriOffset + 1, uriOffset + 1 + uriLength);
                                const possibleUri = uriBuffer.toString('utf8');

                                if (possibleUri.startsWith('http') || possibleUri.startsWith('ipfs')) {
                                  metadata.uri = possibleUri;
                                  console.log(`找到URI: ${possibleUri}`);
                                }
                              }
                            }

                            break; // 找到有效的元数据，退出循环
                          }
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.log(`偏移量 ${offset} 解析失败: ${e.message}`);
              }
            }
          }

          // 使用通用方法解析元数据，不进行特殊处理
          if (!foundMetadata && dataStr.includes('DeepSeek')) {
            console.log(`在数据中找到DeepSeek字符串，但不进行特殊处理`);
            // 不进行特殊处理，使用通用方法
          }

          // 如果所有方法都失败，使用默认值
          if (!foundMetadata) {
            console.log(`无法解析元数据，使用默认值`);
            metadata.name = 'Unknown Token';
            metadata.symbol = mintAddress.substring(0, 8);
          }
        } catch (parseDetailError) {
          console.error(`详细解析元数据失败: ${parseDetailError.message}`);
          // 使用默认值
          metadata.name = 'Unknown Token';
          metadata.symbol = mintAddress.substring(0, 8);
        }

        console.log(`成功解析代币 ${mintAddress} 的元数据:`, metadata);
        return metadata;
      } catch (parseError) {
        console.error(`解析元数据失败: ${parseError.message}`);
        console.error(`解析元数据失败详细信息:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`获取代币元数据失败: ${error.message}`);
      console.error(`获取代币元数据失败详细信息:`, error);
      return null;
    }
  }

  // 获取代币信息
  async getTokenInfo(tokenAddress) {
    try {
      // 按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过获取代币信息`);
          continue;
        }

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            console.log(`使用QuickNode API获取代币 ${tokenAddress} 信息`);

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(tokenAddress);

            // 获取代币信息
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);

            if (!tokenInfo || !tokenInfo.value || !tokenInfo.value.data || !tokenInfo.value.data.parsed) {
              throw new Error('未找到代币信息');
            }

            const parsedInfo = tokenInfo.value.data.parsed;

            if (parsedInfo.type !== 'mint') {
              throw new Error('不是代币合约');
            }

            // 尝试获取代币元数据
            let name = 'Unknown Token';
            let symbol = tokenAddress.substring(0, 8); // 默认使用地址前8位作为符号

            try {
              // 尝试获取Metaplex元数据
              const metadata = await this.getTokenMetadata(tokenAddress);
              if (metadata) {
                name = metadata.name || name;
                symbol = metadata.symbol || symbol;
                console.log(`使用Metaplex元数据: name=${name}, symbol=${symbol}`);
              } else {
                console.log(`未找到Metaplex元数据，使用默认值: name=${name}, symbol=${symbol}`);
              }
            } catch (metadataError) {
              console.error('获取代币元数据失败:', metadataError);
            }

            return {
              name: name,
              symbol: symbol,
              decimals: parsedInfo.info.decimals || 9
            };
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log(`使用SolScan API获取代币 ${tokenAddress} 信息`);

            const tokenInfo = await this.callSolScanApi('/token/meta', {
              tokenAddress: tokenAddress
            });

            // 打印SolScan返回的代币信息
            console.log(`SolScan返回的代币信息:`, tokenInfo);

            // 如果SolScan没有返回名称和符号，尝试获取Metaplex元数据
            let name = tokenInfo.name || 'Unknown Token';
            let symbol = tokenInfo.symbol || tokenAddress.substring(0, 8);

            if (!tokenInfo.name || !tokenInfo.symbol) {
              try {
                const metadata = await this.getTokenMetadata(tokenAddress);
                if (metadata) {
                  name = metadata.name || name;
                  symbol = metadata.symbol || symbol;
                  console.log(`使用Metaplex元数据补充SolScan信息: name=${name}, symbol=${symbol}`);
                }
              } catch (metadataError) {
                console.error('获取Metaplex元数据失败:', metadataError);
              }
            }

            return {
              name: name,
              symbol: symbol,
              decimals: tokenInfo.decimals || 9
            };
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            console.log(`使用原生Solana RPC API获取代币 ${tokenAddress} 信息`);

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(tokenAddress);

            // 获取代币信息
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);

            if (!tokenInfo || !tokenInfo.value || !tokenInfo.value.data || !tokenInfo.value.data.parsed) {
              throw new Error('未找到代币信息');
            }

            const parsedInfo = tokenInfo.value.data.parsed;

            if (parsedInfo.type !== 'mint') {
              throw new Error('不是代币合约');
            }

            // 尝试获取代币元数据
            let name = 'Unknown Token';
            let symbol = tokenAddress.substring(0, 8); // 默认使用地址前8位作为符号

            try {
              // 尝试获取Metaplex元数据
              const metadata = await this.getTokenMetadata(tokenAddress);
              if (metadata) {
                name = metadata.name || name;
                symbol = metadata.symbol || symbol;
                console.log(`使用Metaplex元数据: name=${name}, symbol=${symbol}`);
              } else {
                console.log(`未找到Metaplex元数据，使用默认值: name=${name}, symbol=${symbol}`);
              }
            } catch (metadataError) {
              console.error('获取代币元数据失败:', metadataError);
            }

            return {
              name: name,
              symbol: symbol,
              decimals: parsedInfo.info.decimals || 9
            };
          }
        } catch (error) {
          console.error(`使用 ${providerName} 获取代币信息失败:`, error);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，返回默认值
      console.warn(`所有API提供商都无法获取代币 ${tokenAddress} 信息，返回默认值`);
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 9
      };
    } catch (error) {
      console.error(`获取代币 ${tokenAddress} 信息失败:`, error);
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 9
      };
    }
  }

  // 获取合约信息
  async getContractInfo(contractAddress) {
    try {
      console.log(`获取合约信息 - 合约地址: ${contractAddress}`);

      // 按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过获取合约信息`);
          continue;
        }

        console.log(`尝试使用 ${providerName} API获取合约信息`);

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            console.log('使用QuickNode API获取合约信息');
            currentApiProvider = 'quickNode';

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(contractAddress);
            console.log(`合约地址: ${contractAddress}, PublicKey: ${mintPubkey.toString()}`);

            // 获取代币信息
            console.log(`开始获取代币账户信息...`);
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
            console.log(`获取代币账户信息完成, 响应类型: ${typeof tokenInfo}`);

            if (!tokenInfo || !tokenInfo.value) {
              console.error(`未找到合约信息, tokenInfo: ${JSON.stringify(tokenInfo)}`);
              throw new Error('未找到合约信息');
            }

            // 打印完整的tokenInfo对象
            console.log(`代币账户信息: ${JSON.stringify({
              context: tokenInfo.context,
              value: {
                data: tokenInfo.value.data ? {
                  parsed: tokenInfo.value.data.parsed ? {
                    type: tokenInfo.value.data.parsed.type,
                    info: tokenInfo.value.data.parsed.info ? Object.keys(tokenInfo.value.data.parsed.info) : null
                  } : null
                } : null,
                executable: tokenInfo.value.executable,
                lamports: tokenInfo.value.lamports,
                owner: tokenInfo.value.owner ? tokenInfo.value.owner.toString() : null,
                rentEpoch: tokenInfo.value.rentEpoch
              }
            }, null, 2)}`);

            // 解析代币信息
            let parsedInfo = {};
            let mintAuthority = '';
            let decimals = 0;
            let supply = '0';

            if (tokenInfo.value.data && tokenInfo.value.data.parsed) {
              parsedInfo = tokenInfo.value.data.parsed;
              console.log(`解析的代币信息: type=${parsedInfo.type}, info=${JSON.stringify(parsedInfo.info)}`);

              if (parsedInfo.type === 'mint') {
                mintAuthority = parsedInfo.info.mintAuthority || '';
                decimals = parsedInfo.info.decimals || 0;
                supply = parsedInfo.info.supply || '0';

                console.log(`代币Mint信息: mintAuthority=${mintAuthority}, decimals=${decimals}, supply=${supply}`);
              } else {
                console.log(`非Mint类型的代币账户: ${parsedInfo.type}`);
              }
            } else {
              console.log(`代币账户没有parsed数据`);
            }

            // 获取合约余额
            console.log(`获取合约SOL余额...`);
            const balance = await this.getAddressBalance(contractAddress);
            console.log(`合约SOL余额: ${balance} SOL`);

            // 获取代币持有者信息（这需要额外的查询，这里简化处理）
            const holdersInfo = [];

            // 构建合约信息对象
            const contractInfo = {
              name: 'Unknown Token',
              symbol: 'UNKNOWN',
              decimals: decimals,
              supply: supply,
              mintAuthority: mintAuthority
            };

            // 尝试获取代币元数据
            try {
              console.log(`尝试获取代币元数据...`);
              const metadataInfo = await this.getTokenInfo(contractAddress);
              console.log(`获取到的代币元数据: ${JSON.stringify(metadataInfo)}`);

              if (metadataInfo) {
                // 只有当元数据中的名称不是默认值时才更新
                if (metadataInfo.name && metadataInfo.name !== 'Unknown Token') {
                  contractInfo.name = metadataInfo.name;
                }

                // 只有当元数据中的符号不是默认值时才更新
                if (metadataInfo.symbol && metadataInfo.symbol !== 'UNKNOWN') {
                  contractInfo.symbol = metadataInfo.symbol;
                }

                console.log(`更新合约信息: name=${contractInfo.name}, symbol=${contractInfo.symbol}`);
              } else {
                console.log(`未获取到代币元数据`);
              }
            } catch (metadataError) {
              console.error('获取代币元数据失败:', metadataError);
            }

            // 计算总供应量
            const totalSupply = (parseInt(supply) / Math.pow(10, decimals)).toLocaleString();

            // 尝试获取元数据
            let metadata = null;
            try {
              console.log(`尝试获取代币 ${contractAddress} 的元数据`);
              metadata = await this.getTokenMetadata(contractAddress);
              console.log(`获取到的元数据:`, metadata);

              // 如果获取到有效的元数据，直接更新contractInfo
              if (metadata && metadata.name) {
                console.log(`直接从元数据更新合约信息: name=${metadata.name}, symbol=${metadata.symbol}`);
                contractInfo.name = metadata.name;
                contractInfo.symbol = metadata.symbol || contractInfo.symbol;
              }
            } catch (metadataError) {
              console.error(`获取元数据失败:`, metadataError);
            }

            // 构建结果对象
            const result = {
              success: true,
              result: {
                contractInfo,
                holdersInfo,
                balance,
                totalSupply,
                metadata // 添加元数据
              }
            };

            console.log(`合约 ${contractAddress} 信息获取成功 (QuickNode)`);
            return result;
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log('使用SolScan API获取合约信息');
            currentApiProvider = 'solScan';

            // 获取当前使用的 API Key
            const apiKey = this.getCurrentApiKey('solScan');
            console.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : '无'}, API 提供商: ${this.getCurrentApiProvider()}`);

            // 获取合约元数据
            let contractInfo = await this.callSolScanApi('/token/meta', {
              tokenAddress: contractAddress
            });

            // 打印SolScan返回的合约信息
            console.log(`SolScan返回的合约信息:`, contractInfo);

            // 如果SolScan没有返回名称和符号，尝试获取Metaplex元数据
            if (!contractInfo.name || !contractInfo.symbol) {
              try {
                console.log(`尝试获取Metaplex元数据补充SolScan信息`);
                const metadata = await this.getTokenMetadata(contractAddress);
                if (metadata) {
                  // 使用Metaplex元数据补充SolScan信息
                  contractInfo.name = metadata.name || contractInfo.name || 'Unknown Token';
                  contractInfo.symbol = metadata.symbol || contractInfo.symbol || contractAddress.substring(0, 8);
                  console.log(`使用Metaplex元数据补充SolScan信息: name=${contractInfo.name}, symbol=${contractInfo.symbol}`);
                }
              } catch (metadataError) {
                console.error('获取Metaplex元数据失败:', metadataError);
              }
            }

            // 获取合约持有者信息
            const holdersInfo = await this.callSolScanApi('/token/holders', {
              tokenAddress: contractAddress,
              limit: 10
            });

            // 获取合约余额
            const balance = await this.getAddressBalance(contractAddress);

            // 获取代币总供应量
            const totalSupply = await this.getTokenTotalSupply(contractAddress);

            // 尝试获取元数据
            let metadata = null;
            try {
              console.log(`尝试获取代币 ${contractAddress} 的元数据`);
              metadata = await this.getTokenMetadata(contractAddress);
              console.log(`获取到的元数据:`, metadata);

              // 如果获取到有效的元数据，直接更新contractInfo
              if (metadata && metadata.name) {
                console.log(`直接从元数据更新合约信息: name=${metadata.name}, symbol=${metadata.symbol}`);
                contractInfo.name = metadata.name;
                contractInfo.symbol = metadata.symbol || contractInfo.symbol;
              }
            } catch (metadataError) {
              console.error(`获取元数据失败:`, metadataError);
            }

            // 构建合约信息对象
            const result = {
              success: true,
              result: {
                contractInfo,
                holdersInfo,
                balance,
                totalSupply,
                metadata // 添加元数据
              }
            };

            console.log(`合约 ${contractAddress} 信息获取成功 (SolScan)`);
            return result;
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            console.log('使用原生Solana RPC API获取合约信息');
            currentApiProvider = 'solNode';

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(contractAddress);
            console.log(`合约地址: ${contractAddress}, PublicKey: ${mintPubkey.toString()}`);

            // 获取代币信息
            console.log(`开始获取代币账户信息...`);
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
            console.log(`获取代币账户信息完成, 响应类型: ${typeof tokenInfo}`);

            if (!tokenInfo || !tokenInfo.value) {
              console.error(`未找到合约信息, tokenInfo: ${JSON.stringify(tokenInfo)}`);
              throw new Error('未找到合约信息');
            }

            // 打印完整的tokenInfo对象
            console.log(`代币账户信息: ${JSON.stringify({
              context: tokenInfo.context,
              value: {
                data: tokenInfo.value.data ? {
                  parsed: tokenInfo.value.data.parsed ? {
                    type: tokenInfo.value.data.parsed.type,
                    info: tokenInfo.value.data.parsed.info ? Object.keys(tokenInfo.value.data.parsed.info) : null
                  } : null
                } : null,
                executable: tokenInfo.value.executable,
                lamports: tokenInfo.value.lamports,
                owner: tokenInfo.value.owner ? tokenInfo.value.owner.toString() : null,
                rentEpoch: tokenInfo.value.rentEpoch
              }
            }, null, 2)}`);

            // 解析代币信息
            let parsedInfo = {};
            let mintAuthority = '';
            let decimals = 0;
            let supply = '0';

            if (tokenInfo.value.data && tokenInfo.value.data.parsed) {
              parsedInfo = tokenInfo.value.data.parsed;
              console.log(`解析的代币信息: type=${parsedInfo.type}, info=${JSON.stringify(parsedInfo.info)}`);

              if (parsedInfo.type === 'mint') {
                mintAuthority = parsedInfo.info.mintAuthority || '';
                decimals = parsedInfo.info.decimals || 0;
                supply = parsedInfo.info.supply || '0';

                console.log(`代币Mint信息: mintAuthority=${mintAuthority}, decimals=${decimals}, supply=${supply}`);
              } else {
                console.log(`非Mint类型的代币账户: ${parsedInfo.type}`);
              }
            } else {
              console.log(`代币账户没有parsed数据`);
            }

            // 获取合约余额
            console.log(`获取合约SOL余额...`);
            const balance = await this.getAddressBalance(contractAddress);
            console.log(`合约SOL余额: ${balance} SOL`);

            // 获取代币持有者信息（这需要额外的查询，这里简化处理）
            const holdersInfo = [];

            // 构建合约信息对象
            const contractInfo = {
              name: 'Unknown Token',
              symbol: 'UNKNOWN',
              decimals: decimals,
              supply: supply,
              mintAuthority: mintAuthority
            };

            // 尝试获取代币元数据
            try {
              console.log(`尝试获取代币元数据...`);
              const metadataInfo = await this.getTokenInfo(contractAddress);
              console.log(`获取到的代币元数据: ${JSON.stringify(metadataInfo)}`);

              if (metadataInfo) {
                // 只有当元数据中的名称不是默认值时才更新
                if (metadataInfo.name && metadataInfo.name !== 'Unknown Token') {
                  contractInfo.name = metadataInfo.name;
                }

                // 只有当元数据中的符号不是默认值时才更新
                if (metadataInfo.symbol && metadataInfo.symbol !== 'UNKNOWN') {
                  contractInfo.symbol = metadataInfo.symbol;
                }

                console.log(`更新合约信息: name=${contractInfo.name}, symbol=${contractInfo.symbol}`);
              } else {
                console.log(`未获取到代币元数据`);
              }
            } catch (metadataError) {
              console.error('获取代币元数据失败:', metadataError);
            }

            // 计算总供应量
            const totalSupply = (parseInt(supply) / Math.pow(10, decimals)).toLocaleString();

            // 尝试获取元数据
            let metadata = null;
            try {
              console.log(`尝试获取代币 ${contractAddress} 的元数据`);
              metadata = await this.getTokenMetadata(contractAddress);
              console.log(`获取到的元数据:`, metadata);

              // 如果获取到有效的元数据，直接更新contractInfo
              if (metadata && metadata.name) {
                console.log(`直接从元数据更新合约信息: name=${metadata.name}, symbol=${metadata.symbol}`);
                contractInfo.name = metadata.name;
                contractInfo.symbol = metadata.symbol || contractInfo.symbol;
              }
            } catch (metadataError) {
              console.error(`获取元数据失败:`, metadataError);
            }

            // 构建结果对象
            const result = {
              success: true,
              result: {
                contractInfo,
                holdersInfo,
                balance,
                totalSupply,
                metadata // 添加元数据
              }
            };

            console.log(`合约 ${contractAddress} 信息获取成功 (原生Solana RPC)`);
            return result;
          }
        } catch (error) {
          console.error(`使用 ${providerName} 获取合约信息失败:`, error);
          console.log(`尝试下一个API提供商...`);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，抛出错误
      throw new Error('所有API提供商都失败，无法获取合约信息');
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 信息失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取地址的 SOL 余额
  async getAddressBalance(address) {
    try {
      console.log(`获取地址 ${address} 的 SOL 余额`);

      const balance = await this.connection.getBalance(new PublicKey(address));

      // 将 lamports 转换为 SOL
      const solBalance = balance / 1e9;
      console.log(`地址 ${address} 的 SOL 余额: ${solBalance} SOL`);
      return solBalance.toFixed(6);
    } catch (error) {
      console.error(`获取地址 ${address} 的 SOL 余额失败:`, error);
      return '0';
    }
  }

  // 获取代币的总供应量
  async getTokenTotalSupply(tokenAddress) {
    try {
      console.log(`获取代币 ${tokenAddress} 的总供应量`);

      // 按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过获取代币总供应量`);
          continue;
        }

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            console.log(`使用QuickNode API获取代币 ${tokenAddress} 总供应量`);

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(tokenAddress);

            // 获取代币信息
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);

            if (!tokenInfo || !tokenInfo.value || !tokenInfo.value.data || !tokenInfo.value.data.parsed) {
              throw new Error('未找到代币信息');
            }

            const parsedInfo = tokenInfo.value.data.parsed;

            if (parsedInfo.type !== 'mint') {
              throw new Error('不是代币合约');
            }

            const supply = parsedInfo.info.supply || '0';
            const decimals = parsedInfo.info.decimals || 9;

            const totalSupply = parseFloat(supply) / Math.pow(10, decimals);
            console.log(`代币 ${tokenAddress} 的总供应量: ${totalSupply} (QuickNode)`);
            return totalSupply.toLocaleString();
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log(`使用SolScan API获取代币 ${tokenAddress} 总供应量`);

            const tokenInfo = await this.callSolScanApi('/token/meta', {
              tokenAddress: tokenAddress
            });

            if (tokenInfo && tokenInfo.supply) {
              const decimals = tokenInfo.decimals || 9;
              const totalSupply = parseFloat(tokenInfo.supply) / Math.pow(10, decimals);
              console.log(`代币 ${tokenAddress} 的总供应量: ${totalSupply} (SolScan)`);
              return totalSupply.toLocaleString();
            }

            throw new Error('SolScan API未返回代币供应量');
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            console.log(`使用原生Solana RPC API获取代币 ${tokenAddress} 总供应量`);

            // 创建PublicKey对象
            const mintPubkey = new PublicKey(tokenAddress);

            // 获取代币信息
            const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);

            if (!tokenInfo || !tokenInfo.value || !tokenInfo.value.data || !tokenInfo.value.data.parsed) {
              throw new Error('未找到代币信息');
            }

            const parsedInfo = tokenInfo.value.data.parsed;

            if (parsedInfo.type !== 'mint') {
              throw new Error('不是代币合约');
            }

            const supply = parsedInfo.info.supply || '0';
            const decimals = parsedInfo.info.decimals || 9;

            const totalSupply = parseFloat(supply) / Math.pow(10, decimals);
            console.log(`代币 ${tokenAddress} 的总供应量: ${totalSupply} (原生Solana RPC)`);
            return totalSupply.toLocaleString();
          }
        } catch (error) {
          console.error(`使用 ${providerName} 获取代币总供应量失败:`, error);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，返回默认值
      console.warn(`所有API提供商都无法获取代币 ${tokenAddress} 总供应量，返回默认值`);
      return 'Unknown';
    } catch (error) {
      console.error(`获取代币 ${tokenAddress} 的总供应量失败:`, error);
      return 'Unknown';
    }
  }

  // 获取合约创建者信息
  async getContractCreator(contractAddress) {
    try {
      console.log(`获取合约 ${contractAddress} 创建者信息 - 开始调试`);
      console.log(`合约地址类型: ${typeof contractAddress}`);
      console.log(`合约地址长度: ${contractAddress.length}`);
      console.log(`合约地址: ${contractAddress}`);

      // 从配置中获取指定的API提供商
      const configuredProvider = config.creatorQuery && config.creatorQuery.provider;
      console.log(`配置中指定的API提供商: ${configuredProvider || '未指定'}`);

      // 如果配置中指定了API提供商，则只使用该提供商
      if (configuredProvider) {
        // 获取API密钥
        let apiKey = '';
        if (configuredProvider === 'solScan' && config.solScan && config.solScan.apiKeys && config.solScan.apiKeys.length > 0) {
          apiKey = config.solScan.apiKeys[0];
        } else if (configuredProvider === 'quickNode' && config.quickNode && config.quickNode.apiKeys && config.quickNode.apiKeys.length > 0) {
          apiKey = config.quickNode.apiKeys[0];
        } else if (configuredProvider === 'shyft' && config.shyft && config.shyft.apiKeys && config.shyft.apiKeys.length > 0) {
          apiKey = config.shyft.apiKeys[0];
        }

        // 只要有API密钥就使用，不检查是否启用
        if (apiKey || configuredProvider === 'solNode') {
          console.log(`根据配置，只使用 ${configuredProvider} API获取合约创建者信息`);
          if (apiKey) {
            console.log(`使用API密钥: ${apiKey.substring(0, 10)}...`);
          }

          try {
            // 使用指定的API提供商获取合约创建者信息
            if (configuredProvider === 'quickNode') {
              // 使用QuickNode API的代码
              return await this.getContractCreatorWithQuickNode(contractAddress);
            } else if (configuredProvider === 'solScan') {
              // 使用SolScan API的代码
              return await this.getContractCreatorWithSolScan(contractAddress);
            } else if (configuredProvider === 'solNode') {
              // 使用原生Solana RPC API的代码
              return await this.getContractCreatorWithSolNode(contractAddress);
            } else if (configuredProvider === 'shyft') {
              // 使用Shyft API的代码
              return await this.getContractCreatorWithShyft(contractAddress);
            } else {
              console.warn(`未知的API提供商: ${configuredProvider}`);
              return [];
            }
          } catch (error) {
            console.error(`使用配置的API提供商 ${configuredProvider} 获取合约创建者信息失败:`, error);
            return [];
          }
        } else {
          console.log(`配置的API提供商 ${configuredProvider} 没有API密钥，无法使用`);
          return [];
        }
      }

      // 如果没有配置API提供商或配置的提供商未启用，则按照优先级尝试不同的API提供商
      for (const apiProvider of this.apiPriorities) {
        const providerName = apiProvider.name;

        // 检查API提供商是否启用
        if (!this.apiProviders[providerName]) {
          console.log(`API提供商 ${providerName} 未启用，跳过获取合约创建者信息`);
          continue;
        }

        try {
          // 使用QuickNode API
          if (providerName === 'quickNode') {
            console.log(`使用QuickNode API获取合约 ${contractAddress} 创建者信息`);

            try {
              // 创建PublicKey对象
              console.log('尝试创建PublicKey对象...');
              const mintPubkey = new PublicKey(contractAddress);
              console.log('PublicKey对象创建成功:', mintPubkey.toString());

              // 获取代币信息
              console.log('尝试获取代币信息...');
              const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
              console.log('获取代币信息结果:', tokenInfo ? '成功' : '失败');

              if (!tokenInfo) {
                console.error('tokenInfo为空');
                throw new Error('未找到合约信息 - tokenInfo为空');
              }

              if (!tokenInfo.value) {
                console.error('tokenInfo.value为空');
                throw new Error('未找到合约信息 - tokenInfo.value为空');
              }

              if (!tokenInfo.value.data) {
                console.error('tokenInfo.value.data为空');
                throw new Error('未找到合约信息 - tokenInfo.value.data为空');
              }

              if (!tokenInfo.value.data.parsed) {
                console.error('tokenInfo.value.data.parsed为空');
                throw new Error('未找到合约信息 - tokenInfo.value.data.parsed为空');
              }

              const parsedInfo = tokenInfo.value.data.parsed;
              console.log('解析的信息类型:', parsedInfo.type);

              if (parsedInfo.type !== 'mint') {
                console.error('不是代币合约，类型为:', parsedInfo.type);
                throw new Error(`不是代币合约 - 类型为: ${parsedInfo.type}`);
              }

              console.log('代币信息:', JSON.stringify(parsedInfo.info, null, 2));
              const mintAuthority = parsedInfo.info.mintAuthority || '';
              console.log('铸币权限:', mintAuthority);

              if (mintAuthority) {
                console.log('找到合约创建者:', mintAuthority);
                return [{
                  contractCreator: mintAuthority,
                  txHash: ''
                }];
              }

              console.error('未找到铸币权限信息');
              throw new Error('未找到合约创建者信息 - 铸币权限为空');
            } catch (quickNodeError) {
              console.error('QuickNode API处理过程中出错:', quickNodeError);
              throw quickNodeError;
            }
          }

          // 使用SolScan API
          else if (providerName === 'solScan') {
            console.log(`使用SolScan API获取合约 ${contractAddress} 创建者信息`);

            try {
              console.log('调用SolScan API /token/meta...');
              const tokenInfo = await this.callSolScanApi('/token/meta', {
                tokenAddress: contractAddress
              });

              console.log('SolScan API返回结果:', JSON.stringify(tokenInfo, null, 2));

              if (!tokenInfo) {
                console.error('SolScan API返回空结果');
                throw new Error('SolScan API返回空结果');
              }

              if (tokenInfo.mintAuthority) {
                console.log('找到铸币权限:', tokenInfo.mintAuthority);
                return [{
                  contractCreator: tokenInfo.mintAuthority,
                  txHash: ''
                }];
              }

              console.error('SolScan API返回结果中没有mintAuthority字段');
              throw new Error('SolScan API未返回合约创建者信息 - 没有mintAuthority字段');
            } catch (solScanError) {
              console.error('SolScan API处理过程中出错:', solScanError);
              throw solScanError;
            }
          }

          // 使用原生Solana RPC API
          else if (providerName === 'solNode') {
            console.log(`使用原生Solana RPC API获取合约 ${contractAddress} 创建者信息`);

            try {
              // 创建PublicKey对象
              console.log('尝试创建PublicKey对象...');
              const mintPubkey = new PublicKey(contractAddress);
              console.log('PublicKey对象创建成功:', mintPubkey.toString());

              // 获取代币信息
              console.log('尝试获取代币信息...');
              const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
              console.log('获取代币信息结果:', tokenInfo ? '成功' : '失败');

              if (!tokenInfo) {
                console.error('tokenInfo为空');
                throw new Error('未找到合约信息 - tokenInfo为空');
              }

              if (!tokenInfo.value) {
                console.error('tokenInfo.value为空');
                throw new Error('未找到合约信息 - tokenInfo.value为空');
              }

              if (!tokenInfo.value.data) {
                console.error('tokenInfo.value.data为空');
                throw new Error('未找到合约信息 - tokenInfo.value.data为空');
              }

              if (!tokenInfo.value.data.parsed) {
                console.error('tokenInfo.value.data.parsed为空');
                throw new Error('未找到合约信息 - tokenInfo.value.data.parsed为空');
              }

              const parsedInfo = tokenInfo.value.data.parsed;
              console.log('解析的信息类型:', parsedInfo.type);

              if (parsedInfo.type !== 'mint') {
                console.error('不是代币合约，类型为:', parsedInfo.type);
                throw new Error(`不是代币合约 - 类型为: ${parsedInfo.type}`);
              }

              console.log('代币信息:', JSON.stringify(parsedInfo.info, null, 2));
              const mintAuthority = parsedInfo.info.mintAuthority || '';
              console.log('铸币权限:', mintAuthority);

              if (mintAuthority) {
                console.log('找到合约创建者:', mintAuthority);
                return [{
                  contractCreator: mintAuthority,
                  txHash: ''
                }];
              }

              console.error('未找到铸币权限信息');
              throw new Error('未找到合约创建者信息 - 铸币权限为空');
            } catch (solNodeError) {
              console.error('原生Solana RPC API处理过程中出错:', solNodeError);
              throw solNodeError;
            }
          }
        } catch (error) {
          console.error(`使用 ${providerName} 获取合约创建者信息失败:`, error);
          // 继续尝试下一个API提供商
        }
      }

      // 如果所有API提供商都失败，返回空数组
      console.warn(`所有API提供商都无法获取合约 ${contractAddress} 创建者信息，返回空数组`);
      console.warn('尝试过的API提供商:', this.apiPriorities.map(p => p.name).join(', '));
      return [];
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 创建者信息失败:`, error);
      console.error('错误堆栈:', error.stack);
      return [];
    }
  }

  // 使用QuickNode API获取合约创建者信息
  async getContractCreatorWithQuickNode(contractAddress) {
    console.log(`使用QuickNode API获取合约 ${contractAddress} 创建者信息`);

    try {
      // 创建PublicKey对象
      console.log('尝试创建PublicKey对象...');
      const mintPubkey = new PublicKey(contractAddress);
      console.log('PublicKey对象创建成功:', mintPubkey.toString());

      // 获取代币信息
      console.log('尝试获取代币信息...');
      const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
      console.log('获取代币信息结果:', tokenInfo ? '成功' : '失败');

      if (!tokenInfo) {
        console.error('tokenInfo为空');
        throw new Error('未找到合约信息 - tokenInfo为空');
      }

      if (!tokenInfo.value) {
        console.error('tokenInfo.value为空');
        throw new Error('未找到合约信息 - tokenInfo.value为空');
      }

      if (!tokenInfo.value.data) {
        console.error('tokenInfo.value.data为空');
        throw new Error('未找到合约信息 - tokenInfo.value.data为空');
      }

      if (!tokenInfo.value.data.parsed) {
        console.error('tokenInfo.value.data.parsed为空');
        throw new Error('未找到合约信息 - tokenInfo.value.data.parsed为空');
      }

      const parsedInfo = tokenInfo.value.data.parsed;
      console.log('解析的信息类型:', parsedInfo.type);

      if (parsedInfo.type !== 'mint') {
        console.error('不是代币合约，类型为:', parsedInfo.type);
        throw new Error(`不是代币合约 - 类型为: ${parsedInfo.type}`);
      }

      console.log('代币信息:', JSON.stringify(parsedInfo.info, null, 2));
      const mintAuthority = parsedInfo.info.mintAuthority || '';
      console.log('铸币权限:', mintAuthority);

      if (mintAuthority) {
        console.log('找到合约创建者:', mintAuthority);
        return [{
          contractCreator: mintAuthority,
          txHash: ''
        }];
      }

      console.error('未找到铸币权限信息');
      throw new Error('未找到合约创建者信息 - 铸币权限为空');
    } catch (error) {
      console.error('QuickNode API处理过程中出错:', error);
      throw error;
    }
  }

  // 使用SolScan API获取合约创建者信息
  async getContractCreatorWithSolScan(contractAddress) {
    console.log(`使用SolScan API获取合约 ${contractAddress} 创建者信息`);

    try {
      console.log('调用SolScan API /token/meta...');
      const tokenInfo = await this.callSolScanApi('/token/meta', {
        tokenAddress: contractAddress
      });

      console.log('SolScan API返回结果:', JSON.stringify(tokenInfo, null, 2));

      if (!tokenInfo) {
        console.error('SolScan API返回空结果');
        throw new Error('SolScan API返回空结果');
      }

      if (tokenInfo.mintAuthority) {
        console.log('找到铸币权限:', tokenInfo.mintAuthority);
        return [{
          contractCreator: tokenInfo.mintAuthority,
          txHash: ''
        }];
      }

      console.error('SolScan API返回结果中没有mintAuthority字段');
      throw new Error('SolScan API未返回合约创建者信息 - 没有mintAuthority字段');
    } catch (error) {
      console.error('SolScan API处理过程中出错:', error);
      throw error;
    }
  }

  // 使用Shyft API获取合约创建者信息
  async getContractCreatorWithShyft(contractAddress) {
    console.log(`使用Shyft API获取合约 ${contractAddress} 创建者信息`);

    try {
      // 获取API密钥
      const apiKey = this.getCurrentApiKey('shyft');
      if (!apiKey) {
        throw new Error('Shyft API密钥未配置');
      }

      // 首先尝试获取代币元数据中的创建者信息
      console.log('调用Shyft API /token/metadata...');
      let response = await axios.get(`${config.shyft.apiUrl}/token/metadata`, {
        params: {
          network: 'mainnet-beta',
          token_address: contractAddress
        },
        headers: {
          'x-api-key': apiKey
        }
      });

      console.log('Shyft API元数据返回结果:', JSON.stringify(response.data, null, 2));

      // 检查元数据中是否有创建者信息
      if (response.data.success && response.data.result && response.data.result.creators && response.data.result.creators.length > 0) {
        // 找到了创建者信息
        const creators = response.data.result.creators;
        console.log('找到代币创建者:', creators);

        // 返回所有创建者
        return creators.map(creator => ({
          contractCreator: creator.address,
          txHash: '',
          share: creator.share,
          verified: creator.verified
        }));
      }

      // 如果元数据中没有创建者信息，尝试获取代币基本信息
      console.log('元数据中没有创建者信息，尝试获取代币基本信息...');
      console.log('调用Shyft API /token/get_info...');
      response = await axios.get(`${config.shyft.apiUrl}/token/get_info`, {
        params: {
          network: 'mainnet-beta',
          token_address: contractAddress
        },
        headers: {
          'x-api-key': apiKey
        }
      });

      console.log('Shyft API代币信息返回结果:', JSON.stringify(response.data, null, 2));

      if (!response.data || response.data.error) {
        console.error('Shyft API返回错误:', response.data ? response.data.error : '未知错误');
        throw new Error('Shyft API返回错误');
      }

      // 尝试从响应中提取铸币权限
      if (response.data.result && response.data.result.mint_authority && response.data.result.mint_authority !== '') {
        console.log('找到铸币权限:', response.data.result.mint_authority);
        return [{
          contractCreator: response.data.result.mint_authority,
          txHash: ''
        }];
      }

      // 如果以上方法都失败，尝试获取代币的第一笔交易
      console.log('尝试获取代币的第一笔交易...');
      console.log('调用Shyft API /token/events...');
      response = await axios.get(`${config.shyft.apiUrl}/token/events`, {
        params: {
          network: 'mainnet-beta',
          token_address: contractAddress,
          type: 'all',
          page: 1,
          size: 1
        },
        headers: {
          'x-api-key': apiKey
        }
      });

      console.log('Shyft API代币事件返回结果:', JSON.stringify(response.data, null, 2));

      if (response.data.success && response.data.result && response.data.result.length > 0) {
        // 找到了代币事件
        const firstEvent = response.data.result[0];
        if (firstEvent.signer) {
          console.log('找到代币第一笔交易的签名者:', firstEvent.signer);
          return [{
            contractCreator: firstEvent.signer,
            txHash: firstEvent.signature || ''
          }];
        }
      }

      console.error('无法通过Shyft API找到合约创建者信息');
      throw new Error('Shyft API未返回合约创建者信息');
    } catch (error) {
      console.error('Shyft API处理过程中出错:', error);
      throw error;
    }
  }

  // 使用原生Solana RPC API获取合约创建者信息
  async getContractCreatorWithSolNode(contractAddress) {
    console.log(`使用原生Solana RPC API获取合约 ${contractAddress} 创建者信息`);

    try {
      // 创建PublicKey对象
      console.log('尝试创建PublicKey对象...');
      const mintPubkey = new PublicKey(contractAddress);
      console.log('PublicKey对象创建成功:', mintPubkey.toString());

      // 步骤1: 获取代币基本信息（铸币权限）
      console.log('尝试获取代币基本信息...');
      const tokenInfo = await this.connection.getParsedAccountInfo(mintPubkey);
      console.log('获取代币信息结果:', tokenInfo ? '成功' : '失败');

      if (!tokenInfo || !tokenInfo.value || !tokenInfo.value.data || !tokenInfo.value.data.parsed) {
        console.error('无法解析代币信息');
      } else {
        const parsedInfo = tokenInfo.value.data.parsed;
        console.log('解析的信息类型:', parsedInfo.type);

        if (parsedInfo.type === 'mint') {
          console.log('代币信息:', JSON.stringify(parsedInfo.info, null, 2));
          const mintAuthority = parsedInfo.info.mintAuthority || '';
          console.log('铸币权限:', mintAuthority);

          if (mintAuthority) {
            console.log('找到铸币权限:', mintAuthority);
            return [{
              contractCreator: mintAuthority,
              txHash: '',
              source: 'mintAuthority'
            }];
          }
        }
      }

      // 步骤2: 尝试获取代币元数据中的创建者信息
      console.log('尝试获取代币元数据...');
      try {
        // 定义元数据程序ID
        const metadataProgramId = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

        // 计算元数据账户地址
        const [metadataAddress] = await PublicKey.findProgramAddress(
          [
            Buffer.from('metadata'),
            metadataProgramId.toBuffer(),
            mintPubkey.toBuffer()
          ],
          metadataProgramId
        );

        console.log('元数据地址:', metadataAddress.toString());

        // 获取元数据账户信息
        const metadataInfo = await this.connection.getAccountInfo(metadataAddress);

        if (metadataInfo && metadataInfo.data) {
          console.log('获取到元数据账户信息，数据长度:', metadataInfo.data.length);
          console.log('元数据账户所有者:', metadataInfo.owner.toString());

          // 打印元数据的前100个字节，以十六进制形式
          let hexData = '';
          for (let i = 0; i < Math.min(100, metadataInfo.data.length); i++) {
            hexData += metadataInfo.data[i].toString(16).padStart(2, '0') + ' ';
            if ((i + 1) % 16 === 0) hexData += '\n';
          }
          console.log('元数据前100个字节:\n', hexData);

          // 解析元数据
          // 注意：这里使用简化的解析方法，实际上应该使用@metaplex-foundation/mpl-token-metadata库
          try {
            // 跳过前面的字节（根据Metaplex元数据格式）
            let offset = 1 + 32 + 32 + 4; // 格式版本(1) + mint地址(32) + 更新权限(32) + 名称长度(4)

            // 读取名称长度
            const nameLength = metadataInfo.data.readUInt32LE(1 + 32 + 32);
            console.log('名称长度:', nameLength);

            // 尝试读取名称
            if (nameLength > 0 && nameLength < 100) {
              const name = metadataInfo.data.slice(1 + 32 + 32 + 4, 1 + 32 + 32 + 4 + nameLength).toString('utf8');
              console.log('代币名称:', name);
            }

            offset += nameLength;

            // 读取符号长度
            const symbolLength = metadataInfo.data.readUInt32LE(offset);
            console.log('符号长度:', symbolLength);

            // 尝试读取符号
            if (symbolLength > 0 && symbolLength < 100) {
              const symbol = metadataInfo.data.slice(offset + 4, offset + 4 + symbolLength).toString('utf8');
              console.log('代币符号:', symbol);
            }

            offset += 4 + symbolLength;

            // 读取URI长度
            const uriLength = metadataInfo.data.readUInt32LE(offset);
            console.log('URI长度:', uriLength);

            // 尝试读取URI
            if (uriLength > 0 && uriLength < 200) {
              const uri = metadataInfo.data.slice(offset + 4, offset + 4 + uriLength).toString('utf8');
              console.log('元数据URI:', uri);
            }

            offset += 4 + uriLength;

            // 读取创建者数量
            const hasCreators = metadataInfo.data[offset] === 1;
            console.log('是否有创建者:', hasCreators);
            offset += 1;

            if (hasCreators) {
              const creatorCount = metadataInfo.data.readUInt32LE(offset);
              offset += 4;

              console.log(`找到 ${creatorCount} 个创建者`);

              const creators = [];
              for (let i = 0; i < creatorCount; i++) {
                const creatorAddress = new PublicKey(metadataInfo.data.slice(offset, offset + 32));
                offset += 32;

                const verified = metadataInfo.data[offset] === 1;
                offset += 1;

                const share = metadataInfo.data[offset];
                offset += 1;

                creators.push({
                  address: creatorAddress.toString(),
                  verified,
                  share
                });

                console.log(`创建者 ${i+1}: 地址=${creatorAddress.toString()}, 已验证=${verified}, 份额=${share}%`);
              }

              if (creators.length > 0) {
                return creators.map(creator => ({
                  contractCreator: creator.address,
                  txHash: '',
                  verified: creator.verified,
                  share: creator.share,
                  source: 'metadata'
                }));
              }
            }
          } catch (parseError) {
            console.error('解析元数据时出错:', parseError);
          }
        }
      } catch (metadataError) {
        console.error('获取元数据时出错:', metadataError);
      }

      // 步骤3: 尝试获取代币的第一笔交易
      console.log('尝试获取代币的签名列表...');
      try {
        // 获取最近的签名列表，按时间倒序排列
        const signatures = await this.connection.getSignaturesForAddress(mintPubkey, { limit: 10 });

        if (signatures && signatures.length > 0) {
          console.log(`找到 ${signatures.length} 个签名`);

          // 详细输出所有签名信息
          console.log('===== 所有签名信息 =====');
          signatures.forEach((sig, index) => {
            console.log(`\n签名 ${index + 1}:`);
            console.log(`- 签名哈希: ${sig.signature}`);
            console.log(`- 区块时间: ${sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString() : '未知'}`);
            console.log(`- 确认状态: ${sig.confirmationStatus || '未知'}`);
            console.log(`- 错误信息: ${sig.err ? JSON.stringify(sig.err) : '无'}`);
            if (sig.memo) console.log(`- 备注: ${sig.memo}`);
            console.log(`- 区块高度: ${sig.slot || '未知'}`);
          });
          console.log('========================\n');

          // 按时间排序，找出最早的签名
          signatures.sort((a, b) => {
            const timeA = a.blockTime || 0;
            const timeB = b.blockTime || 0;
            return timeA - timeB; // 升序排列，最早的在前
          });

          const firstSignature = signatures[0]; // 最早的签名
          console.log('选择最早的签名:', firstSignature.signature);
          console.log('签名时间:', firstSignature.blockTime ? new Date(firstSignature.blockTime * 1000).toLocaleString() : '未知');
          console.log('签名状态:', firstSignature.confirmationStatus || '未知');
          console.log('签名错误:', firstSignature.err ? JSON.stringify(firstSignature.err) : '无');

          // 获取交易详情
          console.log('获取交易详情...');
          const transaction = await this.connection.getTransaction(firstSignature.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (transaction) {
            console.log('\n===== 交易详情 =====');
            console.log('交易区块时间:', transaction.blockTime ? new Date(transaction.blockTime * 1000).toLocaleString() : '未知');
            console.log('交易区块高度:', transaction.slot || '未知');

            if (transaction.meta) {
              console.log('交易费用:', transaction.meta.fee / 1000000000, 'SOL');
              console.log('交易状态:', transaction.meta.err ? '失败' : '成功');
              if (transaction.meta.err) {
                console.log('交易错误:', JSON.stringify(transaction.meta.err));
              }

              // 输出余额变化
              if (transaction.meta.preBalances && transaction.meta.postBalances) {
                console.log('\n余额变化:');
                for (let i = 0; i < Math.min(transaction.meta.preBalances.length, transaction.meta.postBalances.length); i++) {
                  const pre = transaction.meta.preBalances[i] / 1000000000;
                  const post = transaction.meta.postBalances[i] / 1000000000;
                  const diff = post - pre;
                  if (diff !== 0) {
                    console.log(`账户 ${i}: ${pre.toFixed(9)} SOL -> ${post.toFixed(9)} SOL (${diff > 0 ? '+' : ''}${diff.toFixed(9)} SOL)`);
                  }
                }
              }

              // 输出代币余额变化
              if (transaction.meta.preTokenBalances && transaction.meta.postTokenBalances) {
                console.log('\n代币余额变化:');
                const tokenChanges = {};

                // 处理交易前的代币余额
                transaction.meta.preTokenBalances.forEach(balance => {
                  const key = `${balance.mint}_${balance.owner}`;
                  if (!tokenChanges[key]) {
                    tokenChanges[key] = {
                      mint: balance.mint,
                      owner: balance.owner,
                      pre: parseFloat(balance.uiTokenAmount.uiAmount || 0),
                      post: 0,
                      decimals: balance.uiTokenAmount.decimals
                    };
                  } else {
                    tokenChanges[key].pre = parseFloat(balance.uiTokenAmount.uiAmount || 0);
                  }
                });

                // 处理交易后的代币余额
                transaction.meta.postTokenBalances.forEach(balance => {
                  const key = `${balance.mint}_${balance.owner}`;
                  if (!tokenChanges[key]) {
                    tokenChanges[key] = {
                      mint: balance.mint,
                      owner: balance.owner,
                      pre: 0,
                      post: parseFloat(balance.uiTokenAmount.uiAmount || 0),
                      decimals: balance.uiTokenAmount.decimals
                    };
                  } else {
                    tokenChanges[key].post = parseFloat(balance.uiTokenAmount.uiAmount || 0);
                  }
                });

                // 输出有变化的代币余额
                Object.values(tokenChanges).forEach(change => {
                  const diff = change.post - change.pre;
                  if (diff !== 0) {
                    console.log(`代币 ${change.mint.substring(0, 8)}...${change.mint.substring(change.mint.length - 4)}`);
                    console.log(`所有者 ${change.owner.substring(0, 8)}...${change.owner.substring(change.owner.length - 4)}`);
                    console.log(`余额变化: ${change.pre} -> ${change.post} (${diff > 0 ? '+' : ''}${diff})`);
                    console.log('---');
                  }
                });
              }
            }

            if (transaction.transaction && transaction.transaction.signatures) {
              console.log(`交易包含 ${transaction.transaction.signatures.length} 个签名`);

              // 打印所有签名者
              transaction.transaction.signatures.forEach((sig, index) => {
                console.log(`签名者 ${index + 1}:`, sig);
              });

              // 尝试从交易中获取签名者地址
              console.log('尝试从交易中获取签名者地址...');

              // 打印交易的关键信息
              if (transaction.blockTime) {
                console.log('交易区块时间:', new Date(transaction.blockTime * 1000).toLocaleString());
              }
              if (transaction.slot) {
                console.log('交易区块高度:', transaction.slot);
              }

              // 尝试获取交易的第一个签名者
              let creatorRaw = '';

              // 从transaction.meta.loadedAddresses获取
              if (transaction.meta && transaction.meta.loadedAddresses) {
                console.log('交易meta.loadedAddresses:', JSON.stringify(transaction.meta.loadedAddresses));
              }

              // 从transaction.transaction.message获取
              if (transaction.transaction && transaction.transaction.message) {
                // 尝试使用getAccountKeys方法（如果存在）
                if (typeof transaction.transaction.message.getAccountKeys === 'function') {
                  try {
                    const accountKeys = transaction.transaction.message.getAccountKeys();
                    if (accountKeys && accountKeys.length > 0) {
                      creatorRaw = accountKeys[0].toString();
                      console.log('从getAccountKeys获取创建者:', creatorRaw);
                    }
                  } catch (e) {
                    console.error('getAccountKeys方法调用失败:', e.message);
                  }
                }

                // 如果上面的方法失败，尝试直接从message中获取
                if (!creatorRaw && transaction.transaction.message.staticAccountKeys) {
                  if (transaction.transaction.message.staticAccountKeys.length > 0) {
                    creatorRaw = transaction.transaction.message.staticAccountKeys[0].toString();
                    console.log('从staticAccountKeys获取创建者:', creatorRaw);
                  }
                }
              }

              // 如果还是没有找到，尝试从meta中获取
              if (!creatorRaw && transaction.meta && transaction.meta.innerInstructions) {
                console.log('交易包含内部指令:', transaction.meta.innerInstructions.length);
              }

              if (creatorRaw) {
                console.log('找到可能的创建者地址:', creatorRaw);

                // 使用PublicKey处理创建者地址
                try {
                  const creatorPublicKey = new PublicKey(creatorRaw);
                  const creator = creatorPublicKey.toString();
                  console.log('处理后的创建者地址:', creator);

                  // 尝试获取创建者账户信息
                  try {
                    const creatorInfo = await this.connection.getAccountInfo(creatorPublicKey);
                    if (creatorInfo) {
                      console.log('创建者账户所有者:', creatorInfo.owner.toString());
                      console.log('创建者账户余额:', creatorInfo.lamports / 10**9, 'SOL');
                      console.log('创建者账户数据大小:', creatorInfo.data.length, '字节');
                    } else {
                      console.log('创建者账户不存在或已关闭');
                    }
                  } catch (accountError) {
                    console.error('获取创建者账户信息失败:', accountError.message);
                  }

                  // 如果有交易指令，尝试分析
                  if (transaction.transaction.message && transaction.transaction.message.instructions) {
                    const instructions = transaction.transaction.message.instructions;
                    console.log(`\n===== 交易指令 (${instructions.length}) =====`);

                    // 获取账户密钥列表
                    let accountKeys = [];
                    try {
                      if (typeof transaction.transaction.message.getAccountKeys === 'function') {
                        accountKeys = transaction.transaction.message.getAccountKeys();
                      } else if (transaction.transaction.message.staticAccountKeys) {
                        accountKeys = transaction.transaction.message.staticAccountKeys;
                      }
                    } catch (e) {
                      console.error('获取账户密钥失败:', e.message);
                    }

                    // 已知的程序ID和名称映射
                    const knownPrograms = {
                      '11111111111111111111111111111111': 'System Program',
                      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
                      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
                      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metadata Program',
                      'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'Memo Program'
                    };

                    // 尝试找出创建代币的指令
                    instructions.forEach((instruction, index) => {
                      console.log(`\n指令 ${index + 1}:`);

                      // 程序ID
                      const programId = instruction.programId?.toString() || '未知';
                      const programName = knownPrograms[programId] || '未知程序';
                      console.log(`- 程序: ${programName} (${programId})`);

                      // 账户
                      if (instruction.accounts && instruction.accounts.length > 0 && accountKeys.length > 0) {
                        console.log('- 涉及账户:');
                        instruction.accounts.forEach((accountIndex, i) => {
                          if (accountIndex < accountKeys.length) {
                            const account = accountKeys[accountIndex].toString();
                            console.log(`  ${i + 1}. ${account}`);
                          }
                        });
                      }

                      // 数据
                      if (instruction.data) {
                        console.log(`- 数据: ${instruction.data.substring(0, 50)}${instruction.data.length > 50 ? '...' : ''}`);
                      }
                    });

                    // 内部指令
                    if (transaction.meta && transaction.meta.innerInstructions && transaction.meta.innerInstructions.length > 0) {
                      console.log(`\n===== 内部指令 =====`);
                      transaction.meta.innerInstructions.forEach((innerInst, outerIndex) => {
                        console.log(`\n外部指令 ${innerInst.index + 1} 的内部指令:`);

                        innerInst.instructions.forEach((inst, innerIndex) => {
                          console.log(`\n内部指令 ${outerIndex + 1}.${innerIndex + 1}:`);

                          // 程序ID
                          if (inst.programIdIndex !== undefined && inst.programIdIndex < accountKeys.length) {
                            const programId = accountKeys[inst.programIdIndex].toString();
                            const programName = knownPrograms[programId] || '未知程序';
                            console.log(`- 程序: ${programName} (${programId})`);
                          }

                          // 账户
                          if (inst.accounts && inst.accounts.length > 0 && accountKeys.length > 0) {
                            console.log('- 涉及账户:');
                            inst.accounts.forEach((accountIndex, i) => {
                              if (accountIndex < accountKeys.length) {
                                const account = accountKeys[accountIndex].toString();
                                console.log(`  ${i + 1}. ${account}`);
                              }
                            });
                          }

                          // 数据
                          if (inst.data) {
                            console.log(`- 数据: ${inst.data.substring(0, 50)}${inst.data.length > 50 ? '...' : ''}`);
                          }
                        });
                      });
                    }
                  }

                  return [{
                    contractCreator: creator,
                    txHash: firstSignature.signature,
                    source: 'transaction'
                  }];
                } catch (publicKeyError) {
                  console.error('创建者地址无效:', publicKeyError.message);

                  // 如果PublicKey处理失败，仍然返回原始签名
                  console.log('返回原始签名作为创建者地址');
                  return [{
                    contractCreator: creatorRaw,
                    txHash: firstSignature.signature,
                    source: 'transaction'
                  }];
                }
              }
            } else {
              console.log('交易中没有找到签名');
            }
          } else {
            console.log('无法获取交易详情');
          }
        } else {
          console.log('未找到任何签名');
        }
      } catch (signatureError) {
        console.error('获取签名列表时出错:', signatureError);
        console.error('错误详情:', signatureError.message);
        if (signatureError.stack) {
          console.error('错误堆栈:', signatureError.stack);
        }
      }

      console.error('未找到合约创建者信息');
      throw new Error('未找到合约创建者信息');
    } catch (error) {
      console.error('原生Solana RPC API处理过程中出错:', error);
      throw error;
    }
  }

  // 添加获取当前 API 提供商的方法
  getCurrentApiProvider() {
    return currentApiProvider;
  }
}

module.exports = new SolanaService();
