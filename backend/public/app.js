(function() {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };

  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.debug = function() {};
  }

  window.enableConsoleLogging = function() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  };
})();

const elements = {
  tabs: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),

  burnTxHash: document.getElementById('burnTxHash'),
  checkBurnTx: document.getElementById('checkBurnTx'),
  burnLoading: document.getElementById('burnLoading'),
  burnRequirementText: document.getElementById('burnRequirementText'),
  verificationResultsContainer: document.getElementById('verificationResultsContainer'),
  burnInfo: document.getElementById('burnInfo'),

  txQuerySection: document.getElementById('txQuerySection'),
  address: document.getElementById('address'),
  searchTx: document.getElementById('searchTx'),
  txLoading: document.getElementById('txLoading'),
  txResults: document.getElementById('txResults'),
  txTableBody: document.getElementById('txTableBody'),

  txTypeBtns: document.querySelectorAll('.tx-type-btn'),

  tokenFilterBtns: document.querySelectorAll('.token-filter-btn'),
  tokenFilterDropdown: document.getElementById('tokenFilterDropdown'),
  customTokenInput: document.getElementById('customTokenInput'),
  applyCustomToken: document.getElementById('applyCustomToken'),

  contractHint: document.getElementById('contractHint'),
  gotoContractList: document.querySelector('.goto-contract-list'),

  txPagination: document.getElementById('txPagination'),
  pageStart: document.getElementById('pageStart'),
  pageEnd: document.getElementById('pageEnd'),
  totalRecords: document.getElementById('totalRecords'),
  currentPage: document.getElementById('currentPage'),
  totalPages: document.getElementById('totalPages'),
  firstPage: document.getElementById('firstPage'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  lastPage: document.getElementById('lastPage'),
  pageSizeSelector: document.getElementById('pageSizeSelector'),
  applyPageSize: document.getElementById('applyPageSize'),

  tokenListEmpty: document.getElementById('tokenListEmpty'),
  tokenListGrid: document.getElementById('tokenListGrid'),
  clearTokenList: document.getElementById('clearTokenList'),
  tokenSearchInput: document.getElementById('tokenSearchInput'),
  tokenSearchBtn: document.getElementById('tokenSearchBtn'),
  contractTypeBtns: document.querySelectorAll('.contract-type-btn'),

  contractAddress: document.getElementById('contractAddress'),
  searchContract: document.getElementById('searchContract'),
  contractLoading: document.getElementById('contractLoading'),
  contractResults: document.getElementById('contractResults'),
  contractInfo: document.getElementById('contractInfo'),

  // 合约查询部分
  contractQuerySection: document.getElementById('contractQuerySection'),
  contractBurnRequirementText: document.getElementById('contractBurnRequirementText')
};

const state = {
  verification: {
    verified: false,
    txHash: '',
    from: '',
    isUsed: false
  },

  transactions: {
    data: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 5000,
    totalPages: 0,
    totalRecords: 0,
    currentFilter: 'all',
    currentTokenFilter: 'all'
  },

  tokens: {
    list: [],
    filteredList: [],
    currentFilter: 'all',
    searchTerm: ''
  },

  currentAddress: '',

  config: null
};

async function initApp() {
  try {
    elements.burnLoading.style.display = 'none';
    elements.txLoading.style.display = 'none';
    elements.contractLoading.style.display = 'none';

    await loadConfig();
    await checkVerificationStatus();
    setupEventListeners();
    initTabs();
  } catch (error) {
    showError('应用初始化失败: ' + error.message);
  }
}

// 加载配置
async function loadConfig() {
  try {
    const config = await api.getConfig();
    state.config = config;

    // 更新销毁验证要求文本
    if (config.burnVerification && config.burnVerification.enabled) {
      const verificationType = config.burnVerification.type || 'sol';
      let targetAmount, targetContract, burnAddress;

      if (verificationType === 'sol') {
        targetAmount = config.burnVerification.sol.targetAmount;
        targetContract = config.burnVerification.sol.targetContractAddress;
        burnAddress = config.burnVerification.sol.burnAddress;
      } else if (verificationType === 'bsc') {
        targetAmount = config.burnVerification.bsc.targetAmount;
        targetContract = config.burnVerification.bsc.targetContractAddress;
        burnAddress = config.burnVerification.bsc.burnAddress;
      }

      elements.burnRequirementText.innerHTML = `
        验证要求 (${verificationType.toUpperCase()}): 向 <span class="address">${burnAddress}</span>
        销毁 <span class="amount">${targetAmount}</span> 个
        <span class="contract">${targetContract}</span> 代币
      `;
    } else {
      elements.burnRequirementText.textContent = '销毁验证功能未启用，可以直接查询';
      elements.burnTxHash.disabled = true;
      elements.checkBurnTx.disabled = true;
    }

    // 更新分页配置
    if (config.pagination) {
      state.transactions.currentPage = config.pagination.defaultPage || 1;
      state.transactions.pageSize = config.pagination.defaultPageSize || 5000;

      // 更新页面大小选择器
      if (elements.pageSizeSelector) {
        elements.pageSizeSelector.value = state.transactions.pageSize;
      }
    }

  } catch (error) {
    showError('加载配置失败: ' + error.message);
  }
}

// 检查验证状态
async function checkVerificationStatus() {
  try {
    const status = await api.getVerificationStatus();

    // 更新状态
    state.verification = {
      verified: status.verified,
      txHash: status.txHash,
      from: status.from,
      isUsed: status.isUsed
    };

    // 更新UI
    updateVerificationUI();

  } catch (error) {
    showError('检查验证状态失败: ' + error.message);
  }
}

