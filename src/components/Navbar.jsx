import React, { useContext, useState, useEffect, useRef } from 'react';
import { ThemeContext } from '../ThemeContext';
import axios from 'axios';

const POOLS = [
  { id: '37iWFSqgnTSAfShoBTBzQghwsTtkWAZW3yVzgJWKn6iK', name: 'gork/USD' },
  // 添加更多池子
];

// Helius API密钥
const HELIUS_API_KEY = '6b426a03-6d86-4000-9079-68e9cba00534';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Birdeye API - 使用提供的API密钥
const BIRDEYE_API_KEY = '9d54fc0d9a24492089406c1129a34e57';
const BIRDEYE_API_URL = 'https://public-api.birdeye.so/public';
const BIRDEYE_API_ENDPOINT = 'https://public-api.birdeye.so/defi/price';

// Jupiter API作为备选
const JUPITER_API_URL = 'https://price.jup.ag/v4/price';

const Navbar = ({ contractAddress, setContractAddress }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchInputRef = useRef(null);

  // 初始化从localStorage加载搜索历史
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        console.log('从localStorage加载的搜索历史:', parsedHistory);
        setSearchHistory(parsedHistory);
      } catch (e) {
        console.error('解析搜索历史失败:', e);
        localStorage.removeItem('searchHistory');
      }
    }
  }, []);

  // 保存搜索历史到localStorage
  const saveToHistory = (result) => {
    console.log('准备保存到历史记录:', result.id);
    console.log('当前历史记录:', searchHistory);
    
    // 避免重复添加相同的地址
    const exists = searchHistory.some(item => item.id === result.id);
    if (!exists) {
      // 创建一个新数组，将当前结果放在最前面
      const newHistory = [result, ...searchHistory.slice(0, 9)]; // 最多保存10条记录
      console.log('添加新记录后的历史:', newHistory);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    } else {
      // 如果已经存在，将该项移到最前面
      const newHistory = [
        result, 
        ...searchHistory.filter(item => item.id !== result.id)
      ].slice(0, 10);
      console.log('更新已有记录后的历史:', newHistory);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    }
  };

  // 处理输入变化并搜索
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    
    if (value.length > 30) { // 全长地址通常大于30个字符
      // 立即显示搜索中状态，改善用户体验
      setIsSearching(true);
      setShowDropdown(true);
      
      // 使用setTimeout确保UI更新后再执行搜索
      setTimeout(() => {
        searchToken(value);
      }, 10);
    } else if (value.length === 0) {
      // 如果搜索框为空，显示历史记录
      setSearchResults([]);
      if (searchHistory.length > 0) {
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // 处理搜索框获得焦点
  const handleInputFocus = () => {
    console.log('搜索框获得焦点，搜索文本长度:', searchText.length);
    console.log('当前历史记录数量:', searchHistory.length);
    
    if (searchText.length === 0) {
      console.log('显示历史记录下拉菜单');
      setSearchResults([]); // 清空搜索结果，确保显示历史记录
      setShowDropdown(true);
    }
  };
  
  // 搜索代币信息
  const searchToken = async (address) => {
    if (!address.trim()) return; // 删除isSearching判断，避免重复粘贴时不触发搜索
    
    setSearchError('');
    
    try {
      // 1. 使用Helius API获取代币元数据
      const assetResponse = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-token-info',
          method: 'getAsset',
          params: {
            id: address.trim(),
          },
        }),
      });

      const assetData = await assetResponse.json();
      console.log('Helius API元数据返回:', assetData);
      
      if (assetData.error) {
        throw new Error(assetData.error.message || '获取代币信息失败');
      }
      
      if (!assetData.result) {
        throw new Error('未找到代币信息');
      }
      
      const asset = assetData.result;
      console.log('解析后的代币元数据:', asset);
      
      // 2. 使用Birdeye API获取价格信息（包含流动性）
      const birdeyeResponse = await fetch(`${BIRDEYE_API_ENDPOINT}?address=${address.trim()}`, {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY
        }
      });
      
      if (!birdeyeResponse.ok) {
        throw new Error('Birdeye价格API请求失败');
      }
      
      const priceData = await birdeyeResponse.json();
      console.log('Birdeye API价格数据:', priceData);
      
      // 构建搜索结果
      const result = {
        id: address.trim(),
        name: asset.content?.metadata?.name || '未知代币',
        symbol: asset.content?.metadata?.symbol || '',
        logo: asset.content?.links?.image || '🪙',
        price: priceData.data?.value !== undefined ? `$${Number(priceData.data.value).toFixed(6)}` : '价格未知',
        change: priceData.data?.priceChange24h !== undefined ? 
          `${priceData.data.priceChange24h > 0 ? '+' : ''}${Number(priceData.data.priceChange24h).toFixed(2)}%` : 
          '--',
        liquidity: priceData.data?.liquidity !== undefined ? 
          `$${(Number(priceData.data.liquidity) / 1000000).toFixed(2)}M` : '流动性未知',
        isPositive: priceData.data?.priceChange24h > 0,
        // 额外数据
        volume24h: priceData.data?.volume24h !== undefined ? 
          `$${(Number(priceData.data.volume24h) / 1000000).toFixed(2)}M` : null,
        marketCap: priceData.data?.marketCap !== undefined ? 
          `$${(Number(priceData.data.marketCap) / 1000000).toFixed(2)}M` : null
      };
      
      console.log('最终构建的搜索结果:', result);
      setSearchResults([result]);
      setShowDropdown(true);
      setIsSearching(false);
      
      // 将搜索结果添加到历史记录
      saveToHistory(result);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchError(error.message || '搜索失败，请检查地址是否正确');
      setIsSearching(false);
      setShowDropdown(true); // 显示错误信息
    }
  };
  
  // 选择搜索结果
  const selectResult = (result) => {
    setContractAddress(result.id);
    setSearchText(''); // 清空搜索框内容
    setShowDropdown(false);
  };
  
  // 点击搜索框外部时关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-container')) {
        setShowDropdown(false);
        setSearchError(''); // 同时清除错误信息
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // 键盘快捷键
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchText.trim()) {
      e.preventDefault();
      searchToken(searchText);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="navbar-container">
      <nav className={`navbar ${theme}`}>
        <div className="navbar-brand">
          {/* <img 
            src="/logo.png" 
            alt="Logo" 
            className="navbar-logo" 
            width="30" 
            height="30" 
          /> */}
          <span style={{fontSize: '20px', fontWeight: 'bold'}}>Solana 合约地址实时监测</span>
        </div>

        <div className="search-container">
          <div className="search-box">
            <span className="search-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="输入Sol合约地址（仅只支持Sol）"
              className="search-input"
              value={searchText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              ref={searchInputRef}
              disabled={isSearching}
            />
            {searchText && (
              <button type="button" className="clear-input" onClick={() => {
                setSearchText('');
                setShowDropdown(searchHistory.length > 0);
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            )}
          </div>
          
          {/* 搜索下拉结果 */}
          {showDropdown && (
            <div className="search-dropdown">
              {isSearching ? (
                <div className="search-loading">
                  <div className="loading-spinner"></div>
                  <span>正在搜索代币信息...</span>
                </div>
              ) : searchError ? (
                <div className="search-error-message">{searchError}</div>
              ) : searchResults.length > 0 ? (
                <div className="search-results">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="search-result-item"
                      onClick={() => selectResult(result)}
                    >
                      <div className="search-result-row">
                        {typeof result.logo === 'string' && result.logo.startsWith('http') ? (
                          <img src={result.logo} alt={result.name} className="token-image" />
                        ) : (
                          <span className="token-logo">{result.logo}</span>
                        )}
                        <span className="token-name">
                          {result.symbol ? (
                            <>
                              <span className="token-symbol-primary">{result.symbol}</span>
                              <span className="token-name-secondary">{result.name}</span>
                            </>
                          ) : (
                            <>{result.name}</>
                          )}
                        </span>
                        <span className="token-price">{result.price}</span>
                        <span className={`token-change ${result.isPositive ? 'positive' : 'negative'}`}>
                          {result.change}
                        </span>
                      </div>
                      <div className="search-result-row secondary">
                        <span className="token-id">
                          {result.id.length > 20 
                            ? `${result.id.slice(0, 10)}...${result.id.slice(-6)}`
                            : result.id}
                        </span>
                        <span className="token-liquidity">流动性: {result.liquidity}</span>
                      </div>
                      {(result.volume24h || result.marketCap) && (
                        <div className="search-result-row extra">
                          {result.volume24h && (
                            <span className="token-volume">24h成交量: {result.volume24h}</span>
                          )}
                          {result.marketCap && (
                            <span className="token-marketcap">市值: {result.marketCap}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : searchText.length === 0 && searchHistory.length > 0 ? (
                <div className="search-results">
                  <div className="history-header">最近搜索记录</div>
                  {searchHistory.map((result, index) => (
                    <div 
                      key={index}
                      className="search-result-item history-item"
                      onClick={() => selectResult(result)}
                    >
                      <div className="search-result-row">
                        {typeof result.logo === 'string' && result.logo.startsWith('http') ? (
                          <img src={result.logo} alt={result.name} className="token-image" />
                        ) : (
                          <span className="token-logo">{result.logo}</span>
                        )}
                        <span className="token-name">
                          {result.symbol ? (
                            <>
                              <span className="token-symbol-primary">{result.symbol}</span>
                              <span className="token-name-secondary">{result.name}</span>
                            </>
                          ) : (
                            <>{result.name}</>
                          )}
                        </span>
                      </div>
                      <div className="search-result-row secondary">
                        <span className="token-id">
                          {result.id.length > 20 
                            ? `${result.id.slice(0, 10)}...${result.id.slice(-6)}`
                            : result.id}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div 
                    className="clear-history"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchHistory([]);
                      localStorage.removeItem('searchHistory');
                      setShowDropdown(false);
                    }}
                  >
                    清除搜索历史
                  </div>
                </div>
              ) : (
                <div className="no-results">没有找到相关结果</div>
              )}
            </div>
          )}
           
          {searchError && !showDropdown && (
            <div className="search-error">{searchError}</div>
          )}
        </div>

        <div className="navbar-actions">
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'dark' ? '🌞' : '🌙'}
          </button>
        </div>
      </nav>

      <style jsx>{`
        .navbar-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          background-color: ${theme === 'dark' ? '#121212' : '#f0f0f0'};
        }
        
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          background-color: ${theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .navbar-logo {
          border-radius: 50%;
        }
        
        .navbar-brand h1 {
          font-size: 1.2rem;
          margin: 0;
        }

        .search-container {
          position: relative;
          flex: 1;
          max-width: 600px;
          margin: 0 auto;
        }

        .search-box {
          display: flex;
          align-items: center;
          background-color: ${theme === 'dark' ? '#2a2a2a' : '#e9e9e9'};
          border-radius: 50px;
          width: 100%;
          padding: 6px 12px;
          border: 1px solid ${theme === 'dark' ? '#3a3a3a' : '#ddd'};
        }

        .search-icon {
          color: ${theme === 'dark' ? '#999' : '#666'};
          margin-right: 8px;
          line-height: 0;
        }

        .search-input {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          flex: 1;
          outline: none;
          font-size: 14px;
        }

        .search-input::placeholder {
          color: ${theme === 'dark' ? '#777' : '#999'};
        }
        
        .clear-input {
          background: none;
          border: none;
          color: ${theme === 'dark' ? '#777' : '#999'};
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          margin-right: 6px;
        }
        
        .search-error {
          color: #e74c3c;
          font-size: 12px;
          margin-top: 5px;
          text-align: center;
        }
        
        /* 搜索下拉框样式 */
        .search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 8px;
          background-color: ${theme === 'dark' ? '#1e1e1e' : '#fff'};
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          overflow: hidden;
        }
        
        .search-loading {
          padding: 16px;
          text-align: center;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid ${theme === 'dark' ? '#333' : '#eee'};
          border-top: 2px solid ${theme === 'dark' ? '#aaa' : '#666'};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .search-error-message {
          padding: 16px;
          text-align: center;
          color: #e74c3c;
          font-size: 14px;
        }
        
        .no-results {
          padding: 16px;
          text-align: center;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          font-size: 14px;
        }
        
        .search-results {
          max-height: 460px;
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .search-results::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        .history-header {
          padding: 12px 16px;
          font-size: 13px;
          color: ${theme === 'dark' ? '#999' : '#777'};
          background-color: ${theme === 'dark' ? '#252525' : '#f5f5f5'};
          border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#eee'};
        }
        
        .search-result-item {
          padding: 14px 16px;
          cursor: pointer;
          border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#eee'};
          transition: background-color 0.2s ease;
        }
        
        .search-result-item:last-child {
          border-bottom: none;
        }
        
        .search-result-item:hover {
          background-color: ${theme === 'dark' ? '#2a2a2a' : '#f5f5f5'};
        }
        
        .search-result-item.history-item {
          padding: 12px 16px;
        }
        
        .search-result-row {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .search-result-row.secondary {
          margin-bottom: 4px;
        }
        
        .search-result-row.extra {
          margin-bottom: 0;
          font-size: 12px;
          color: ${theme === 'dark' ? '#888' : '#888'};
        }
        
        .token-logo {
          margin-right: 10px;
          font-size: 22px;
        }
        
        .token-image {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          margin-right: 10px;
          object-fit: cover;
        }
        
        .token-name {
          font-weight: 500;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          font-size: 14px;
          display: flex;
          flex-direction: column;
        }
        
        .token-symbol-primary {
          font-size: 16px;
          font-weight: 600;
          color: ${theme === 'dark' ? '#fff' : '#000'};
        }
        
        .token-name-secondary {
          font-size: 13px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          margin-top: 3px;
        }
        
        .token-symbol {
          font-size: 13px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          margin-top: 3px;
        }
        
        .token-price {
          margin-left: auto;
          margin-right: 10px;
          font-weight: 500;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          font-size: 15px;
        }
        
        .token-change {
          font-weight: 500;
          font-size: 15px;
        }
        
        .token-change.positive {
          color: #4caf50;
        }
        
        .token-change.negative {
          color: #e74c3c;
        }
        
        .token-id {
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          font-size: 13px;
        }
        
        .token-liquidity {
          margin-left: auto;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          font-size: 13px;
        }
        
        .token-volume {
          margin-right: 12px;
        }
        
        .token-marketcap {
          margin-left: auto;
        }
        
        .clear-history {
          text-align: center;
          padding: 14px;
          font-size: 14px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          cursor: pointer;
          border-top: 1px solid ${theme === 'dark' ? '#333' : '#eee'};
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        
        .clear-history:hover {
          background-color: ${theme === 'dark' ? '#2a2a2a' : '#f0f0f0'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }
        
        /* 导航栏控制区域样式 */
        .navbar-controls {
          display: flex;
          align-items: center;
        }
        
        .pool-selector {
          background-color: ${theme === 'dark' ? '#2a2a2a' : '#e9e9e9'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
          border: 1px solid ${theme === 'dark' ? '#3a3a3a' : '#ddd'};
          border-radius: 4px;
          padding: 5px 8px;
          margin-right: 10px;
          outline: none;
          font-size: 14px;
        }
        
        .theme-toggle {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0.3rem;
          margin-left: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default Navbar; 