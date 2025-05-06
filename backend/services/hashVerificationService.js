const fs = require('fs');
const path = require('path');

class HashVerificationService {
  constructor() {
    // 初始化已验证哈希列表
    this.verifiedHashes = new Map();
    // 初始化已使用哈希列表
    this.usedHashes = new Map();
    // 初始化锁定哈希列表
    this.lockedHashes = new Map();
    // 初始化API请求状态跟踪
    this.apiRequestStatus = new Map();

    // 数据文件路径
    this.dataDir = path.join(__dirname, '../data');
    this.verifiedHashesFile = path.join(this.dataDir, 'verified-hashes.json');
    this.usedHashesFile = path.join(this.dataDir, 'used-hashes.json');

    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // 加载已验证哈希
    this.loadVerifiedHashes();
    // 加载已使用哈希
    this.loadUsedHashes();
  }

  // 标准化哈希值（去除0x前缀，转换为小写）
  normalizeHash(hash) {
    if (!hash) return '';
    return hash.toLowerCase().startsWith('0x') ? hash.toLowerCase().substring(2) : hash.toLowerCase();
  }

  // 加载已验证哈希
  loadVerifiedHashes() {
    try {
      if (fs.existsSync(this.verifiedHashesFile)) {
        const data = fs.readFileSync(this.verifiedHashesFile, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 将JSON对象转换为Map
        for (const [hash, details] of Object.entries(jsonData)) {
          this.verifiedHashes.set(this.normalizeHash(hash), details);
        }
        
        console.log(`已加载 ${this.verifiedHashes.size} 个已验证哈希`);
      } else {
        console.log('已验证哈希文件不存在，将创建新文件');
        this.saveVerifiedHashes();
      }
    } catch (error) {
      console.error('加载已验证哈希失败:', error);
      // 如果加载失败，初始化为空Map
      this.verifiedHashes = new Map();
      // 尝试创建新文件
      this.saveVerifiedHashes();
    }
  }

  // 加载已使用哈希
  loadUsedHashes() {
    try {
      if (fs.existsSync(this.usedHashesFile)) {
        const data = fs.readFileSync(this.usedHashesFile, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 将JSON对象转换为Map
        for (const [hash, timestamp] of Object.entries(jsonData)) {
          this.usedHashes.set(this.normalizeHash(hash), timestamp);
        }
        
        console.log(`已加载 ${this.usedHashes.size} 个已使用哈希`);
      } else {
        console.log('已使用哈希文件不存在，将创建新文件');
        this.saveUsedHashes();
      }
    } catch (error) {
      console.error('加载已使用哈希失败:', error);
      // 如果加载失败，初始化为空Map
      this.usedHashes = new Map();
      // 尝试创建新文件
      this.saveUsedHashes();
    }
  }

  // 保存已验证哈希
  saveVerifiedHashes() {
    try {
      // 将Map转换为JSON对象
      const jsonData = {};
      for (const [hash, details] of this.verifiedHashes.entries()) {
        jsonData[hash] = details;
      }
      
      fs.writeFileSync(this.verifiedHashesFile, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`已保存 ${this.verifiedHashes.size} 个已验证哈希`);
    } catch (error) {
      console.error('保存已验证哈希失败:', error);
    }
  }

  // 保存已使用哈希
  saveUsedHashes() {
    try {
      // 将Map转换为JSON对象
      const jsonData = {};
      for (const [hash, timestamp] of this.usedHashes.entries()) {
        jsonData[hash] = timestamp;
      }
      
      fs.writeFileSync(this.usedHashesFile, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`已保存 ${this.usedHashes.size} 个已使用哈希`);
    } catch (error) {
      console.error('保存已使用哈希失败:', error);
    }
  }

  // 添加已验证哈希
  addVerifiedHash(hash, from) {
    const normalizedHash = this.normalizeHash(hash);
    
    // 添加到已验证哈希列表
    this.verifiedHashes.set(normalizedHash, {
      from: from,
      timestamp: Date.now(),
      status: 'verified' // 状态：verified, locked, used
    });
    
    // 保存到文件
    this.saveVerifiedHashes();
    
    console.log(`已添加已验证哈希: ${normalizedHash}, 来自: ${from}`);
  }

  // 锁定哈希（标记为正在使用）
  lockHash(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    // 检查哈希是否已验证
    if (this.verifiedHashes.has(normalizedHash)) {
      const details = this.verifiedHashes.get(normalizedHash);
      details.status = 'locked';
      this.verifiedHashes.set(normalizedHash, details);
      
      // 添加到锁定哈希列表
      this.lockedHashes.set(normalizedHash, Date.now());
      
      // 保存到文件
      this.saveVerifiedHashes();
      
      console.log(`已锁定哈希: ${normalizedHash}`);
      return true;
    }
    
    console.log(`锁定哈希失败，哈希未验证: ${normalizedHash}`);
    return false;
  }

  // 解锁哈希
  unlockHash(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    // 检查哈希是否已锁定
    if (this.verifiedHashes.has(normalizedHash)) {
      const details = this.verifiedHashes.get(normalizedHash);
      if (details.status === 'locked') {
        details.status = 'verified';
        this.verifiedHashes.set(normalizedHash, details);
        
        // 从锁定哈希列表中移除
        this.lockedHashes.delete(normalizedHash);
        
        // 保存到文件
        this.saveVerifiedHashes();
        
        console.log(`已解锁哈希: ${normalizedHash}`);
        return true;
      }
    }
    
    console.log(`解锁哈希失败，哈希未锁定: ${normalizedHash}`);
    return false;
  }

  // 标记哈希为已使用
  markHashAsUsed(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    // 检查哈希是否已验证
    if (this.verifiedHashes.has(normalizedHash)) {
      const details = this.verifiedHashes.get(normalizedHash);
      details.status = 'used';
      this.verifiedHashes.set(normalizedHash, details);
      
      // 添加到已使用哈希列表
      this.usedHashes.set(normalizedHash, Date.now());
      
      // 从锁定哈希列表中移除
      this.lockedHashes.delete(normalizedHash);
      
      // 保存到文件
      this.saveVerifiedHashes();
      this.saveUsedHashes();
      
      console.log(`已标记哈希为已使用: ${normalizedHash}`);
      return true;
    }
    
    console.log(`标记哈希为已使用失败，哈希未验证: ${normalizedHash}`);
    return false;
  }

  // 检查哈希是否已验证
  isHashVerified(hash) {
    const normalizedHash = this.normalizeHash(hash);
    return this.verifiedHashes.has(normalizedHash);
  }

  // 检查哈希是否已使用
  isHashUsed(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    // 检查哈希是否在已使用列表中
    if (this.usedHashes.has(normalizedHash)) {
      return true;
    }
    
    // 检查哈希状态是否为已使用
    if (this.verifiedHashes.has(normalizedHash)) {
      const details = this.verifiedHashes.get(normalizedHash);
      return details.status === 'used';
    }
    
    return false;
  }

  // 获取哈希状态
  getHashStatus(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    if (this.verifiedHashes.has(normalizedHash)) {
      const details = this.verifiedHashes.get(normalizedHash);
      return details.status;
    }
    
    return 'unknown';
  }

  // 获取哈希详情
  getHashDetails(hash) {
    const normalizedHash = this.normalizeHash(hash);
    
    if (this.verifiedHashes.has(normalizedHash)) {
      return this.verifiedHashes.get(normalizedHash);
    }
    
    return null;
  }

  // 清理过期的哈希记录
  cleanupExpiredHashes(retentionHours = 24) {
    const now = Date.now();
    const retentionTime = retentionHours * 60 * 60 * 1000; // 转换为毫秒
    let cleanedCount = 0;
    
    // 清理已使用哈希
    for (const [hash, timestamp] of this.usedHashes.entries()) {
      if (now - timestamp > retentionTime) {
        this.usedHashes.delete(hash);
        cleanedCount++;
      }
    }
    
    // 清理已验证哈希
    for (const [hash, details] of this.verifiedHashes.entries()) {
      if (details.status === 'used' && now - details.timestamp > retentionTime) {
        this.verifiedHashes.delete(hash);
        cleanedCount++;
      }
    }
    
    // 如果有清理，保存到文件
    if (cleanedCount > 0) {
      this.saveVerifiedHashes();
      this.saveUsedHashes();
      console.log(`已清理 ${cleanedCount} 个过期哈希记录`);
    }
    
    return cleanedCount;
  }

  // 初始化API请求状态跟踪
  initApiRequestStatus(hash) {
    const normalizedHash = this.normalizeHash(hash);
    this.apiRequestStatus.set(normalizedHash, {
      normalTxCompleted: false,
      tokenTxCompleted: false,
      timestamp: Date.now()
    });
    console.log(`已初始化API请求状态跟踪: ${normalizedHash}`);
  }

  // 标记普通交易API请求已完成
  markNormalTxCompleted(hash) {
    const normalizedHash = this.normalizeHash(hash);
    if (this.apiRequestStatus.has(normalizedHash)) {
      const status = this.apiRequestStatus.get(normalizedHash);
      status.normalTxCompleted = true;
      this.apiRequestStatus.set(normalizedHash, status);
      
      // 检查是否两个API都已完成
      this.checkApiRequestsCompleted(normalizedHash);
      
      console.log(`已标记普通交易API请求已完成: ${normalizedHash}`);
      return true;
    }
    return false;
  }

  // 标记代币交易API请求已完成
  markTokenTxCompleted(hash) {
    const normalizedHash = this.normalizeHash(hash);
    if (this.apiRequestStatus.has(normalizedHash)) {
      const status = this.apiRequestStatus.get(normalizedHash);
      status.tokenTxCompleted = true;
      this.apiRequestStatus.set(normalizedHash, status);
      
      // 检查是否两个API都已完成
      this.checkApiRequestsCompleted(normalizedHash);
      
      console.log(`已标记代币交易API请求已完成: ${normalizedHash}`);
      return true;
    }
    return false;
  }

  // 检查API请求是否都已完成
  checkApiRequestsCompleted(hash) {
    const normalizedHash = this.normalizeHash(hash);
    if (this.apiRequestStatus.has(normalizedHash)) {
      const status = this.apiRequestStatus.get(normalizedHash);
      
      // 如果两个API都已完成，标记哈希为已使用
      if (status.normalTxCompleted && status.tokenTxCompleted) {
        console.log(`两个API请求都已完成，标记哈希为已使用: ${normalizedHash}`);
        this.markHashAsUsed(normalizedHash);
        this.apiRequestStatus.delete(normalizedHash);
        return true;
      }
    }
    return false;
  }

  // 清理API请求状态
  cleanupApiRequestStatus(hash) {
    const normalizedHash = this.normalizeHash(hash);
    if (this.apiRequestStatus.has(normalizedHash)) {
      this.apiRequestStatus.delete(normalizedHash);
      console.log(`已清理API请求状态: ${normalizedHash}`);
      return true;
    }
    return false;
  }
}

module.exports = new HashVerificationService();