// 更新验证UI
function updateVerificationUI() {
  if (state.verification.verified && !state.verification.isUsed) {
    // 验证通过且未使用
    elements.verificationResultsContainer.style.display = 'block';
    elements.burnInfo.innerHTML = `
      <div class="success-message">
        <p>✅ 验证成功! 您可以查询转账记录和合约信息了。</p>
        <p>交易哈希: <span class="hash">${state.verification.txHash}</span></p>
        <p>发送地址: <span class="address">${state.verification.from}</span></p>
      </div>
    `;

    // 启用查询部分
    elements.txQuerySection.classList.add('enabled');
    elements.address.disabled = false;
    elements.searchTx.disabled = false;

    // 启用合约查询部分
    if (elements.contractQuerySection) {
      elements.contractQuerySection.classList.add('enabled');
      elements.contractAddress.disabled = false;
      elements.searchContract.disabled = false;
    }

    // 更新合约查询部分的验证要求文本
    if (elements.contractBurnRequirementText) {
      elements.contractBurnRequirementText.innerHTML = `
        <span class="success-message">✅ 验证已通过，您可以查询合约信息</span>
      `;
    }
  } else if (state.verification.verified && state.verification.isUsed) {
    // 验证通过但已使用
    elements.verificationResultsContainer.style.display = 'block';
    elements.burnInfo.innerHTML = `
      <div class="warning-message">
        <p>⚠️ 该交易哈希已被使用，请提供新的交易哈希。</p>
        <p>交易哈希: <span class="hash">${state.verification.txHash}</span></p>
      </div>
    `;

    // 禁用查询部分
    elements.txQuerySection.classList.remove('enabled');
    elements.address.disabled = true;
    elements.searchTx.disabled = true;

    // 禁用合约查询部分
    if (elements.contractQuerySection) {
      elements.contractQuerySection.classList.remove('enabled');
      elements.contractAddress.disabled = true;
      elements.searchContract.disabled = true;
    }

    // 更新合约查询部分的验证要求文本
    if (elements.contractBurnRequirementText) {
      elements.contractBurnRequirementText.innerHTML = `
        <span class="warning-message">⚠️ 该交易哈希已被使用，请提供新的交易哈希</span>
      `;
    }
  } else {
    // 未验证
    elements.verificationResultsContainer.style.display = 'none';

    // 检查是否启用了销毁验证功能
    if (state.config && state.config.burnVerification && state.config.burnVerification.enabled) {
      // 禁用查询部分
      elements.txQuerySection.classList.remove('enabled');
      elements.address.disabled = true;
      elements.searchTx.disabled = true;

      // 禁用合约查询部分
      if (elements.contractQuerySection) {
        elements.contractQuerySection.classList.remove('enabled');
        elements.contractAddress.disabled = true;
        elements.searchContract.disabled = true;
      }

      // 更新合约查询部分的验证要求文本
      if (elements.contractBurnRequirementText) {
        const verificationType = state.config.burnVerification.type || 'sol';
        let targetAmount, targetContract, burnAddress;

        if (verificationType === 'sol') {
          targetAmount = state.config.burnVerification.sol.targetAmount;
          targetContract = state.config.burnVerification.sol.targetContractAddress;
          burnAddress = state.config.burnVerification.sol.burnAddress;
        } else if (verificationType === 'bsc') {
          targetAmount = state.config.burnVerification.bsc.targetAmount;
          targetContract = state.config.burnVerification.bsc.targetContractAddress;
          burnAddress = state.config.burnVerification.bsc.burnAddress;
        }

        elements.contractBurnRequirementText.innerHTML = `
          验证要求 (${verificationType.toUpperCase()}): 向 <span class="address">${burnAddress}</span>
          销毁 <span class="amount">${targetAmount}</span> 个
          <span class="contract">${targetContract}</span> 代币
        `;
      }
    } else {
      // 如果验证功能未启用，则启用查询部分
      elements.txQuerySection.classList.add('enabled');
      elements.address.disabled = false;
      elements.searchTx.disabled = false;

      // 启用合约查询部分
      if (elements.contractQuerySection) {
        elements.contractQuerySection.classList.add('enabled');
        elements.contractAddress.disabled = false;
        elements.searchContract.disabled = false;
      }

      // 更新合约查询部分的验证要求文本
      if (elements.contractBurnRequirementText) {
        elements.contractBurnRequirementText.textContent = '销毁验证功能未启用，可以直接查询';
      }
    }
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 标签页切换
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // 验证销毁
  elements.checkBurnTx.addEventListener('click', verifyBurn);

  // 查询交易
  elements.searchTx.addEventListener('click', searchTransactions);

  // 交易类型筛选
  elements.txTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      filterTransactionsByType(type);
    });
  });

  // 代币筛选
  elements.tokenFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const token = btn.getAttribute('data-token');
      filterTransactionsByToken(token);
    });
  });

  // 自定义代币筛选
  elements.applyCustomToken.addEventListener('click', () => {
    const token = elements.customTokenInput.value.trim();
    if (token) {
      filterTransactionsByToken(token);
    }
  });

  // 前往合约列表
  if (elements.gotoContractList) {
    elements.gotoContractList.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('token-list');
    });
  }

  // 分页控件
  elements.firstPage.addEventListener('click', () => goToPage(1));
  elements.prevPage.addEventListener('click', () => goToPage(state.transactions.currentPage - 1));
  elements.nextPage.addEventListener('click', () => goToPage(state.transactions.currentPage + 1));
  elements.lastPage.addEventListener('click', () => goToPage(state.transactions.totalPages));
  elements.applyPageSize.addEventListener('click', changePageSize);

  // 代币列表
  elements.clearTokenList.addEventListener('click', clearTokenList);
  elements.tokenSearchBtn.addEventListener('click', searchTokens);
  elements.tokenSearchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      searchTokens();
    }
  });

  // 合约类型筛选
  elements.contractTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      filterContractsByType(type);
    });
  });

  // 查询合约
  elements.searchContract.addEventListener('click', searchContract);
}

// 初始化标签页
function initTabs() {
  // 默认显示第一个标签页
  elements.tabs[0].classList.add('active');
  elements.tabContents[0].classList.add('active');
}

// 切换标签页
function switchTab(tabId) {
  // 移除所有标签页的活动状态
  elements.tabs.forEach(tab => tab.classList.remove('active'));
  elements.tabContents.forEach(content => content.classList.remove('active'));

  // 激活选中的标签页
  const selectedTab = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const selectedContent = document.getElementById(tabId);

  if (selectedTab && selectedContent) {
    selectedTab.classList.add('active');
    selectedContent.classList.add('active');
  }
}

// 验证销毁
async function verifyBurn() {
  const txHash = elements.burnTxHash.value.trim();

  if (!txHash) {
    showError('请输入交易哈希');
    return;
  }

  try {
    // 显示加载指示器
    elements.burnLoading.style.display = 'block';
    elements.checkBurnTx.disabled = true;

    // 获取验证类型
    const verificationType = state.config?.burnVerification?.type || 'sol';
    console.log(`使用验证类型: ${verificationType}`);

    // 发送验证请求
    const result = await api.verifyBurn(txHash);

    // 隐藏加载指示器
    elements.burnLoading.style.display = 'none';
    elements.checkBurnTx.disabled = false;

    // 检查验证结果
    if (result.success) {
      const burnResult = result.result;

      if (burnResult.isValidBurn) {
        // 验证成功
        showSuccess(`验证成功！您可以查询转账记录了。(${verificationType.toUpperCase()})`);

        // 更新验证状态
        await checkVerificationStatus();
      } else if (burnResult.found) {
        // 找到销毁事件但验证失败
        let errorMessage = '验证失败: ';

        if (!burnResult.isTargetContract) {
          errorMessage += '不是目标合约';
        } else if (!burnResult.isTargetAmount) {
          errorMessage += '销毁数量不符合要求';
        } else {
          errorMessage += '未知原因';
        }

        showError(errorMessage);

        // 显示详细信息
        elements.verificationResultsContainer.style.display = 'block';
        elements.burnInfo.innerHTML = `
          <div class="error-message">
            <p>❌ ${errorMessage} (${verificationType.toUpperCase()})</p>
            <p>交易哈希: <span class="hash">${txHash}</span></p>
            <p>发送地址: <span class="address">${burnResult.from}</span></p>
            <p>代币地址: <span class="address">${burnResult.token?.address || 'Unknown'}</span></p>
            <p>销毁数量: <span class="amount">${burnResult.amount} ${burnResult.symbol}</span></p>
            <p>目标合约: <span class="status">${burnResult.isTargetContract ? '✓' : '✗'}</span></p>
            <p>目标数量: <span class="status">${burnResult.isTargetAmount ? '✓' : '✗'}</span></p>
          </div>
        `;
      } else {
        // 未找到销毁事件
        showError(`未找到销毁事件，请确认${verificationType.toUpperCase()}交易哈希是否正确`);

        // 隐藏详细信息
        elements.verificationResultsContainer.style.display = 'none';
      }
    } else {
      // API 请求失败
      showError('验证失败: ' + (result.message || '未知错误'));

      // 隐藏详细信息
      elements.verificationResultsContainer.style.display = 'none';
    }
  } catch (error) {
    // 隐藏加载指示器
    elements.burnLoading.style.display = 'none';
    elements.checkBurnTx.disabled = false;

    console.error('验证销毁失败:', error);
    showError('验证销毁失败: ' + error.message);

    // 隐藏详细信息
    elements.verificationResultsContainer.style.display = 'none';
  }
}

