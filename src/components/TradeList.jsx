import { useState, useEffect } from 'react';
import axios from 'axios';

// Birdeye API Key - 请替换为你的API KEY
const BIRDEYE_API_KEY = '9d54fc0d9a24492089406c1129a34e57';

// 模拟数据（API失败时备用）
const MOCK_TRADES = [
  {
    txHash: 'mock1',
    blockTime: Math.floor(Date.now() / 1000),
    side: 'buy',
    price: '0.04603',
    amount: '1200',
  },
  {
    txHash: 'mock2',
    blockTime: Math.floor(Date.now() / 1000) - 60,
    side: 'sell',
    price: '0.04610',
    amount: '800',
  },
  {
    txHash: 'mock3',
    blockTime: Math.floor(Date.now() / 1000) - 120,
    side: 'buy',
    price: '0.04590',
    amount: '500',
  },
  {
    txHash: 'mock4',
    blockTime: Math.floor(Date.now() / 1000) - 180,
    side: 'sell',
    price: '0.04588',
    amount: '1500',
  },
  {
    txHash: 'mock5',
    blockTime: Math.floor(Date.now() / 1000) - 240,
    side: 'buy',
    price: '0.04602',
    amount: '950',
  },
];

const TradeList = ({ contractAddress }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    if (!useMockData) {
      fetchTradeData();
    } else {
      setTrades(MOCK_TRADES);
      setLoading(false);
    }
    
    async function fetchTradeData() {
      if (!contractAddress) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('获取成交明细数据，合约地址:', contractAddress);
        const response = await axios.get(
          `https://public-api.birdeye.so/public/transaction?address=${contractAddress}`,
          {
            headers: {
              'X-API-KEY': BIRDEYE_API_KEY,
            },
          }
        );

        const transactions = response.data?.data?.transactions || [];
        console.log('获取到成交明细条数:', transactions.length);

        if (transactions.length > 0) {
          setTrades(transactions);
          setLoading(false);
        } else {
          console.log('未找到成交明细，使用模拟数据');
          setUseMockData(true);
          setTrades(MOCK_TRADES);
          setLoading(false);
        }
      } catch (error) {
        console.error('获取成交明细失败:', error);
        setError('获取交易数据失败，请稍后再试');
        setUseMockData(true);
        setTrades(MOCK_TRADES);
        setLoading(false);
      }
    }
    
    return () => {
      // 清理函数
    };
  }, [contractAddress, useMockData]);

  // 格式化日期时间
  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString();
    } catch (e) {
      return '-';
    }
  };

  if (loading && trades.length === 0) {
    return (
      <div className="trade-list">
        <div className="trade-list-header">
          <span>时间</span>
          <span>方向</span>
          <span>价格</span>
          <span>数量</span>
        </div>
        <div className="trade-list-empty">加载中...</div>
      </div>
    );
  }

  return (
    <div className="trade-list">
      <div className="trade-list-header">
        <span>时间</span>
        <span>方向</span>
        <span>价格</span>
        <span>数量</span>
      </div>
      
      {trades.length === 0 ? (
        <div className="trade-list-empty">暂无成交</div>
      ) : (
        trades.map((trade, index) => (
          <div 
            key={trade.txHash || index} 
            className="trade-list-row"
          >
            <span>{formatTime(trade.blockTime)}</span>
            <span className={trade.side === 'buy' ? 'trade-buy' : 'trade-sell'}>
              {trade.side === 'buy' ? '买入' : '卖出'}
            </span>
            <span>{trade.price || '-'}</span>
            <span>{trade.amount || '-'}</span>
          </div>
        ))
      )}
      
      {useMockData && (
        <div className="mock-data-notice">
          当前显示模拟交易数据
        </div>
      )}
    </div>
  );
};

export default TradeList; 