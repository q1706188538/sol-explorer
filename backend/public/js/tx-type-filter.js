/**
 * 交易类型筛选模块
 */

// 禁用所有控制台日志，提升性能
(function() {
  // 在生产环境中禁用所有控制台输出
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.debug = function() {};
  }
})();

// 筛选状态
const filterState = {
  currentTypeFilter: 'all', // 交易类型筛选: all, in, out
  currentTokenFilter: 'all' // 代币筛选
};

// 初始化筛选器
function initFilter(options) {
  // 更新状态
  if (options.typeFilter) filterState.currentTypeFilter = options.typeFilter;
  if (options.tokenFilter) filterState.currentTokenFilter = options.tokenFilter;

  // 更新UI
  updateFilterUI();
}

// 更新筛选器UI
function updateFilterUI() {
  // 更新交易类型筛选按钮
  document.querySelectorAll('.tx-type-btn').forEach(btn => {
    if (btn.getAttribute('data-type') === filterState.currentTypeFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 更新代币筛选按钮
  document.querySelectorAll('.token-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-token') === filterState.currentTokenFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// 按类型筛选交易
function filterByType(type) {
  // 更新状态
  filterState.currentTypeFilter = type;

  // 更新UI
  updateFilterUI();

  // 触发筛选变更事件
  const event = new CustomEvent('filterChanged', {
    detail: {
      typeFilter: filterState.currentTypeFilter,
      tokenFilter: filterState.currentTokenFilter
    }
  });
  document.dispatchEvent(event);
}

// 按代币筛选交易
function filterByToken(token) {
  // 更新状态
  filterState.currentTokenFilter = token;

  // 更新UI
  updateFilterUI();

  // 触发筛选变更事件
  const event = new CustomEvent('filterChanged', {
    detail: {
      typeFilter: filterState.currentTypeFilter,
      tokenFilter: filterState.currentTokenFilter
    }
  });
  document.dispatchEvent(event);
}

// 应用筛选器
function applyFilter(data, address) {
  // 应用类型筛选
  let filtered = [...data];

  if (filterState.currentTypeFilter === 'in') {
    filtered = filtered.filter(tx => tx.to && tx.to.toLowerCase() === address.toLowerCase());
  } else if (filterState.currentTypeFilter === 'out') {
    filtered = filtered.filter(tx => tx.from && tx.from.toLowerCase() === address.toLowerCase());
  }

  // 应用代币筛选
  if (filterState.currentTokenFilter !== 'all') {
    filtered = filtered.filter(tx => {
      // 对于普通交易，检查是否是SOL
      if (!tx.tokenSymbol && filterState.currentTokenFilter === 'SOL') {
        return true;
      }

      // 对于代币交易，检查代币符号
      return tx.tokenSymbol && tx.tokenSymbol.toUpperCase() === filterState.currentTokenFilter.toUpperCase();
    });
  }

  return filtered;
}

// 导出筛选功能
window.txFilter = {
  init: initFilter,
  filterByType: filterByType,
  filterByToken: filterByToken,
  applyFilter: applyFilter,
  getState: () => ({ ...filterState })
};
