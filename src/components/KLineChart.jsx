import React, { useEffect, useRef, useContext, useState } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';
import { ThemeContext } from '../ThemeContext';

// Helius API密钥 - 请替换为你的API KEY
const HELIUS_API_KEY = '6b426a03-6d86-4000-9079-68e9cba00534'; // 替换为您的Helius API密钥
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// 获取Token元数据
const fetchTokenMetadata = async (address) => {
  if (!address) return null;
  
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-token-info',
        method: 'getAsset',
        params: {
          id: address,
        },
      }),
    });

    const data = await response.json();
    
    if (data.error || !data.result) {
      console.error('获取元数据失败:', data.error);
      return null;
    }
    
    const asset = data.result;
    return {
      name: asset.content?.metadata?.name || '未知代币',
      symbol: asset.content?.metadata?.symbol || '',
      logo: asset.content?.links?.image || '🪙'
    };
  } catch (error) {
    console.error('获取Token元数据错误:', error);
    return null;
  }
};

const KLineChart = ({ contractAddress, timeframes, selectedTimeframe, setSelectedTimeframe }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const areaSeriesRef = useRef(null);
  const timerRef = useRef(null); // 定时器引用
  const lastTimeRef = useRef(0); // 保存最后一个时间戳
  const currentContractRef = useRef(contractAddress); // 用于跟踪当前合约地址变化
  const requestIdRef = useRef(0); // 用于跟踪请求ID，防止旧的请求数据混入新的数据
  const { theme } = useContext(ThemeContext);
  const [initialLoading, setInitialLoading] = useState(true); // 初始加载状态
  const [error, setError] = useState(null);
  const [chartTitle, setChartTitle] = useState('代币持有者数量'); // 图表标题
  const [dataPoints, setDataPoints] = useState([]);  // 存储数据点
  const [lastFetchTime, setLastFetchTime] = useState(null); // 上次获取数据的时间
  const [lastHolderCount, setLastHolderCount] = useState(0); // 最新持有者数量
  const [isFetching, setIsFetching] = useState(false); // 是否正在获取数据
  const [updatingCount, setUpdatingCount] = useState(0); // 更新计数
  const [tokenMetadata, setTokenMetadata] = useState({
    name: '未知代币',
    symbol: '',
    logo: '🪙'
  });

  // 根据选定的timeframe计算刷新间隔（毫秒）
  const getRefreshIntervalFromTimeframe = (timeframe) => {
    // 从timeframe字符串中提取数值和单位
    const match = timeframe.match(/(\d+)([smh])/);
    if (!match) return 1000; // 默认1秒
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    // 根据单位转换为毫秒
    switch(unit) {
      case 's': return value * 1000; // 秒
      case 'm': return value * 60 * 1000; // 分钟
      case 'h': return value * 60 * 60 * 1000; // 小时
      default: return 1000; // 默认1秒
    }
  };

  // 当合约地址变化时，重置图表数据
  useEffect(() => {
    console.log(`合约地址变更: ${currentContractRef.current} -> ${contractAddress}`);
    
    // 如果不是首次加载，则重置数据
    if (currentContractRef.current !== contractAddress) {
      // 清空数据点
      setDataPoints([]);
      
      // 重置状态
      setInitialLoading(true);
      setError(null);
      setLastFetchTime(null);
      setLastHolderCount(0);
      setUpdatingCount(0);
      
      // 重置时间戳
      lastTimeRef.current = 0;
      
      // 增加请求ID，使旧请求的响应无效
      requestIdRef.current += 1;
      
      // 更新引用中的合约地址
      currentContractRef.current = contractAddress;

      // 设置图表标题为当前合约地址
      const shortId = contractAddress.length > 12 ? 
        `${contractAddress.substring(0, 6)}...${contractAddress.substring(contractAddress.length - 6)}` : 
        contractAddress;
      setChartTitle(`代币持有者数量 - ${shortId}`);
      
      console.log('图表数据已重置，准备加载新合约数据');
    }
  }, [contractAddress]);

  // 当合约地址变化时获取代币元数据
  useEffect(() => {
    const getTokenMetadata = async () => {
      if (contractAddress) {
        const metadata = await fetchTokenMetadata(contractAddress);
        if (metadata) {
          setTokenMetadata(metadata);
        }
      }
    };
    
    getTokenMetadata();
  }, [contractAddress]);

  // 创建和配置图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 清理旧图表实例
    const cleanupChart = () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
          chartRef.current = null;
          lineSeriesRef.current = null;
          areaSeriesRef.current = null;
        } catch (err) {
          console.error('清理图表出错:', err);
        }
      }
    };

    // 先清理一次
    cleanupChart();

    try {
      // 创建新图表
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 400, // 使用容器实际高度
        layout: {
          background: { 
            type: 'solid', 
            color: theme === 'dark' ? '#121212' : '#ffffff' 
          },
          textColor: theme === 'dark' ? '#d1d4dc' : '#333333',
        },
        grid: {
          vertLines: { color: theme === 'dark' ? '#333333' : '#e0e0e0' },
          horzLines: { color: theme === 'dark' ? '#333333' : '#e0e0e0' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true, // 显示秒
          barSpacing: 10, // 控制间距
          rightOffset: 5, // 让最新数据稍微偏右
        },
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          autoScale: true, // 自动调整比例
          borderVisible: false,
          entireTextOnly: true,
          visible: true,
          borderColor: theme === 'dark' ? '#333333' : '#e0e0e0',
          textColor: theme === 'dark' ? '#d1d4dc' : '#333333',
          ticksVisible: true,
          // 根据数据大小动态调整精度
          priceFormat: {
            type: 'custom',
            formatter: (price) => {
              // 根据价格值大小动态调整小数点精度
              if (price >= 1000) {
                // 大于1000的值不显示小数点
                return Math.floor(price).toString();
              } else if (price >= 100) {
                // 100-1000的值保留1位小数
                return price.toFixed(1);
              } else if (price >= 10) {
                // 10-100的值保留2位小数
                return price.toFixed(2);
              } else {
                // 10以下的值保留3位小数
                return price.toFixed(3);
              }
            },
            minMove: 0.001, // 允许0.001的最小变动
          },
        },
      });

      // 添加标题
      chart.applyOptions({
        watermark: {
          visible: false, // 显示水印作为标题
          fontSize: 18,
          horzAlign: 'center',
          vertAlign: 'top',
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
          text: chartTitle,
        },
      });

      // 添加面积图系列
      const areaSeries = chart.addAreaSeries({
        topColor: theme === 'dark' ? 'rgba(38, 166, 154, 0.56)' : 'rgba(38, 166, 154, 0.56)',
        bottomColor: theme === 'dark' ? 'rgba(38, 166, 154, 0.04)' : 'rgba(38, 166, 154, 0.04)',
        lineColor: theme === 'dark' ? 'rgba(38, 166, 154, 1)' : 'rgba(38, 166, 154, 1)',
        lineWidth: 2,
        lastValueVisible: true, // 显示最新值
        priceLineVisible: true, // 显示价格线
      });

      // 添加线图系列
      const lineSeries = chart.addLineSeries({
        color: theme === 'dark' ? '#4caf50' : '#26a69a',
        lineWidth: 2,
        lastValueVisible: false, // 不重复显示最新值
      });

      chartRef.current = chart;
      areaSeriesRef.current = areaSeries;
      lineSeriesRef.current = lineSeries;

      // 设置自适应大小
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 400 // 更新高度以适应容器
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        cleanupChart();
      };
    } catch (err) {
      console.error('创建图表失败:', err);
      setError('图表初始化失败');
      setInitialLoading(false);
    }
  }, [theme, chartTitle]);

  // 更新图表数据
  useEffect(() => {
    if (!chartRef.current || !areaSeriesRef.current || !lineSeriesRef.current) {
      return;
    }

    try {
      if (dataPoints.length > 0) {
        // 确保数据点是唯一的且按时间升序排序
        const uniqueDataPoints = [];
        const timeMap = new Map();
        
        // 去除重复时间点
        dataPoints.forEach(point => {
          if (!timeMap.has(point.time)) {
            timeMap.set(point.time, point);
            uniqueDataPoints.push(point);
          }
        });
        
        // 按时间排序
        uniqueDataPoints.sort((a, b) => a.time - b.time);
        
        console.log(`处理后的数据点: ${uniqueDataPoints.length} 个，原始数据点: ${dataPoints.length} 个`);
        
        // 确保正在显示当前合约的数据
        if (currentContractRef.current === contractAddress) {
          // 更新图表数据
          areaSeriesRef.current.setData(uniqueDataPoints);
          lineSeriesRef.current.setData(uniqueDataPoints);
          
          // 滚动到最右侧显示最新数据
          chartRef.current.timeScale().scrollToRealTime();
          
          // 更新最后使用的时间戳
          if (uniqueDataPoints.length > 0) {
            lastTimeRef.current = uniqueDataPoints[uniqueDataPoints.length - 1].time;
          }
          
          // 初始数据加载完成
          if (initialLoading && uniqueDataPoints.length > 0) {
            setInitialLoading(false);
            setError(null);
          }
        }
      }
    } catch (err) {
      console.error('更新图表数据失败:', err);
      console.error('错误详情:', err.message, err.stack);
    }
  }, [dataPoints, initialLoading, contractAddress]);

  // 确保时间戳唯一且递增
  const getUniqueTimestamp = () => {
    const currentTime = Math.floor(Date.now() / 1000);
    // 确保新时间戳总是比上一个大
    const newTime = Math.max(currentTime, lastTimeRef.current + 1);
    lastTimeRef.current = newTime;
    return newTime;
  };

  // 使用Helius API获取所有代币持有者 - 带分页功能
  const fetchAllTokenHolders = async (currentRequestId) => {
    try {
      // 验证当前请求是否仍然有效
      if (currentRequestId !== requestIdRef.current || currentContractRef.current !== contractAddress) {
        console.log(`请求已过期，当前合约已变更。请求ID: ${currentRequestId}, 当前有效ID: ${requestIdRef.current}`);
        // 不抛出异常，而是直接返回空数组
        return [];
      }
      
      let allTokenAccounts = [];
      let page = 1;
      let hasMore = true;
      
      console.log(`开始获取合约 ${contractAddress} 的所有代币持有者...`);
      
      while (hasMore) {
        // 每次分页前再次检查请求是否仍然有效
        if (currentRequestId !== requestIdRef.current || currentContractRef.current !== contractAddress) {
          console.log(`分页请求已过期，当前合约已变更。请求ID: ${currentRequestId}, 当前有效ID: ${requestIdRef.current}`);
          // 不抛出异常，而是返回已获取的数据
          return allTokenAccounts;
        }
        
        console.log(`获取第 ${page} 页代币持有者数据...`);
        
        const response = await fetch(HELIUS_RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getTokenAccounts',
            id: 'helius-holders',
            params: {
              page: page,
              limit: 1000, // 每页1000条，这是API的最大限制
              mint: contractAddress,  // 代币地址
            },
          }),
        });

        // 请求完成后再次检查请求是否仍然有效
        if (currentRequestId !== requestIdRef.current || currentContractRef.current !== contractAddress) {
          console.log(`请求响应已过期，当前合约已变更。请求ID: ${currentRequestId}, 当前有效ID: ${requestIdRef.current}`);
          // 不抛出异常，而是返回已获取的数据
          return allTokenAccounts;
        }

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`API错误: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        if (!data.result || !data.result.token_accounts || data.result.token_accounts.length === 0) {
          console.log(`第 ${page} 页没有更多数据，分页结束`);
          hasMore = false;
          break;
        }
        
        // 添加本页的代币账户到结果中
        allTokenAccounts = [...allTokenAccounts, ...data.result.token_accounts];
        console.log(`已获取 ${allTokenAccounts.length} 个代币账户`);
        
        // 检查是否还有更多页
        if (data.result.token_accounts.length < 1000) {
          console.log('数据获取完毕，没有更多页');
          hasMore = false;
        } else {
          page++;
        }
      }
      
      console.log(`共获取到 ${allTokenAccounts.length} 个代币账户`);
      return allTokenAccounts;
      
    } catch (error) {
      console.error('获取所有代币持有者数据失败:', error);
      // 如果是因为合约变更，返回空数组而不是抛出异常
      if (error.message && error.message.includes('当前合约已变更')) {
        console.log('由于合约变更导致的错误，返回空数据');
        return [];
      }
      // 其他错误继续抛出
      throw error;
    }
  };

  // 生成历史持有者数据 - 因为Helius不提供历史数据，我们需要持续记录
  const generateHistoricalData = (currentCount) => {
    const timestamp = getUniqueTimestamp();
    return {
      time: timestamp,
      value: currentCount
    };
  };

  // 定义核心的数据获取函数在useEffect外部，使其可以被多个useEffect共享
  const fetchHoldersCount = async () => {
    // 如果已经在获取数据中，跳过这次请求
    if (isFetching) {
      console.log('上一次请求尚未完成，跳过本次更新');
      return;
    }
    
    // 确保是当前合约
    if (contractAddress !== currentContractRef.current) {
      console.log('合约地址已变更，跳过数据获取');
      return;
    }
    
    // 获取当前请求的ID，用于后续验证请求是否仍然有效
    const currentRequestId = requestIdRef.current;
    
    setIsFetching(true);
    setUpdatingCount(prev => prev + 1); // 增加更新计数

    try {
      // 在这里再次检查，以防状态更新期间合约发生变化
      if (currentRequestId !== requestIdRef.current || contractAddress !== currentContractRef.current) {
        console.log('合约地址已在准备请求时变更，取消当前数据获取');
        setIsFetching(false); // 重要：确保在提前返回前重置状态
        return;
      }
      
      // 获取所有代币账户列表
      const tokenAccounts = await fetchAllTokenHolders(currentRequestId);
      
      // 可能返回空数组（如果合约已变更）
      if (!tokenAccounts || tokenAccounts.length === 0) {
        console.log('未获取到代币账户数据或数据已过期');
        setIsFetching(false); // 重要：确保在提前返回前重置状态
        return;
      }
      
      // 在处理返回数据前再次检查请求是否仍然有效
      if (currentRequestId !== requestIdRef.current || contractAddress !== currentContractRef.current) {
        console.log('合约地址已在处理返回数据时变更，取消数据处理');
        setIsFetching(false); // 重要：确保在提前返回前重置状态
        return;
      }
      
      // 生成唯一的持有者集合（因为一个用户可能有多个token账户）
      const uniqueOwners = new Set();
      tokenAccounts.forEach(account => {
        // 检查账户余额，筛选掉零余额账户
        if (account.amount > 0) {
          uniqueOwners.add(account.owner);
        }
      });
      
      // 持有者数量就是唯一所有者的数量
      const holdersCount = uniqueOwners.size;
      console.log('唯一持有者数量:', holdersCount);
      
      // 最后一次检查请求是否仍然有效
      if (currentRequestId !== requestIdRef.current || contractAddress !== currentContractRef.current) {
        console.log('合约地址已在最终处理时变更，取消数据更新');
        setIsFetching(false); // 重要：确保在提前返回前重置状态
        return;
      }
      
      // 更新最新持有者数量
      setLastHolderCount(holdersCount);
      
      // 生成新的数据点
      const newDataPoint = generateHistoricalData(holdersCount);
      
      // 更新图表数据 - 添加新点
      setDataPoints(prevPoints => {
        // 最后一次检查请求是否仍然有效
        if (currentRequestId !== requestIdRef.current || contractAddress !== currentContractRef.current) {
          console.log('合约地址已在更新数据点时变更，保持原数据不变');
          return prevPoints;
        }
        
        const maxPoints = 2000; // 最多保留2000个点
        const newPoints = [...prevPoints, newDataPoint];
        
        if (newPoints.length > maxPoints) {
          return newPoints.slice(newPoints.length - maxPoints);
        }
        
        return newPoints;
      });
      
      // 清除错误状态
      setError(null);
      
      // 更新最后获取时间
      setLastFetchTime(new Date());
    } catch (error) {
      console.error('获取代币持有者数量失败:', error);
      
      // 确保错误消息仅在当前合约仍然有效时显示
      if (currentRequestId === requestIdRef.current && contractAddress === currentContractRef.current) {
        setError('获取代币持有者数据失败');
        
        // 如果有之前的数据，使用上次的数值继续生成数据点
        if (lastHolderCount > 0) {
          const newDataPoint = generateHistoricalData(lastHolderCount);
          
          setDataPoints(prevPoints => {
            const maxPoints = 2000;
            const newPoints = [...prevPoints, newDataPoint];
            
            if (newPoints.length > maxPoints) {
              return newPoints.slice(newPoints.length - maxPoints);
            }
            
            return newPoints;
          });
        }
      }
    } finally {
      // 只有当请求ID仍然有效时才重置fetching状态
      if (currentRequestId === requestIdRef.current) {
        setIsFetching(false);
        
        // 在设置新定时器前清除可能存在的定时器
        if (timerRef.current) {
          console.log('清除已存在的定时器，准备设置新定时器');
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        
        // 在请求完成后，安排下一次请求
        const currentInterval = getRefreshIntervalFromTimeframe(selectedTimeframe);
        console.log(`安排下一次请求，间隔: ${currentInterval}ms，当前时间框架: ${selectedTimeframe}`);
        timerRef.current = setTimeout(fetchHoldersCount, currentInterval);
      }
    }
  };

  // 初始获取持有者数据并设置定时更新
  useEffect(() => {
    // 如果图表未初始化或没有代币ID，返回
    if (!chartRef.current || !areaSeriesRef.current || !lineSeriesRef.current || !contractAddress) {
      return;
    }

    // 清理之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 获取代币持有者数量
    fetchHoldersCount();
    
    // 组件卸载时清理定时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [contractAddress]); // 只在合约地址变化时触发
  
  // 当时间框架变化时重置定时器
  useEffect(() => {
    console.log(`时间框架变更为: ${selectedTimeframe}, 重新计算刷新间隔`);
    
    // 无论如何，首先清理之前的定时器
    if (timerRef.current) {
      console.log(`清理现有定时器`);
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 如果正在初始加载或未初始化，则不创建新定时器
    if (initialLoading || !chartRef.current || !contractAddress) {
      console.log(`初始加载中或图表未初始化，不设置新定时器`);
      return;
    }
    
    // 增加请求ID，确保任何旧请求响应都会被忽略
    requestIdRef.current += 1;
    console.log(`时间框架变更，立即发起新请求，请求ID: ${requestIdRef.current}`);
    
    // 直接调用外部定义的fetchHoldersCount函数
    fetchHoldersCount();
    
    return () => {
      if (timerRef.current) {
        console.log(`清理useEffect卸载时的定时器`);
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [selectedTimeframe]);

  return (
    <div className="chart-container-wrapper">
      {/* 顶部信息栏 - 复制搜索结果样式 */}
      <div className="token-info-header">
        <div className="search-result-row">
          {/* 与搜索结果相同的布局：左边是代币图标和名称 */}
          {typeof tokenMetadata.logo === 'string' && tokenMetadata.logo.startsWith('http') ? (
            <img src={tokenMetadata.logo} alt={tokenMetadata.name} className="token-image" />
          ) : (
            <span className="token-logo">{tokenMetadata.logo}</span>
          )}
          <span className="token-name">
            {tokenMetadata.symbol ? (
              <>
                <span className="token-symbol-primary">{tokenMetadata.symbol}</span>
                <span className="token-name-secondary">{tokenMetadata.name || '未知代币'}</span>
              </>
            ) : (
              <span className="token-symbol-primary">{tokenMetadata.name || '未知代币'}</span>
            )}
          </span>
          
          <span className="contract-address">
            {contractAddress && `(${contractAddress.substring(0, 6)}...${contractAddress.substring(contractAddress.length - 6)})`}
            <button 
              className="copy-button"
              onClick={(event) => {
                navigator.clipboard.writeText(contractAddress)
                  .then(() => {
                    const button = event.target;
                    const originalText = button.textContent;
                    button.textContent = "✓";
                    button.classList.add("copied");
                    setTimeout(() => {
                      button.textContent = originalText;
                      button.classList.remove("copied");
                    }, 1500);
                  })
                  .catch(err => {
                    console.error('无法复制地址: ', err);
                  });
              }}
              title="复制合约地址"
            >
              📋
            </button>
          </span>
          
          {/* 右侧显示持有人数 */}
          <span className="token-price">持有：{lastHolderCount || '---'} 人</span>
          {/* <span className="token-change positive">
            人
          </span> */}
        </div>
      </div>

      {/* 时间选择器工具栏 - 放在信息栏下方 */}
      <div className="chart-toolbar">
        <div className="time-selector">
          {timeframes && timeframes.map(time => (
            <button 
              key={time}
              className={selectedTimeframe === time ? 'active' : ''}
              onClick={() => setSelectedTimeframe(time)}
            >
              {time}
            </button>
          ))}
        </div>
        <div className="chart-toolbar-right">
          
        </div>
      </div>

      {/* 状态信息栏 */}
      <div className="chart-status">
        <span className={`status-indicator ${isFetching ? "active" : ""}`}></span>
        
        <span className="last-update-time">
          请求次数: {updatingCount}
        </span>
      </div>

      <div className="chart-container" ref={chartContainerRef}>
        {initialLoading && (
          <div className="chart-loading">
            初次加载代币持有者数据中...
          </div>
        )}
        {error && !initialLoading && (
          <div className="chart-error">
            {error}
          </div>
        )}
      </div>
      <style jsx>{`
        .chart-container-wrapper {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        /* 顶部信息栏样式 - 复制搜索结果样式 */
        .token-info-header {
          padding: 12px 16px;
          border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#eee'};
          background-color: ${theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
        }

        .search-result-row {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        
        .token-logo {
          margin-right: 8px;
          font-size: 20px;
          align-self: center;
        }
        
        .token-image {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin-right: 8px;
          object-fit: cover;
        }
        
        .token-name {
          font-weight: 500;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          font-size: 14px;
          display: flex;
          flex-direction: column;
          margin-right: 8px;
        }
        
        .token-symbol-primary {
          font-size: 16px;
          font-weight: 600;
          color: ${theme === 'dark' ? '#fff' : '#000'};
        }
        
        .token-name-secondary {
          font-size: 12px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          margin-top: 2px;
        }
        
        .contract-address {
          font-size: 12px;
          color: ${theme === 'dark' ? '#888' : '#777'};
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          margin-left: 32px;
          margin-top: auto;
          align-self: flex-end;
        }
        
        .copy-button {
          background: none;
          border: none;
          cursor: pointer;
          margin-left: 2px;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 12px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          transition: all 0.2s ease;
        }
        
        .copy-button:hover {
          background-color: ${theme === 'dark' ? '#333' : '#eee'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }
        
        .copy-button.copied {
          color: #4caf50;
          font-weight: bold;
        }
        
        .token-price {
          margin-left: auto;
          margin-right: 10px;
          font-weight: 500;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          display: flex;
          align-items: center;
          align-self: center;
        }
        
        .token-change {
          font-weight: 500;
        }
        
        .token-change.positive {
          color: #4caf50;
        }
        
        .token-change.negative {
          color: #e74c3c;
        }
        
        /* 原有样式 */
        .chart-status {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
          padding: 4px 8px;
          font-size: 14px;
          color: ${theme === 'dark' ? '#d1d4dc' : '#333333'};
          height: 19px;
        }
        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #666;
          margin-right: 8px;
        }
        .status-indicator.active {
          background-color: #4caf50;
          box-shadow: 0 0 5px #4caf50;
          animation: pulse 2s infinite;
        }
        .last-update-time {
          margin-left: auto;
          font-size: 12px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .chart-container {
          position: relative;
          flex: 1;
          min-height: 0; /* 防止flex子项溢出 */
        }
        .chart-loading, .chart-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: ${theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'};
          padding: 8px 16px;
          border-radius: 4px;
          z-index: 10;
        }

        /* 时间选择器工具栏样式 */
        .chart-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 15px;
          background-color: ${theme === 'dark' ? '#151515' : '#f0f0f0'};
          border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'};
          height: 40px;
          min-height: 40px;
        }

        .time-selector {
          display: flex;
          gap: 5px;
        }

        .time-selector button {
          background: transparent;
          border: none;
          padding: 3px 10px;
          color: ${theme === 'dark' ? '#aaa' : '#666'};
          font-size: 0.85rem;
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s ease;
        }

        .time-selector button:hover {
          background-color: ${theme === 'dark' ? '#333' : '#e0e0e0'};
        }

        .time-selector button.active {
          background-color: ${theme === 'dark' ? '#4caf50' : '#4caf50'};
          color: white;
          font-weight: 500;
        }
        
        .chart-toolbar-right {
          display: flex;
          gap: 8px;
        }
        
        .chart-control-button {
          background: transparent;
          border: none;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .chart-control-button:hover {
          background-color: ${theme === 'dark' ? '#333' : '#e0e0e0'};
        }
      `}</style>
    </div>
  );
};

export default KLineChart;