// 查询交易记录
async function searchTransactions() {
  const address = elements.address.value.trim();

  if (!address) {
    showError('请输入钱包地址');
    return;
  }

  try {
    // 显示加载指示器
    elements.txLoading.style.display = 'block';
    elements.searchTx.disabled = true;

    // 保存当前查询的地址
    state.currentAddress = address;

    // 重置分页到配置的默认页码
    state.transactions.currentPage = state.config && state.config.pagination ?
      state.config.pagination.defaultPage : 1;

    // 使用配置的页面大小
    const pageSize = state.config && state.config.pagination ?
      state.config.pagination.defaultPageSize : 5000;

    // 发送查询请求
    const result = await api.getTransactions(address, state.transactions.currentPage, pageSize);

    // 同时查询代币转账记录
    const tokenResult = await api.getTokenTransfers(address, state.transactions.currentPage, pageSize);

    // 隐藏加载指示器
    elements.txLoading.style.display = 'none';
    elements.searchTx.disabled = false;

    // 检查查询结果
    if (result.success && tokenResult.success) {
      // 合并交易记录和代币转账记录
      const transactions = result.result || [];
      const tokenTransfers = tokenResult.result || [];

      // 打印交易记录示例，用于调试
      if (transactions.length > 0) {
        console.log('交易记录示例:', JSON.stringify(transactions[0], null, 2));

        // 检查交易记录中是否包含lamports字段
        const hasLamports = transactions.some(tx => tx.lamports !== undefined);
        const hasFee = transactions.some(tx => tx.fee !== undefined);
        const hasValue = transactions.some(tx => tx.value !== undefined);

        console.log(`交易记录字段检查: lamports=${hasLamports}, fee=${hasFee}, value=${hasValue}`);

        // 如果有lamports字段，打印示例
        if (hasLamports) {
          const txWithLamports = transactions.find(tx => tx.lamports !== undefined);
          console.log('包含lamports的交易:', txWithLamports);
        }

        // 如果有fee字段，打印示例
        if (hasFee) {
          const txWithFee = transactions.find(tx => tx.fee !== undefined);
          console.log('包含fee的交易:', txWithFee);
        }

        // 如果有value字段，打印示例
        if (hasValue) {
          const txWithValue = transactions.find(tx => tx.value !== undefined);
          console.log('包含value的交易:', txWithValue);
        }
      }
      if (tokenTransfers.length > 0) {
        console.log('代币转账记录示例:', JSON.stringify(tokenTransfers[0], null, 2));
      }

      // 更新状态
      state.transactions.data = [...transactions, ...tokenTransfers];
      state.transactions.totalRecords = state.transactions.data.length;
      state.transactions.totalPages = Math.ceil(state.transactions.totalRecords / state.transactions.pageSize);

      // 应用当前筛选器
      applyFilters();

      // 显示结果
      updateTransactionsUI();

      // 提取代币列表
      extractTokenList(tokenTransfers);

      console.log('查询完成，共获取到 ' + transactions.length + ' 条交易记录和 ' + tokenTransfers.length + ' 条代币转账记录');
    } else {
      // API 请求失败
      showError('查询失败: ' + (result.message || tokenResult.message || '未知错误'));

      // 清空结果
      elements.txTableBody.innerHTML = '<tr><td colspan="7" class="no-data">查询失败</td></tr>';
    }
  } catch (error) {
    // 隐藏加载指示器
    elements.txLoading.style.display = 'none';
    elements.searchTx.disabled = false;

    console.error('查询交易记录失败:', error);
    showError('查询交易记录失败: ' + error.message);

    // 清空结果
    elements.txTableBody.innerHTML = '<tr><td colspan="7" class="no-data">查询失败</td></tr>';
  }
}

// 提取代币列表
function extractTokenList(tokenTransfers) {
  // 创建一个Map来存储唯一的代币
  const tokensMap = new Map();

  // 从代币转账记录中提取代币信息
  tokenTransfers.forEach(transfer => {
    if (transfer.mint && transfer.tokenSymbol) {
      const tokenKey = transfer.mint.toLowerCase();

      if (!tokensMap.has(tokenKey)) {
        tokensMap.set(tokenKey, {
          address: transfer.mint,
          symbol: transfer.tokenSymbol,
          name: transfer.tokenName || transfer.tokenSymbol,
          decimals: transfer.tokenDecimal || 9,
          transactions: 1,
          relatedTxs: [{
            signature: transfer.signature,
            blockTime: transfer.blockTime,
            from: transfer.from,
            to: transfer.to,
            amount: transfer.amount
          }]
        });
      } else {
        // 增加交易计数
        const token = tokensMap.get(tokenKey);
        token.transactions++;
        // 添加相关交易
        token.relatedTxs.push({
          signature: transfer.signature,
          blockTime: transfer.blockTime,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount
        });
        tokensMap.set(tokenKey, token);
      }
    }
  });

  // 将Map转换为数组
  const newTokens = Array.from(tokensMap.values());

  // 合并到现有代币列表，避免重复
  newTokens.forEach(newToken => {
    const existingTokenIndex = state.tokens.list.findIndex(
      token => token.address.toLowerCase() === newToken.address.toLowerCase()
    );

    if (existingTokenIndex === -1) {
      // 添加新代币
      state.tokens.list.push(newToken);
    } else {
      // 更新现有代币的交易计数
      state.tokens.list[existingTokenIndex].transactions += newToken.transactions;
    }
  });

  // 更新代币筛选下拉菜单
  updateTokenFilterDropdown();

  // 更新代币列表UI
  updateTokenListUI();

  // 如果发现代币，显示合约提示
  if (newTokens.length > 0) {
    elements.contractHint.style.display = 'block';
  }
}

// 更新代币筛选下拉菜单
function updateTokenFilterDropdown() {
  // 按交易数量排序
  const sortedTokens = [...state.tokens.list].sort((a, b) => b.transactions - a.transactions);

  // 限制显示前10个代币
  const topTokens = sortedTokens.slice(0, 10);

  // 生成下拉菜单HTML
  let html = '';
  topTokens.forEach(token => {
    html += `<button class="token-filter-item" data-token="${token.symbol}">${token.symbol}</button>`;
  });

  // 更新下拉菜单
  elements.tokenFilterDropdown.innerHTML = html;

  // 添加事件监听器
  document.querySelectorAll('.token-filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const token = item.getAttribute('data-token');
      filterTransactionsByToken(token);
    });
  });
}

// 应用筛选器
function applyFilters() {
  // 获取当前筛选条件
  const typeFilter = state.transactions.currentFilter;
  const tokenFilter = state.transactions.currentTokenFilter;

  // 应用类型筛选
  let filtered = state.transactions.data;

  if (typeFilter === 'in') {
    filtered = filtered.filter(tx => tx.to && tx.to.toLowerCase() === state.currentAddress.toLowerCase());
  } else if (typeFilter === 'out') {
    filtered = filtered.filter(tx => tx.from && tx.from.toLowerCase() === state.currentAddress.toLowerCase());
  }

  // 应用代币筛选
  if (tokenFilter !== 'all') {
    filtered = filtered.filter(tx => {
      // 对于普通交易，检查是否是SOL
      if (!tx.tokenSymbol && tokenFilter === 'SOL') {
        return true;
      }

      // 对于代币交易，检查代币符号
      return tx.tokenSymbol && tx.tokenSymbol.toUpperCase() === tokenFilter.toUpperCase();
    });
  }

  // 更新筛选后的数据
  state.transactions.filteredData = filtered;
  state.transactions.totalRecords = filtered.length;
  state.transactions.totalPages = Math.ceil(filtered.length / state.transactions.pageSize);

  // 确保当前页码有效
  const minPage = state.config?.pagination?.defaultPage || 1;
  if (state.transactions.currentPage > state.transactions.totalPages) {
    state.transactions.currentPage = Math.max(minPage, state.transactions.totalPages);
  }
}

// 按类型筛选交易
function filterTransactionsByType(type) {
  // 更新活动按钮
  elements.txTypeBtns.forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 更新状态
  state.transactions.currentFilter = type;
  state.transactions.currentPage = state.config?.pagination?.defaultPage || 1;

  // 应用筛选器
  applyFilters();

  // 更新UI
  updateTransactionsUI();
}

