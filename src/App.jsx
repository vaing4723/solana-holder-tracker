import { useState, useEffect } from 'react';
import { ThemeProvider } from './ThemeContext';
import Navbar from './components/Navbar';
import KLineChart from './components/KLineChart';

// 默认合约地址
const DEFAULT_CONTRACT_ADDRESS = '9j6twpYWrV1ueJok76D9YK8wJTVoG9Zy8spC7wnTpump';

function App() {
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1s');

  // 确保组件加载后设置加载状态
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // 时间框架选项
  const timeframes = ['1s', '15s', '30s', '1m', '5m', '1h', '24h'];

  return (
    <ThemeProvider>
      <div className="app-container">
        <Navbar contractAddress={contractAddress} setContractAddress={setContractAddress} />
        
        <main className="main-content">
          {!isLoaded ? (
            <div className="loading-container">正在初始化应用...</div>
          ) : (
            <div className="content-wrapper">
              {/* 左侧代币列表 */}
              <div className="left-sidebar">
                <div className="empty-card"></div>
              </div>

              {/* 主内容区 */}
              <div className="main-panel">
                {/* 图表区域 */}
                <div className="chart-area">
                  <div className="chart-container-wrapper">
                    <KLineChart 
                      contractAddress={contractAddress} 
                      timeframes={timeframes}
                      selectedTimeframe={selectedTimeframe}
                      setSelectedTimeframe={setSelectedTimeframe}
                    />
                  </div>
                </div>

                {/* 交易明细区域 */}
                <div className="trade-list-area">
                  <div className="trade-header">
                    <span></span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}> ⏷</span>
                  </div>
                  <div className="trade-table-container">
                    <div className="empty-card"></div>
                  </div>
                </div>
              </div>

              {/* 右侧交易面板 */}
              <div className="right-sidebar">
                <div className="empty-card"></div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App; 