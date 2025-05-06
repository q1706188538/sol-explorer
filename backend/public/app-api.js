(function() {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.debug = function() {};
  }
})();

const API_BASE_URL = '/api';

const API_ENDPOINTS = {
  VERIFY_BURN: `${API_BASE_URL}/verify-burn`,
  VERIFICATION_STATUS: `${API_BASE_URL}/verification-status`,
  TRANSACTIONS: `${API_BASE_URL}/transactions`,
  TOKEN_TRANSFERS: `${API_BASE_URL}/token-transfers`,

  CONTRACT_INFO: `${API_BASE_URL}/contract-info`,
  CONFIG: `${API_BASE_URL}/config`,
  API_PROVIDER: `${API_BASE_URL}/api-provider`,
  RELOAD_CONFIG: `${API_BASE_URL}/reload-config`,
  SAVE_CONFIG: `${API_BASE_URL}/save-config`,
  CLEAR_VERIFICATION: `${API_BASE_URL}/clear-verification`
};

let appConfig = null;

const api = {
  async get(url, params = {}) {
    try {
      const queryString = Object.keys(params)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      const fullUrl = queryString ? `${url}?${queryString}` : url;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `请求失败: ${response.status}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  async post(url, data = {}) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || `请求失败: ${response.status}`);
      }

      return responseData;
    } catch (error) {
      throw error;
    }
  },

  async verifyBurn(txHash) {
    return await this.post(API_ENDPOINTS.VERIFY_BURN, { txHash });
  },

  async getVerificationStatus() {
    return await this.get(API_ENDPOINTS.VERIFICATION_STATUS);
  },

  async getTransactions(address, page = 1, offset = 5000) {
    return await this.post(API_ENDPOINTS.TRANSACTIONS, { address, page, offset });
  },

  async getTokenTransfers(address, page = 1, offset = 5000) {
    return await this.post(API_ENDPOINTS.TOKEN_TRANSFERS, { address, page, offset });
  },

  async getContractInfo(contractAddress) {
    return await this.post(API_ENDPOINTS.CONTRACT_INFO, { contractAddress });
  },

  async getConfig() {
    const config = await this.get(API_ENDPOINTS.CONFIG);
    appConfig = config;
    return config;
  },

  async getApiProvider() {
    return await this.get(API_ENDPOINTS.API_PROVIDER);
  },

  async reloadConfig() {
    const result = await this.post(API_ENDPOINTS.RELOAD_CONFIG);
    if (result.success) {
      appConfig = result.config;
    }
    return result;
  },

  async saveConfig(config) {
    const result = await this.post(API_ENDPOINTS.SAVE_CONFIG, config);
    if (result.success) {
      appConfig = result.config;
    }
    return result;
  },

  async clearVerification() {
    return await this.post(API_ENDPOINTS.CLEAR_VERIFICATION);
  }
};

window.api = api;
