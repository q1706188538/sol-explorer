/**
 * 分页功能模块
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

// 分页状态
const paginationState = {
  currentPage: 1,
  pageSize: 10,
  totalPages: 0,
  totalRecords: 0
};

// 初始化分页
function initPagination(options) {
  // 更新状态
  if (options.currentPage) paginationState.currentPage = options.currentPage;
  if (options.pageSize) paginationState.pageSize = options.pageSize;
  if (options.totalPages) paginationState.totalPages = options.totalPages;
  if (options.totalRecords) paginationState.totalRecords = options.totalRecords;

  // 更新UI
  updatePaginationUI();
}

// 更新分页UI
function updatePaginationUI() {
  // 计算当前页的数据范围
  const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize + 1;
  const endIndex = Math.min(startIndex + paginationState.pageSize - 1, paginationState.totalRecords);

  // 更新分页信息
  document.getElementById('pageStart').textContent = paginationState.totalRecords > 0 ? startIndex : 0;
  document.getElementById('pageEnd').textContent = endIndex;
  document.getElementById('totalRecords').textContent = paginationState.totalRecords;
  document.getElementById('currentPage').textContent = paginationState.currentPage;
  document.getElementById('totalPages').textContent = paginationState.totalPages;

  // 更新分页按钮状态
  document.getElementById('firstPage').disabled = paginationState.currentPage === 1;
  document.getElementById('prevPage').disabled = paginationState.currentPage === 1;
  document.getElementById('nextPage').disabled = paginationState.currentPage === paginationState.totalPages || paginationState.totalPages === 0;
  document.getElementById('lastPage').disabled = paginationState.currentPage === paginationState.totalPages || paginationState.totalPages === 0;
}

// 跳转到指定页
function goToPage(page) {
  // 确保页码有效
  if (page < 1 || page > paginationState.totalPages) {
    return;
  }

  // 更新当前页码
  paginationState.currentPage = page;

  // 更新UI
  updatePaginationUI();

  // 触发页面变更事件
  const event = new CustomEvent('pageChanged', {
    detail: {
      currentPage: paginationState.currentPage,
      pageSize: paginationState.pageSize
    }
  });
  document.dispatchEvent(event);
}

// 更改每页显示数量
function changePageSize(newSize) {
  if (newSize !== paginationState.pageSize) {
    // 更新每页显示数量
    paginationState.pageSize = newSize;

    // 重新计算总页数
    paginationState.totalPages = Math.ceil(paginationState.totalRecords / newSize);

    // 确保当前页码有效
    if (paginationState.currentPage > paginationState.totalPages) {
      paginationState.currentPage = Math.max(1, paginationState.totalPages);
    }

    // 更新UI
    updatePaginationUI();

    // 触发页面大小变更事件
    const event = new CustomEvent('pageSizeChanged', {
      detail: {
        currentPage: paginationState.currentPage,
        pageSize: paginationState.pageSize
      }
    });
    document.dispatchEvent(event);
  }
}

// 设置总记录数和总页数
function setTotalRecords(totalRecords) {
  paginationState.totalRecords = totalRecords;
  paginationState.totalPages = Math.ceil(totalRecords / paginationState.pageSize);

  // 确保当前页码有效
  if (paginationState.currentPage > paginationState.totalPages) {
    paginationState.currentPage = Math.max(1, paginationState.totalPages);
  }

  // 更新UI
  updatePaginationUI();
}

// 导出分页功能
window.pagination = {
  init: initPagination,
  goToPage: goToPage,
  changePageSize: changePageSize,
  setTotalRecords: setTotalRecords,
  getState: () => ({ ...paginationState })
};