// 按代币筛选交易
function filterTransactionsByToken(token) {
  // 更新活动按钮
  elements.tokenFilterBtns.forEach(btn => {
    if (btn.getAttribute('data-token') === token) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 如果是自定义代币，清除其他按钮的活动状态
  if (!Array.from(elements.tokenFilterBtns).some(btn => btn.getAttribute('data-token') === token)) {
    elements.tokenFilterBtns.forEach(btn => btn.classList.remove('active'));
  }

  // 更新状态
  state.transactions.currentTokenFilter = token;
  state.transactions.currentPage = state.config?.pagination?.defaultPage || 1;

  // 应用筛选器
  applyFilters();

  // 更新UI
  updateTransactionsUI();
}

// 更新交易记录UI
function updateTransactionsUI() {
  // 计算当前页的数据（页码从1开始）
  const startIndex = (state.transactions.currentPage - 1) * state.transactions.pageSize;
  const endIndex = Math.min(startIndex + state.transactions.pageSize, state.transactions.filteredData.length);
  const pageData = state.transactions.filteredData.slice(startIndex, endIndex);

  console.log(`显示第 ${startIndex + 1} 到 ${endIndex} 条记录，共 ${state.transactions.filteredData.length} 条记录，当前页: ${state.transactions.currentPage}，每页: ${state.transactions.pageSize}`);

  // 更新表格
  if (pageData.length === 0) {
    elements.txTableBody.innerHTML = '<tr><td colspan="7" class="no-data">没有找到交易记录</td></tr>';
  } else {
    let html = '';

    pageData.forEach(tx => {
      // 确定交易类型
      let type = '';
      let typeClass = '';

      if (tx.to && tx.to.toLowerCase() === state.currentAddress.toLowerCase()) {
        type = '转入';
        typeClass = 'tx-in';
      } else if (tx.from && tx.from.toLowerCase() === state.currentAddress.toLowerCase()) {
        type = '转出';
        typeClass = 'tx-out';
      } else {
        type = '其他';
        typeClass = 'tx-other';
      }

      // 格式化金额
      let amount = '';
      let symbol = '';

      // 打印当前交易的所有字段，用于调试
      console.log(`处理交易: ${tx.signature || tx.hash}, 字段:`, Object.keys(tx));

      if (tx.tokenSymbol) {
        // 代币交易
        amount = tx.amount || tx.value || '0';
        symbol = tx.tokenSymbol;

        // 打印代币信息
        console.log(`代币交易: tokenName=${tx.tokenName}, tokenSymbol=${tx.tokenSymbol}, amount=${amount}`);

        // 如果代币符号是地址的前8位，尝试使用代币名称的首字母作为符号
        if (tx.tokenSymbol && tx.tokenSymbol.length === 8 && tx.tokenName && tx.tokenName !== 'Unknown Token') {
          // 检查代币符号是否看起来像地址的前8位（全是字母数字）
          const isAddressPrefix = /^[a-zA-Z0-9]{8}$/.test(tx.tokenSymbol);
          if (isAddressPrefix) {
            // 尝试从代币名称生成更友好的符号
            const nameParts = tx.tokenName.split(/\s+/);
            if (nameParts.length > 0) {
              // 使用名称的首字母作为符号
              const newSymbol = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
              if (newSymbol.length > 0) {
                console.log(`将代币符号从 ${tx.tokenSymbol} 更改为 ${newSymbol}`);
                symbol = newSymbol;
              }
            }
          }
        }
      } else {
        // SOL交易
        try {
          // 尝试从不同字段获取SOL数量
          let solAmount = null;

          // 检查可能包含SOL数量的字段
          if (tx.lamports !== undefined) {
            console.log(`使用lamports字段: ${tx.lamports}`);
            solAmount = tx.lamports;
          } else if (tx.value !== undefined) {
            console.log(`使用value字段: ${tx.value}`);
            solAmount = tx.value;
          } else if (tx.amount !== undefined) {
            console.log(`使用amount字段: ${tx.amount}`);
            solAmount = tx.amount;
          } else if (tx.fee !== undefined) {
            console.log(`使用fee字段: ${tx.fee}`);
            solAmount = tx.fee;
          }

          console.log(`SOL数量原始值: ${solAmount}, 类型: ${typeof solAmount}`);

          if (solAmount !== null) {
            // 确保solAmount是数字
            const valueNum = typeof solAmount === 'string' ? parseFloat(solAmount) : solAmount;
            console.log(`SOL数量转换后: ${valueNum}, 类型: ${typeof valueNum}`);

            // 转换为SOL单位（1 SOL = 10^9 lamports）
            const solValue = valueNum / 1e9;
            console.log(`SOL数量(lamports转SOL): ${solValue}`);

            // 格式化SOL数量
            amount = solValue.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 9
            });
            console.log(`SOL数量格式化后: ${amount}`);
          } else {
            console.log('未找到SOL数量字段');
            amount = '0';
          }
        } catch (error) {
          console.error('格式化SOL数量失败:', error);
          amount = '0';
        }
        symbol = 'SOL';
      }

      // 格式化时间
      const time = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : '';

      // 生成表格行
      html += `
        <tr>
          <td><a href="https://solscan.io/tx/${tx.signature || tx.hash}" target="_blank" class="hash-link">${truncateMiddle(tx.signature || tx.hash, 10)}</a></td>
          <td>${tx.slot || ''}</td>
          <td>${time}</td>
          <td><a href="https://solscan.io/account/${tx.from}" target="_blank" class="address-link">${truncateMiddle(tx.from, 8)}</a></td>
          <td><a href="https://solscan.io/account/${tx.to}" target="_blank" class="address-link">${truncateMiddle(tx.to, 8)}</a></td>
          <td>${amount} ${symbol}</td>
          <td class="${typeClass}">${type}</td>
        </tr>
      `;
    });

    elements.txTableBody.innerHTML = html;
  }

  // 更新分页信息
  elements.pageStart.textContent = state.transactions.filteredData.length > 0 ? startIndex + 1 : 0;
  elements.pageEnd.textContent = endIndex;
  elements.totalRecords.textContent = state.transactions.filteredData.length;
  elements.currentPage.textContent = state.transactions.currentPage;
  elements.totalPages.textContent = state.transactions.totalPages;

  // 更新分页按钮状态
  const isFirstPage = state.transactions.currentPage === (state.config?.pagination?.defaultPage || 1);
  const isLastPage = state.transactions.currentPage === state.transactions.totalPages || state.transactions.totalPages === 0;

  elements.firstPage.disabled = isFirstPage;
  elements.prevPage.disabled = isFirstPage;
  elements.nextPage.disabled = isLastPage;
  elements.lastPage.disabled = isLastPage;
}

// 跳转到指定页
function goToPage(page) {
  // 确保页码有效
  const minPage = state.config?.pagination?.defaultPage || 1;
  if (page < minPage || page > state.transactions.totalPages) {
    return;
  }

  // 更新当前页码
  state.transactions.currentPage = page;

  // 更新UI
  updateTransactionsUI();

  // 滚动到表格顶部
  elements.txResults.scrollIntoView({ behavior: 'smooth' });
}

// 更改每页显示数量
function changePageSize() {
  const newSize = parseInt(elements.pageSizeSelector.value);
  const maxPageSize = state.config?.pagination?.maxPageSize || 10000;

  // 确保页面大小不超过最大值
  const validSize = Math.min(newSize, maxPageSize);

  if (validSize !== state.transactions.pageSize) {
    // 更新每页显示数量
    state.transactions.pageSize = validSize;

    // 重新计算总页数
    state.transactions.totalPages = Math.ceil(state.transactions.filteredData.length / validSize);

    // 确保当前页码有效
    const minPage = state.config?.pagination?.defaultPage || 1;
    if (state.transactions.currentPage > state.transactions.totalPages) {
      state.transactions.currentPage = Math.max(minPage, state.transactions.totalPages);
    }

    // 更新UI
    updateTransactionsUI();

    console.log(`页面大小已更改为 ${validSize}，总页数: ${state.transactions.totalPages}，当前页: ${state.transactions.currentPage}`);
  }
}

// 更新代币列表UI
function updateTokenListUI() {
  if (state.tokens.list.length === 0) {
    // 显示空列表提示
    elements.tokenListEmpty.style.display = 'block';
    elements.tokenListGrid.style.display = 'none';
    return;
  }

  // 隐藏空列表提示
  elements.tokenListEmpty.style.display = 'none';
  elements.tokenListGrid.style.display = 'grid';

  // 应用筛选器
  filterTokenList();
}

// 筛选代币列表
function filterTokenList() {
  // 获取当前筛选条件
  const filter = state.tokens.currentFilter;
  const searchTerm = state.tokens.searchTerm.toLowerCase();

  // 应用筛选
  let filtered = state.tokens.list;

  // 根据筛选条件过滤
  if (filter === 'filtered') {
    // 筛选交易相关合约
    filtered = filtered.filter(token => token.transactions > 0);
  }

  // 应用搜索
  if (searchTerm) {
    filtered = filtered.filter(token =>
      token.symbol.toLowerCase().includes(searchTerm) ||
      token.name.toLowerCase().includes(searchTerm) ||
      token.address.toLowerCase().includes(searchTerm)
    );
  }

  // 更新状态
  state.tokens.filteredList = filtered;

  // 更新UI
  renderTokenList();
}

