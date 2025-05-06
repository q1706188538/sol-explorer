const fs = require('fs');
const path = require('path');

// 要处理的文件列表
const files = [
  path.join(__dirname, 'public', 'app.js'),
  path.join(__dirname, 'public', 'app-api.js'),
  path.join(__dirname, 'public', 'js', 'tx-type-filter.js'),
  path.join(__dirname, 'public', 'js', 'pagination-new.js')
];

// 清理函数
function cleanFile(filePath) {
  console.log(`处理文件: ${filePath}`);
  
  // 读取文件内容
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 保存原始长度
  const originalLength = content.length;
  
  // 删除多行注释 (/* ... */)
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 删除单行注释 (// ...)
  content = content.replace(/\/\/.*$/gm, '');
  
  // 删除控制台日志
  content = content.replace(/console\.(log|info|warn|error|debug)\([^)]*\);?/g, '');
  
  // 删除空行
  content = content.replace(/^\s*[\r\n]/gm, '');
  
  // 保留禁用控制台日志的代码
  const disableConsoleCode = `(function() {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.debug = function() {};
  }
})();

`;
  
  // 添加禁用控制台日志的代码到文件开头
  content = disableConsoleCode + content;
  
  // 写入文件
  fs.writeFileSync(filePath, content, 'utf8');
  
  // 计算减少的字节数
  const newLength = content.length;
  const reduction = originalLength - newLength;
  
  console.log(`文件已清理: ${filePath}`);
  console.log(`减少了 ${reduction} 字节 (${Math.round(reduction / originalLength * 100)}%)`);
}

// 处理所有文件
files.forEach(cleanFile);

console.log('所有文件已处理完成');
