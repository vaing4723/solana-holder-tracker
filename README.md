# Solana Token Holder Tracker

一个用于追踪Solana代币持有者数量变化的实时监控工具。

## 功能特点

- 实时监控代币持有者数量变化
- 支持多种时间框架（1秒、15秒、30秒、1分钟、5分钟、1小时、24小时）
- 通过K线图可视化持有者数量变化趋势
- 搜索功能支持查找任意Solana代币
- 自动获取代币元数据和价格信息
- 暗色/亮色主题模式切换

## 技术栈

- React.js
- lightweight-charts（图表库）
- Helius API（获取代币账户数据）
- Birdeye API（获取代币价格和交易数据）

## 安装与使用

1. 克隆项目
```bash
git clone https://github.com/yourusername/solana-holder-tracker.git
cd solana-holder-tracker
```

2. 安装依赖
```bash
npm install
```

3. 运行开发服务器
```bash
npm run dev
```

4. 在浏览器打开 http://localhost:5173 或配置的端口

## API密钥配置

项目使用了以下API服务：
- Helius API: 用于获取代币持有者数据
- Birdeye API: 用于获取价格和交易数据

在生产环境中，建议把API密钥配置在环境变量中，而不是直接写在代码中。

## 许可证

MIT 