// 渲染代币列表（不过滤Unknown Token，用于初始渲染和获取元数据）
function renderTokenList() {
  // 按交易数量排序
  const sortedTokens = [...state.tokens.filteredList].sort((a, b) => b.transactions - a.transactions);

  // 生成HTML
  let html = '';

  sortedTokens.forEach(token => {
    html += `
      <div class="token-card">
        <div class="token-icon-container token-list-icon" id="token-icon-${token.address.replace(/[^a-zA-Z0-9]/g, '')}">
          <div class="token-symbol-placeholder">${token.symbol.charAt(0)}</div>
        </div>
        <div class="token-header">
          <span class="token-symbol">${token.symbol}</span>
          <span class="token-tx-count">${token.transactions} 笔交易</span>
        </div>
        <div class="token-name">${token.name}</div>
        <div class="token-address">
          <a href="https://solscan.io/token/${token.address}" target="_blank" title="${token.address}">
            ${token.address}
          </a>
        </div>
        ${token.relatedTxs && token.relatedTxs.length > 0 && state.tokens.currentFilter === 'filtered' ? `
        <div class="token-transactions">
          <div class="token-tx-header">相关交易:</div>
          <div class="token-tx-list">
            ${token.relatedTxs.slice(0, 3).map(tx => `
              <div class="token-tx-item">
                <div class="token-tx-hash">
                  <a href="https://solscan.io/tx/${tx.signature}" target="_blank" title="${tx.signature}">
                    ${tx.signature ? truncateMiddle(tx.signature, 10) : '无交易哈希'}
                  </a>
                </div>
                <div class="token-tx-details">
                  <span class="token-tx-time">${tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : '无时间'}</span>
                  <span class="token-tx-amount">${tx.amount ? (tx.amount / Math.pow(10, token.decimals)).toFixed(6) : '0'} ${token.symbol}</span>
                </div>
              </div>
            `).join('')}
            ${token.relatedTxs.length > 3 ? `<div class="token-tx-more">还有 ${token.relatedTxs.length - 3} 笔交易...</div>` : ''}
          </div>
        </div>
        ` : ''}
        <div class="token-actions">
          <button class="token-action-btn" data-address="${token.address}" data-action="search">查询合约详情</button>
          <button class="token-action-btn" data-address="${token.address}" data-action="copy">复制合约地址</button>
        </div>
      </div>
    `;
  });

  // 更新DOM
  elements.tokenListGrid.innerHTML = html;

  // 重置元数据获取计数器
  resetMetadataFetchCounter(sortedTokens);

  // 在DOM更新后，再获取元数据和图标
  // 这样可以避免在渲染过程中触发无限循环
  sortedTokens.forEach((token, index) => {
    setTimeout(() => {
      fetchTokenMetadataForList(token.address);
    }, 100 * (index + 1)); // 错开时间，避免同时发起太多请求
  });

  // 添加事件监听器
  document.querySelectorAll('.token-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const address = btn.getAttribute('data-address');
      const action = btn.getAttribute('data-action');

      if (action === 'search') {
        // 跳转到合约信息标签页并查询
        switchTab('contracts');
        elements.contractAddress.value = address;
        searchContract();
      } else if (action === 'copy') {
        // 复制合约地址到剪贴板
        navigator.clipboard.writeText(address)
          .then(() => {
            showSuccess('合约地址已成功复制到剪贴板');
          })
          .catch(err => {
            console.error('复制失败:', err);
            showError('复制合约地址失败');
          });
      }
    });
  });
}

// 清空代币列表
function clearTokenList() {
  // 清空列表
  state.tokens.list = [];
  state.tokens.filteredList = [];

  // 更新UI
  updateTokenListUI();
}

// 搜索代币
function searchTokens() {
  // 获取搜索词
  const searchTerm = elements.tokenSearchInput.value.trim();

  // 更新状态
  state.tokens.searchTerm = searchTerm;

  // 应用筛选
  filterTokenList();
}

// 按类型筛选合约
function filterContractsByType(type) {
  // 更新活动按钮
  elements.contractTypeBtns.forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 更新状态
  state.tokens.currentFilter = type;

  // 应用筛选
  filterTokenList();
}

// 查询合约信息
async function searchContract() {
  const address = elements.contractAddress.value.trim();

  if (!address) {
    showError('请输入合约地址');
    return;
  }

  // 检查是否启用了销毁验证功能
  if (state.config && state.config.burnVerification && state.config.burnVerification.enabled) {
    // 检查是否已验证销毁
    if (!state.verification.verified || state.verification.isUsed) {
      showError('请先验证代币销毁交易');
      return;
    }
  }

  try {
    // 显示加载指示器
    elements.contractLoading.style.display = 'block';
    elements.searchContract.disabled = true;

    // 发送查询请求
    const result = await api.getContractInfo(address);

    // 隐藏加载指示器
    elements.contractLoading.style.display = 'none';
    elements.searchContract.disabled = false;

    // 检查查询结果
    if (result.success) {
      // 显示合约信息
      const contractInfo = result.result;

      // 生成HTML
      let html = `
        <div class="contract-details">
          <div class="info-group">
            <div class="info-item">
              <span class="info-label">合约地址:</span>
              <span class="info-value"><a href="https://solscan.io/token/${address}" target="_blank">${address}</a></span>
            </div>
      `;

      // 打印合约信息，用于调试
      console.log('合约信息:', contractInfo);

      // 添加代币信息
      // 处理不同API提供商返回的合约信息格式
      let tokenInfo = null;
      let tokenMetadata = null;

      // 检查是否有result字段（API响应的标准格式）
      if (contractInfo.result) {
        console.log('检测到result字段，使用result中的数据');

        // 检查result中是否有contractInfo
        if (contractInfo.result.contractInfo) {
          console.log('使用result.contractInfo中的数据');
          tokenInfo = contractInfo.result.contractInfo;
        }

        // 检查result中是否有metadata
        if (contractInfo.result.metadata) {
          console.log('使用result.metadata中的数据');
          tokenMetadata = contractInfo.result.metadata;
        }
      }
      // 如果没有result字段，使用旧的逻辑
      else if (contractInfo.contractInfo) {
        // QuickNode或原生Solana RPC API返回的格式
        console.log('使用contractInfo中的数据');

        // 检查contractInfo是否是API响应对象
        if (contractInfo.contractInfo.success && contractInfo.contractInfo.result) {
          console.log('contractInfo是API响应对象，使用result中的数据');

          // 使用result中的contractInfo
          if (contractInfo.contractInfo.result.contractInfo) {
            tokenInfo = contractInfo.contractInfo.result.contractInfo;
            console.log('从API响应中提取contractInfo:', tokenInfo);
          }

          // 使用result中的metadata
          if (contractInfo.contractInfo.result.metadata) {
            tokenMetadata = contractInfo.contractInfo.result.metadata;
            console.log('从API响应中提取metadata:', tokenMetadata);
          }
        } else {
          // 直接使用contractInfo
          tokenInfo = contractInfo.contractInfo;
        }

        // 检查是否有元数据
        if (contractInfo.metadata) {
          tokenMetadata = contractInfo.metadata;
        }
      } else if (typeof contractInfo === 'object' && contractInfo.name !== undefined) {
        // SolScan API返回的格式
        console.log('使用contractInfo对象本身的数据');
        tokenInfo = contractInfo;
        // 检查是否有元数据
        if (contractInfo.metadata) {
          tokenMetadata = contractInfo.metadata;
        }
      }

      // 打印提取的tokenInfo和tokenMetadata
      console.log('提取后的tokenInfo:', tokenInfo);
      console.log('提取后的tokenMetadata:', tokenMetadata);

      // 添加代币图标（如果有）
      if (tokenMetadata && tokenMetadata.uri) {
        // 添加代币图标标题
        html += `
          <div class="info-item">
            <span class="info-label">代币图标:</span>
          </div>
        `;

        // 添加加载中的图标容器
        html += `
          <div class="token-icon-container" id="token-icon-container">
            <div class="loading-spinner"></div>
          </div>
        `;

        // 使用JavaScript异步加载代币图标
        setTimeout(() => {
          fetchTokenMetadata(tokenMetadata.uri);
        }, 100);
      }

      // 打印代币信息和元数据
      console.log('代币信息:', tokenInfo);
      console.log('代币元数据:', tokenMetadata);

      // 打印完整的contractInfo对象，用于调试
      console.log('完整的contractInfo对象:', contractInfo);

      // 打印contractInfo的类型和结构
      console.log('contractInfo类型:', typeof contractInfo);
      if (contractInfo) {
        console.log('contractInfo的键:', Object.keys(contractInfo));

        if (contractInfo.result) {
          console.log('contractInfo.result的键:', Object.keys(contractInfo.result));

          if (contractInfo.result.contractInfo) {
            console.log('contractInfo.result.contractInfo:', contractInfo.result.contractInfo);
          }

          if (contractInfo.result.metadata) {
            console.log('contractInfo.result.metadata:', contractInfo.result.metadata);
          }
        }
      }

      // 优先使用元数据中的名称和符号
      let name = 'Unknown Token';
      let symbol = address.substring(0, 8);

      console.log('初始名称和符号:', name, symbol);

      // 优先使用元数据中的名称和符号
      if (tokenMetadata && tokenMetadata.name) {
        name = tokenMetadata.name;
        symbol = tokenMetadata.symbol || symbol;
        console.log(`使用元数据中的名称和符号: name=${name}, symbol=${symbol}`);
      }
      // 如果没有元数据，使用嵌套的contractInfo中的名称和符号
      else if (contractInfo && contractInfo.contractInfo && contractInfo.contractInfo.success && contractInfo.contractInfo.result) {
        console.log('检查contractInfo.contractInfo.result中的数据');

        // 检查result中的contractInfo
        if (contractInfo.contractInfo.result.contractInfo) {
          const nestedInfo = contractInfo.contractInfo.result.contractInfo;
          console.log('嵌套的contractInfo:', nestedInfo);

          if (nestedInfo.name && nestedInfo.name !== 'Unknown Token') {
            name = nestedInfo.name;
            symbol = nestedInfo.symbol || symbol;
            console.log(`使用嵌套的contractInfo中的名称和符号: name=${name}, symbol=${symbol}`);
          }
        }
      }
      // 如果没有嵌套的contractInfo，使用tokenInfo中的名称和符号
      else if (tokenInfo && tokenInfo.name && tokenInfo.name !== 'Unknown Token') {
        name = tokenInfo.name;
        symbol = tokenInfo.symbol || symbol;
        console.log(`使用tokenInfo中的名称和符号: name=${name}, symbol=${symbol}`);
      }

      // 打印元数据和代币信息的详细内容
      console.log('元数据详细内容:', tokenMetadata);
      console.log('代币信息详细内容:', tokenInfo);

      // 检查完整的contractInfo对象中是否有更详细的信息
      if (contractInfo && contractInfo.result && contractInfo.result.contractInfo) {
        const detailedInfo = contractInfo.result.contractInfo;
        console.log('详细合约信息:', detailedInfo);

        if (detailedInfo.name && detailedInfo.name !== 'Unknown Token') {
          name = detailedInfo.name;
          symbol = detailedInfo.symbol || symbol;
          console.log(`使用详细合约信息中的名称和符号: name=${name}, symbol=${symbol}`);
        }
      }

      // 检查完整的contractInfo对象中是否有元数据
      if (contractInfo && contractInfo.result && contractInfo.result.metadata) {
        const metadataFromResult = contractInfo.result.metadata;
        console.log('结果中的元数据:', metadataFromResult);

        // 只使用元数据中的URI，不使用名称和符号
        console.log(`只使用元数据中的URI: ${metadataFromResult.uri}`);
      }

      // 最后的名称和符号
      console.log('最终使用的名称和符号:', name, symbol);

      // 显示代币名称
      html += `
        <div class="info-item">
          <span class="info-label">代币名称:</span>
          <span class="info-value">${name}</span>
        </div>
      `;

      // 显示代币符号
      html += `
        <div class="info-item">
          <span class="info-label">代币符号:</span>
          <span class="info-value">${symbol}</span>
        </div>
      `;

      // 显示元数据URI（如果有）
      if (tokenMetadata && tokenMetadata.uri) {
        html += `
          <div class="info-item">
            <span class="info-label">元数据URI:</span>
            <span class="info-value"><a href="${tokenMetadata.uri}" target="_blank">${tokenMetadata.uri}</a></span>
          </div>
        `;
      }

      // 显示小数位数
      if (tokenInfo && tokenInfo.decimals !== undefined) {
        html += `
          <div class="info-item">
            <span class="info-label">小数位数:</span>
            <span class="info-value">${tokenInfo.decimals}</span>
          </div>
        `;
      }

      // 显示铸币权限
      if (tokenInfo && tokenInfo.mintAuthority) {
        html += `
          <div class="info-item">
            <span class="info-label">铸币权限:</span>
            <span class="info-value"><a href="https://solscan.io/account/${tokenInfo.mintAuthority}" target="_blank">${truncateMiddle(tokenInfo.mintAuthority, 12)}</a></span>
          </div>
        `;
      }
      // 不显示"未找到有效的代币信息"

      // 添加余额信息
      if (contractInfo.balance) {
        html += `
          <div class="info-item">
            <span class="info-label">SOL余额:</span>
            <span class="info-value">${contractInfo.balance} SOL</span>
          </div>
        `;
      }

      // 添加总供应量信息
      if (contractInfo.totalSupply) {
        html += `
          <div class="info-item">
            <span class="info-label">总供应量:</span>
            <span class="info-value">${contractInfo.totalSupply}</span>
          </div>
        `;
      }

      html += `</div>`;

      // 不再显示创建者信息

      // 添加持有者信息
      if (contractInfo.contractInfo && contractInfo.contractInfo.holders) {
        html += `
          <h4>持有者信息</h4>
          <div class="info-group">
            <div class="info-item">
              <span class="info-label">持有者数量:</span>
              <span class="info-value">${contractInfo.contractInfo.holders.length}</span>
            </div>
          </div>
          <div class="holders-list">
        `;

        // 添加前10个持有者
        const topHolders = contractInfo.contractInfo.holders.slice(0, 10);
        topHolders.forEach(holder => {
          html += `
            <div class="holder-item">
              <span class="holder-address"><a href="https://solscan.io/account/${holder.address}" target="_blank">${truncateMiddle(holder.address, 12)}</a></span>
              <span class="holder-balance">${holder.balance}</span>
              <span class="holder-percentage">${holder.percentage}%</span>
            </div>
          `;
        });

        html += `</div>`;
      }

      html += `</div>`;

      // 更新DOM
      elements.contractInfo.innerHTML = html;
      elements.contractResults.style.display = 'block';
    } else {
      // API 请求失败
      showError('查询失败: ' + (result.message || '未知错误'));

      // 清空结果
      elements.contractInfo.innerHTML = '<div class="no-data">查询失败</div>';
    }
  } catch (error) {
    // 隐藏加载指示器
    elements.contractLoading.style.display = 'none';
    elements.searchContract.disabled = false;

    console.error('查询合约信息失败:', error);
    showError('查询合约信息失败: ' + error.message);

    // 清空结果
    elements.contractInfo.innerHTML = '<div class="no-data">查询失败</div>';
  }
}

// 辅助函数：截断中间部分
function truncateMiddle(str, maxLength) {
  if (!str) return '';

  if (str.length <= maxLength) {
    return str;
  }

  const ellipsis = '...';
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return str.substring(0, frontChars) + ellipsis + str.substring(str.length - backChars);
}

// 显示错误消息
function showError(message) {
  // 创建错误提示元素
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message-popup';
  errorElement.textContent = message;

  // 添加到页面
  document.body.appendChild(errorElement);

  // 显示动画
  setTimeout(() => {
    errorElement.classList.add('show');
  }, 10);

  // 自动关闭
  setTimeout(() => {
    errorElement.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(errorElement);
    }, 300);
  }, 5000);
}

// 显示成功消息
function showSuccess(message) {
  // 创建成功提示元素
  const successElement = document.createElement('div');
  successElement.className = 'success-message-popup';
  successElement.textContent = message;

  // 添加到页面
  document.body.appendChild(successElement);

  // 显示动画
  setTimeout(() => {
    successElement.classList.add('show');
  }, 10);

  // 自动关闭
  setTimeout(() => {
    successElement.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(successElement);
    }, 300);
  }, 5000);
}

// 获取代币元数据并显示图标
async function fetchTokenMetadata(uri) {
  try {
    console.log(`获取代币元数据: ${uri}`);

    // 检查URI是否有效
    if (!uri || (!uri.startsWith('http') && !uri.startsWith('ipfs'))) {
      console.error('无效的元数据URI');
      return;
    }

    // 如果是IPFS URI，确保使用HTTP网关
    let fetchUrl = uri;
    if (uri.startsWith('ipfs://')) {
      fetchUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // 获取元数据
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`获取元数据失败: ${response.status} ${response.statusText}`);
    }

    const metadata = await response.json();
    console.log('获取到的元数据:', metadata);

    // 使用元数据中的名称和符号
    console.log('使用元数据中的名称和符号');

    // 使用元数据中的原始信息，不进行特殊处理
    console.log('使用元数据中的原始信息');

    // 查找图像URL
    let imageUrl = null;
    if (metadata.image) {
      imageUrl = metadata.image;
    } else if (metadata.properties && metadata.properties.image) {
      imageUrl = metadata.properties.image;
    } else if (metadata.properties && metadata.properties.files && metadata.properties.files.length > 0) {
      const imageFile = metadata.properties.files.find(file =>
        file.type && file.type.startsWith('image/') ||
        (file.uri && (file.uri.endsWith('.png') || file.uri.endsWith('.jpg') || file.uri.endsWith('.jpeg') || file.uri.endsWith('.gif')))
      );
      if (imageFile) {
        imageUrl = imageFile.uri || imageFile.url;
      }
    }

    // 如果找到图像URL，显示图像
    if (imageUrl) {
      // 如果是IPFS URI，确保使用HTTP网关
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      console.log(`显示代币图标: ${imageUrl}`);

      // 获取图标容器
      const iconContainer = document.getElementById('token-icon-container');
      if (iconContainer) {
        // 创建图像元素
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = metadata.name || 'Token Icon';
        img.className = 'token-icon';

        // 图像加载完成后移除加载指示器
        img.onload = () => {
          // 清空容器
          iconContainer.innerHTML = '';
          // 添加图像
          iconContainer.appendChild(img);
        };

        // 图像加载失败处理
        img.onerror = () => {
          console.error(`加载图像失败: ${imageUrl}`);
          iconContainer.innerHTML = '<div class="icon-error">图标加载失败</div>';
        };
      }

      // 添加更多元数据信息到页面
      const contractInfo = document.getElementById('contractInfo');
      if (contractInfo) {
        // 查找最后一个info-group
        let infoGroup = contractInfo.querySelector('.info-group:last-child');
        if (!infoGroup) {
          // 如果没有找到，创建一个新的
          infoGroup = document.createElement('div');
          infoGroup.className = 'info-group';
          contractInfo.appendChild(infoGroup);
        }

        // 更新代币名称和符号（如果有）
        if (metadata.name) {
          // 查找所有info-item元素
          const infoItems = contractInfo.querySelectorAll('.info-item');

          // 遍历所有info-item元素，查找代币名称和符号
          infoItems.forEach(item => {
            const label = item.querySelector('.info-label');
            const value = item.querySelector('.info-value');

            if (label && value) {
              // 更新代币名称
              if (label.textContent === '代币名称:') {
                value.textContent = metadata.name;
                console.log(`更新页面上的代币名称为: ${metadata.name}`);
              }

              // 更新代币符号
              if (label.textContent === '代币符号:') {
                value.textContent = metadata.symbol || '';
                console.log(`更新页面上的代币符号为: ${metadata.symbol || ''}`);
              }
            }
          });
        }

        // 添加描述（如果有）
        if (metadata.description) {
          // 检查是否已经存在描述
          const existingDesc = Array.from(infoGroup.querySelectorAll('.info-item .info-label')).find(el => el.textContent.includes('描述'));
          if (!existingDesc) {
            const descItem = document.createElement('div');
            descItem.className = 'info-item';
            descItem.innerHTML = `
              <span class="info-label">描述:</span>
              <span class="info-value">${metadata.description}</span>
            `;
            infoGroup.appendChild(descItem);
          }
        }

        // 添加外部链接（如果有）
        if (metadata.external_url) {
          // 检查是否已经存在外部链接
          const existingLink = Array.from(infoGroup.querySelectorAll('.info-item .info-label')).find(el => el.textContent.includes('官方网站'));
          if (!existingLink) {
            const linkItem = document.createElement('div');
            linkItem.className = 'info-item';
            linkItem.innerHTML = `
              <span class="info-label">官方网站:</span>
              <span class="info-value"><a href="${metadata.external_url}" target="_blank">${metadata.external_url}</a></span>
            `;
            infoGroup.appendChild(linkItem);
          }
        }
      }
    } else {
      console.warn('元数据中未找到图像URL');

      // 获取图标容器并显示错误信息
      const iconContainer = document.getElementById('token-icon-container');
      if (iconContainer) {
        iconContainer.innerHTML = '<div class="icon-error">无图标</div>';
      }
    }
  } catch (error) {
    console.error('获取代币元数据失败:', error);

    // 获取图标容器并显示错误信息
    const iconContainer = document.getElementById('token-icon-container');
    if (iconContainer) {
      iconContainer.innerHTML = '<div class="icon-error">元数据加载失败</div>';
    }
  }
}

// 跟踪已处理的合约地址，避免重复处理
const processedAddresses = new Set();

// 存储代币图标URL
const tokenIconUrls = {};

// 跟踪元数据获取进度
let metadataFetchCounter = {
  total: 0,
  completed: 0,
  allTokens: []
};

// 重置元数据获取计数器
function resetMetadataFetchCounter(tokens) {
  metadataFetchCounter.total = tokens.length;
  metadataFetchCounter.completed = 0;
  metadataFetchCounter.allTokens = tokens;
  console.log(`重置元数据获取计数器: 总数=${tokens.length}`);
}

// 增加已完成的元数据获取计数
function incrementMetadataFetchCounter() {
  metadataFetchCounter.completed++;
  console.log(`元数据获取进度: ${metadataFetchCounter.completed}/${metadataFetchCounter.total}`);

  // 如果所有元数据都已获取完成，过滤并重新渲染代币列表
  if (metadataFetchCounter.completed >= metadataFetchCounter.total) {
    console.log('所有元数据获取完成，过滤并重新渲染代币列表');
    filterAndRenderTokenList();
  }
}

// 过滤并重新渲染代币列表（过滤Unknown Token，用于最终显示）
function filterAndRenderTokenList() {
  // 过滤掉名称为"Unknown Token"的合约
  const filteredTokens = state.tokens.filteredList.filter(token => {
    if (token.name === 'Unknown Token') {
      console.log(`过滤掉Unknown Token: ${token.address}`);
      return false;
    }
    return true;
  });

  // 按交易数量排序
  const sortedTokens = [...filteredTokens].sort((a, b) => b.transactions - a.transactions);

  // 生成HTML
  let html = '';

  sortedTokens.forEach(token => {
    html += `
      <div class="token-card">
        <div class="token-icon-container token-list-icon" id="token-icon-${token.address.replace(/[^a-zA-Z0-9]/g, '')}">
          <div class="token-symbol-placeholder">${token.symbol.charAt(0)}</div>
        </div>
        <div class="token-header">
          <span class="token-symbol">${token.symbol}</span>
          <span class="token-tx-count">${token.transactions} 笔交易</span>
        </div>
        <div class="token-name">${token.name}</div>
        <div class="token-address">
          <a href="https://solscan.io/token/${token.address}" target="_blank" title="${token.address}">
            ${token.address}
          </a>
        </div>
        ${token.relatedTxs && token.relatedTxs.length > 0 && state.tokens.currentFilter === 'filtered' ? `
        <div class="token-transactions">
          <div class="token-tx-header">相关交易:</div>
          <div class="token-tx-list">
            ${token.relatedTxs.slice(0, 3).map(tx => `
              <div class="token-tx-item">
                <div class="token-tx-hash">
                  <a href="https://solscan.io/tx/${tx.signature}" target="_blank" title="${tx.signature}">
                    ${tx.signature ? truncateMiddle(tx.signature, 10) : '无交易哈希'}
                  </a>
                </div>
                <div class="token-tx-details">
                  <span class="token-tx-time">${tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : '无时间'}</span>
                  <span class="token-tx-amount">${tx.amount ? (tx.amount / Math.pow(10, token.decimals)).toFixed(6) : '0'} ${token.symbol}</span>
                </div>
              </div>
            `).join('')}
            ${token.relatedTxs.length > 3 ? `<div class="token-tx-more">还有 ${token.relatedTxs.length - 3} 笔交易...</div>` : ''}
          </div>
        </div>
        ` : ''}
        <div class="token-actions">
          <button class="token-action-btn" data-address="${token.address}" data-action="search">查询合约详情</button>
          <button class="token-action-btn" data-address="${token.address}" data-action="copy">复制合约地址</button>
        </div>
      </div>
    `;
  });

  // 更新DOM
  elements.tokenListGrid.innerHTML = html;

  // 恢复已加载的图标
  sortedTokens.forEach(token => {
    const iconContainer = document.getElementById(`token-icon-${token.address.replace(/[^a-zA-Z0-9]/g, '')}`);
    if (iconContainer && tokenIconUrls[token.address]) {
      console.log(`恢复代币图标: ${token.address} -> ${tokenIconUrls[token.address].url}`);

      // 清空容器
      iconContainer.innerHTML = '';

      // 创建新的图像元素
      const img = document.createElement('img');
      img.src = tokenIconUrls[token.address].url;
      img.alt = tokenIconUrls[token.address].name || 'Token Icon';
      img.className = 'token-icon';

      // 添加图像
      iconContainer.appendChild(img);
    }
  });

  // 添加事件监听器
  document.querySelectorAll('.token-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const address = btn.getAttribute('data-address');
      const action = btn.getAttribute('data-action');

      if (action === 'search') {
        // 跳转到合约信息标签页并查询
        switchTab('contracts');
        elements.contractAddress.value = address;
        searchContract();
      } else if (action === 'copy') {
        // 复制合约地址到剪贴板
        navigator.clipboard.writeText(address)
          .then(() => {
            showSuccess('合约地址已成功复制到剪贴板');
          })
          .catch(err => {
            console.error('复制失败:', err);
            showError('复制合约地址失败');
          });
      }
    });
  });
}

// 获取代币列表中的代币元数据和图标
async function fetchTokenMetadataForList(contractAddress) {
  try {
    // 检查是否已经处理过这个地址
    if (processedAddresses.has(contractAddress)) {
      console.log(`跳过已处理的地址: ${contractAddress}`);
      return;
    }

    // 添加到已处理集合
    processedAddresses.add(contractAddress);

    console.log(`获取代币列表中的元数据: ${contractAddress}`);

    // 使用API模块获取合约信息
    const contractResult = await api.getContractInfo(contractAddress);
    console.log(`使用API模块获取合约信息成功:`, contractResult);

    if (contractResult.success && contractResult.result) {
      // 提取元数据
      let metadata = null;

      // 检查正确的JSON路径: result.contractInfo.result.metadata
      if (contractResult.result &&
          contractResult.result.contractInfo &&
          contractResult.result.contractInfo.result &&
          contractResult.result.contractInfo.result.metadata) {
        metadata = contractResult.result.contractInfo.result.metadata;
        console.log(`从正确路径获取元数据: result.contractInfo.result.metadata`, metadata);
      }
      // 备用路径检查
      else if (contractResult.result.metadata) {
        metadata = contractResult.result.metadata;
        console.log(`从result.metadata中获取元数据:`, metadata);
      }
      // 另一个备用路径检查
      else if (contractResult.result.contractInfo && contractResult.result.contractInfo.metadata) {
        metadata = contractResult.result.contractInfo.metadata;
        console.log(`从contractInfo.metadata中获取元数据:`, metadata);
      }

      // 从元数据URI中获取图标URL、名称和符号
      if (metadata && metadata.uri) {
        console.log(`从元数据URI中获取图标URL、名称和符号: ${metadata.uri}`);

        // 如果是IPFS URI，确保使用HTTP网关
        let fetchUrl = metadata.uri;
        if (fetchUrl.startsWith('ipfs://')) {
          fetchUrl = fetchUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        // 获取元数据JSON
        console.log(`获取元数据JSON: ${fetchUrl}`);

        try {
          const metadataResponse = await fetch(fetchUrl, {
            headers: {
              'Accept': 'application/json'
            }
          });

          if (!metadataResponse.ok) {
            throw new Error(`获取元数据JSON失败: ${metadataResponse.status} ${metadataResponse.statusText}`);
          }

          const metadataText = await metadataResponse.text();

          try {
            const metadataJson = JSON.parse(metadataText);
            console.log(`获取到的元数据JSON:`, metadataJson);

            // 查找图像URL
            let imageUrl = null;
            if (metadataJson.image) {
              imageUrl = metadataJson.image;
            } else if (metadataJson.properties && metadataJson.properties.image) {
              imageUrl = metadataJson.properties.image;
            } else if (metadataJson.properties && metadataJson.properties.files && metadataJson.properties.files.length > 0) {
              const imageFile = metadataJson.properties.files.find(file =>
                file.type && file.type.startsWith('image/') ||
                (file.uri && (file.uri.endsWith('.png') || file.uri.endsWith('.jpg') || file.uri.endsWith('.jpeg') || file.uri.endsWith('.gif')))
              );
              if (imageFile) {
                imageUrl = imageFile.uri || imageFile.url;
              }
            }

            // 如果找到图像URL，显示图像
            if (imageUrl) {
              // 如果是IPFS URI，确保使用HTTP网关
              if (imageUrl.startsWith('ipfs://')) {
                imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
              }

              console.log(`显示代币图标: ${imageUrl}`);

              // 保存代币图标URL
              tokenIconUrls[contractAddress] = {
                url: imageUrl,
                name: metadataJson.name || '',
                symbol: metadataJson.symbol || ''
              };
              console.log(`保存代币图标URL: ${contractAddress} -> ${imageUrl}`);

              // 获取图标容器
              const iconContainer = document.getElementById(`token-icon-${contractAddress.replace(/[^a-zA-Z0-9]/g, '')}`);
              if (iconContainer) {
                // 创建图像元素
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = metadataJson.name || 'Token Icon';
                img.className = 'token-icon';

                // 图像加载完成后移除占位符
                img.onload = () => {
                  // 清空容器
                  iconContainer.innerHTML = '';
                  // 添加图像
                  iconContainer.appendChild(img);

                  // 图标URL已经保存在tokenIconUrls中，不需要创建隐藏的缓存图像
                };

                // 图像加载失败处理
                img.onerror = () => {
                  console.error(`加载图像失败: ${imageUrl}`);
                  // 保留原始占位符
                };
              }
            }

            // 更新代币名称和符号（如果有）
            if (metadataJson.name || metadataJson.symbol) {
              // 更新state中的代币信息
              const tokenIndex = state.tokens.list.findIndex(token =>
                token.address.toLowerCase() === contractAddress.toLowerCase()
              );

              if (tokenIndex !== -1) {
                // 更新代币名称和符号
                if (metadataJson.name) {
                  state.tokens.list[tokenIndex].name = metadataJson.name;
                  console.log(`更新代币名称: ${contractAddress} -> ${metadataJson.name}`);
                }

                if (metadataJson.symbol) {
                  state.tokens.list[tokenIndex].symbol = metadataJson.symbol;
                  console.log(`更新代币符号: ${contractAddress} -> ${metadataJson.symbol}`);
                }

                // 不要在这里调用filterTokenList()，避免无限循环
                // 只更新state中的数据，不触发UI更新
              }

              // 查找代币卡片
              const tokenCards = document.querySelectorAll('.token-card');
              tokenCards.forEach(card => {
                const addressElement = card.querySelector('.token-address a');
                if (addressElement && addressElement.getAttribute('href').includes(contractAddress)) {
                  // 更新代币名称
                  const nameElement = card.querySelector('.token-name');
                  if (nameElement && metadataJson.name) {
                    nameElement.textContent = metadataJson.name;
                  }

                  // 更新代币符号
                  const symbolElement = card.querySelector('.token-symbol');
                  if (symbolElement && metadataJson.symbol) {
                    symbolElement.textContent = metadataJson.symbol;
                  }
                }
              });
            }
          } catch (e) {
            console.error(`解析元数据JSON失败: ${e.message}`);
          }
        } catch (e) {
          console.error(`获取元数据JSON失败: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`获取代币元数据失败: ${error.message}`, error);
  } finally {
    // 增加已完成的元数据获取计数
    incrementMetadataFetchCounter();
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);