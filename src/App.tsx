import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { generateMockData, GameData } from './mockData';
import { Settings, BarChart2, CloudRain, Thermometer, Users, X, ExternalLink, Trophy } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ViewMode = 'homeTeam' | 'stadium' | 'matchup';
type SortMode = 'date' | 'audienceDesc' | 'tempDesc' | 'rainAsc' | 'winRateDesc';

export default function App() {
  const [gasUrl, setGasUrl] = useState('https://script.google.com/macros/s/AKfycbyGtfNgLdduKu5UfeSj5tVo4A3OmJQy_5s4B33BsPTpJ8z_eK0hYH01bED-UJ08mKV4/exec');
  const [rawData, setRawData] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('homeTeam');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('All');
  const [endYear, setEndYear] = useState<string>('All');
  const [selectedStadiumFilter, setSelectedStadiumFilter] = useState<string>('All');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('All');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('All');
  const [selectedCheerleader, setSelectedCheerleader] = useState<string>('All');
  const [selectedWinRateFilter, setSelectedWinRateFilter] = useState<string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [igMapping, setIgMapping] = useState<Record<string, string>>({});
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Default to system preference if we don't have a saved one
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Reset filters when view mode changes
  useEffect(() => {
    // Preserve year bounds to avoid sudden resets when flipping viewMode
    setSelectedStadiumFilter('All');
    setSelectedDayOfWeek('All');
    setSelectedThemeFilter('All');
    setSelectedCheerleader('All');
    setSelectedWinRateFilter('All');
    setSelectedOption(''); // Reset selected option to trigger auto-select
  }, [viewMode]);

  // Reset stadium filter when selected team changes
  useEffect(() => {
    setSelectedStadiumFilter('All');
    setSelectedCheerleader('All');
  }, [selectedOption]);

  // Fetch data
  useEffect(() => {
    let isMounted = true;

    const processData = (data: any, isInitial: boolean) => {
      if (!isMounted) return;
      // Extract IG mapping if the sheet exists
      const newIgMapping: Record<string, string> = {};
      const igSheetKey = Object.keys(data).find(k => {
        const normalized = k.replace(/\s/g, '').toLowerCase();
        return normalized.includes('啦啦隊ig') || normalized.includes('cheerleadersig') || normalized === 'ig';
      });
      
      if (igSheetKey) {
        const igData = Array.isArray(data[igSheetKey]) ? data[igSheetKey] : Object.values(data[igSheetKey]);
        igData.forEach((row: any) => {
          if (!row || typeof row !== 'object') return;
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.replace(/\s/g, '').toLowerCase()] = row[key];
          });
          const name = normalizedRow['名字'] || normalizedRow['name'] || normalizedRow['姓名'] || normalizedRow['啦啦隊'];
          const ig = normalizedRow['ig'] || normalizedRow['連結'] || normalizedRow['url'] || normalizedRow['ig連結'];
          if (name && ig) {
            newIgMapping[name.toString().trim().toLowerCase()] = ig.toString().trim();
          }
        });
        delete data[igSheetKey];
      }
      setIgMapping((prev) => Object.keys(newIgMapping).length > 0 ? newIgMapping : prev);

      const flatData: GameData[] = [];
      const yearKeys = Object.keys(data).filter(k => /^\d{4}$/.test(k));
      const winRateSheetNames = ['年度勝率', '球隊戰績', '勝率', '戰績'];
      const winRatesSheet = winRateSheetNames.map(name => data[name]).find(sheet => Array.isArray(sheet)) || [];
      const otherKeys = Object.keys(data).filter(k => !/^\d{4}$/.test(k) && !winRateSheetNames.includes(k));
      
      yearKeys.forEach(key => {
        if (Array.isArray(data[key])) flatData.push(...data[key]);
      });
      otherKeys.forEach(key => {
        if (Array.isArray(data[key])) flatData.push(...data[key]);
      });

      const uniqueGamesMap = new Map<string, GameData>();
      [...otherKeys, ...yearKeys].forEach(key => {
        if (Array.isArray(data[key])) {
          data[key].forEach((item: GameData) => {
            if (!item.Date || !item.GameSno) return;
            const year = item.Date.split('/')[0];
            const normSno = isNaN(Number(item.GameSno)) ? item.GameSno : Number(item.GameSno);
            const uniqueKey = `${year}-${normSno}`;
            uniqueGamesMap.set(uniqueKey, item);
          });
        }
      });
      
      const uniqueData = Array.from(uniqueGamesMap.values());
      const processedData = uniqueData.map(item => {
        const year = item.Date ? item.Date.split('/')[0] : '';
        let homeTeam = (item.HomeTeam || '').trim();
        if (homeTeam.includes('統一') && homeTeam.includes('獅')) homeTeam = '統一7-ELEVEn獅';
        if (homeTeam === '統一狮') homeTeam = '統一7-ELEVEn獅';
        if (homeTeam === 'Lamigo桃猿') homeTeam = 'Lamigo桃猿';
        if (homeTeam === '樂天桃猿') homeTeam = '樂天桃猿';
        if (homeTeam === '中信兄弟') homeTeam = '中信兄弟';
        if (homeTeam === '富邦悍將') homeTeam = '富邦悍將';
        if (homeTeam === '味全龍') homeTeam = '味全龍';
        
        let awayTeam = (item.AwayTeam || '').trim();
        if (awayTeam.includes('統一') && awayTeam.includes('獅')) awayTeam = '統一7-ELEVEn獅';
        if (awayTeam === '統一狮') awayTeam = '統一7-ELEVEn獅';
        
        let stadium = (item.Stadium || '').trim();
        
        let winRateInfo;
        if (winRatesSheet.length > 0) {
          winRateInfo = winRatesSheet.find((w: any) => {
            const wYear = String(w['年份'] || '');
            const wTeam = String(w['球隊'] || '');
            if (wYear !== year) return false;
            if (homeTeam === wTeam) return true;
            const cleanH = homeTeam.replace(/[ \-]/g, '');
            const cleanW = wTeam.replace(/[ \-]/g, '');
            return cleanH.includes(cleanW) || cleanW.includes(cleanH) ||
                   (cleanH.includes('統一') && cleanW.includes('統一')) ||
                   (cleanH.includes('味全') && cleanW.includes('味全')) ||
                   (cleanH.includes('兄弟') && cleanW.includes('兄弟')) ||
                   (cleanH.includes('樂天') && cleanW.includes('樂天')) ||
                   (cleanH.includes('富邦') && cleanW.includes('富邦')) ||
                   (cleanH.includes('台鋼') && cleanW.includes('台鋼'));
          });
        }

        return {
          ...item,
          HomeTeam: homeTeam,
          AwayTeam: awayTeam,
          Stadium: stadium,
          Audience: Number(item.Audience) || 0,
          'MaxTemp(C)': Number(item['MaxTemp(C)']) || 0,
          'Rainfall(mm)': Number(item['Rainfall(mm)']) || 0,
          'RainProb(%)': item['RainProb(%)'] !== undefined && item['RainProb(%)'] !== '' ? Number(item['RainProb(%)']) : undefined,
          Theme: item.Theme || item['主題日'] || '',
          Url: item.Url || item.URL || item['連結'] || '',
          Cheerleaders: item.Cheerleaders || item['啦啦隊'] || item['啦啦隊班表'] || '',
          WinRate: winRateInfo && winRateInfo['勝率'] ? Number(winRateInfo['勝率']) : undefined,
          Rank: winRateInfo && winRateInfo['排名'] ? Number(winRateInfo['排名']) : undefined,
        };
      });
      
      setRawData(processedData);

      if (isInitial) {
        const years = Array.from(new Set(processedData.map(d => d.Date ? d.Date.split('/')[0] : '').filter(Boolean))).sort();
        if (years.length > 0) {
          const latestYear = years[years.length - 1];
          const startIdx = Math.max(0, years.length - 3);
          setStartYear(years[startIdx]);
          setEndYear(latestYear);
        }

        const activeTeams = ['台鋼雄鷹', '中信兄弟', '味全龍', '統一7-ELEVEn獅', '樂天桃猿', '富邦悍將'];
        const allHomeTeams = new Set(processedData.map(d => d.HomeTeam).filter(Boolean));
        let defaultTeam = '';
        for (const t of activeTeams) {
          if (allHomeTeams.has(t)) {
            defaultTeam = t;
            break;
          }
        }
        if (!defaultTeam) {
          defaultTeam = Array.from(allHomeTeams).sort()[0] as string;
        }
        setSelectedOption(defaultTeam);
        setIsFirstLoad(false);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const CACHE_NAME = 'cpbl-gas-cache-v1';
      
      try {
        if (!gasUrl) {
          const mock = generateMockData();
          const flatData = Object.values(mock).flat();
          const uniqueData = Array.from(new Map(flatData.map(item => [`${item.Date}-${item.GameSno}`, item])).values());
          setRawData(uniqueData);
          setLoading(false);
        } else {
          let hasRenderedFromCache = false;
          let hasRenderedRecent = false;
          let isInitialRender = isFirstLoad;
          
          if ('caches' in window) {
            try {
              const cache = await caches.open(CACHE_NAME);
              const cachedResponse = await cache.match(gasUrl + '_all');
              if (cachedResponse) {
                const cachedData = await cachedResponse.json();
                processData(JSON.parse(JSON.stringify(cachedData)), isInitialRender);
                hasRenderedFromCache = true;
                setLoading(false);
                isInitialRender = false;
              }
            } catch (cacheErr) {}
          }

          if (!hasRenderedFromCache) {
            // Fetch recent 2 years block first for fast load
            try {
              const recentUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}mode=recent&t=${new Date().getTime()}`;
              const recentRes = await fetch(recentUrl, { cache: 'no-store' });
              if (recentRes.ok) {
                const recentData = await recentRes.json();
                if (!isMounted) return;
                processData(JSON.parse(JSON.stringify(recentData)), isInitialRender);
                setLoading(false);
                isInitialRender = false;
                hasRenderedRecent = true;
              }
            } catch (err) {
              console.warn("Failed to fetch recent data block, falling back to full fetch", err);
            }
          }

          // Fetch all data in the background
          const allUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}mode=all&t=${new Date().getTime()}`;
          fetch(allUrl, { cache: 'no-store' })
          .then(async (response) => {
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            if ('caches' in window) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(gasUrl + '_all', new Response(JSON.stringify(data)));
            }

            if (!isMounted) return;
            processData(JSON.parse(JSON.stringify(data)), isInitialRender);
            if (!hasRenderedFromCache && !hasRenderedRecent) {
              setLoading(false);
            }
          })
          .catch(err => {
            if (!isMounted) return;
            if (!hasRenderedFromCache && !hasRenderedRecent) {
              let errorMessage = '無法載入資料，請檢查網址或網路連線。';
              if (err.message === 'Failed to fetch') {
                errorMessage = '取得資料失敗 (Failed to fetch)。請確認：\n1. GAS 網址是否正確\n2. GAS 部署時「誰可以存取」是否設定為「所有人 (Anyone)」\n3. 網址是否支援跨域請求 (CORS)';
              } else if (err instanceof Error) {
                errorMessage = `錯誤: ${err.message}`;
              }
              setError(errorMessage);
              console.error(err);
              setLoading(false);
            } else {
              console.error('Background fetch failed, but partial/cached data is available:', err);
            }
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        let errorMessage = '發生未預期的錯誤。';
        if (err instanceof Error) errorMessage = `錯誤: ${err.message}`;
        setError(errorMessage);
        console.error(err);
        setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [gasUrl]);

  // Update selected option when options change and current is invalid
  useEffect(() => {
    if (rawData.length === 0) return;
    const set = new Set<string>();
    rawData.forEach(game => {
      if (viewMode === 'homeTeam' && game.HomeTeam) set.add(game.HomeTeam);
      if (viewMode === 'stadium' && game.Stadium) set.add(game.Stadium);
    });
    const sortedOptions = Array.from(set).sort();
    
    if (!sortedOptions.includes(selectedOption) && sortedOptions.length > 0) {
      if (viewMode === 'homeTeam') {
        const activeTeams = ['台鋼雄鷹', '中信兄弟', '味全龍', '統一7-ELEVEn獅', '樂天桃猿', '富邦悍將'];
        const foundActive = activeTeams.find(t => sortedOptions.includes(t));
        setSelectedOption(foundActive || sortedOptions[0]);
      } else {
        const priorityStadiums = ['臺北大巨蛋', '洲際', '新莊', '天母', '台南', '澄清湖'];
        const foundPriority = priorityStadiums.find(s => sortedOptions.includes(s));
        setSelectedOption(foundPriority || sortedOptions[0]);
      }
    }
  }, [rawData, viewMode, selectedOption]);

  const options = useMemo(() => {
    if (rawData.length === 0) return [];
    const set = new Set<string>();
    rawData.forEach(game => {
      if (viewMode === 'homeTeam' && game.HomeTeam) set.add(game.HomeTeam);
      if (viewMode === 'stadium' && game.Stadium) set.add(game.Stadium);
    });
    return Array.from(set).sort();
  }, [rawData, viewMode]);

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set(rawData.map(d => {
      if (!d.Date) return '';
      const match = String(d.Date).match(/^(\d{4})/);
      return match ? match[1] : '';
    }).filter(Boolean));
    return ['All', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [rawData]);

  // Extract available stadiums for the selected team
  const availableStadiumsForTeam = useMemo(() => {
    if (viewMode !== 'homeTeam' || !selectedOption) return ['All'];
    const stadiums = new Set(rawData.filter(d => d.HomeTeam === selectedOption).map(d => d.Stadium));
    return ['All', ...Array.from(stadiums).sort()];
  }, [rawData, viewMode, selectedOption]);

  // Extract available cheerleaders for the selected team
  const availableCheerleaders = useMemo(() => {
    if (viewMode !== 'homeTeam' || !selectedOption) return ['All'];
    const cheerleadersSet = new Set<string>();
    rawData.filter(d => d.HomeTeam === selectedOption).forEach(game => {
      if (game.Cheerleaders) {
        game.Cheerleaders.split(/[,、]/).forEach(c => {
          const name = c.trim();
          if (name) cheerleadersSet.add(name);
        });
      }
    });
    return ['All', ...Array.from(cheerleadersSet).sort()];
  }, [rawData, viewMode, selectedOption]);

  // Filter and sort data
  const chartData = useMemo(() => {
    let filtered = rawData.filter(game => {
      if (!game.Date) return false;
      
      // Filter out future games that don't have RainProb(%) and don't have Audience
      // This ensures we only show past games (with Audience) or future games with weather forecast
      if (!game.Audience && game['RainProb(%)'] === undefined) {
        return false;
      }
      
      if (viewMode !== 'matchup') {
        const matchView = viewMode === 'homeTeam' ? game.HomeTeam === selectedOption : game.Stadium === selectedOption;
        if (!matchView) return false;
      }

      const yearMatch = String(game.Date).match(/^(\d{4})/);
      const itemYear = yearMatch ? yearMatch[1] : '';
      
      let matchYear = true;
      if (startYear !== 'All' && itemYear < startYear) matchYear = false;
      if (endYear !== 'All' && itemYear > endYear) matchYear = false;
      if (!matchYear) return false;

      const matchStadium = viewMode === 'homeTeam' ? (selectedStadiumFilter === 'All' || game.Stadium === selectedStadiumFilter) : true;
      if (!matchStadium) return false;

      const dayOfWeekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const dateObj = new Date(game.Date);
      const dayStr = dayOfWeekMap[dateObj.getDay()];
      const matchDay = selectedDayOfWeek === 'All' || dayStr === selectedDayOfWeek;
      if (!matchDay) return false;

      const matchTheme = selectedThemeFilter === 'All' ? true :
                         selectedThemeFilter === 'ThemeOnly' ? !!game.Theme :
                         !game.Theme;
      if (!matchTheme) return false;

      const matchCheerleader = selectedCheerleader === 'All' || 
                               (game.Cheerleaders && game.Cheerleaders.split(/[,、]/).map(c => c.trim()).includes(selectedCheerleader));
      if (!matchCheerleader) return false;

      const matchWinRate = selectedWinRateFilter === 'All' ? true :
                           selectedWinRateFilter === '>0.5' ? (game.WinRate !== undefined && game.WinRate >= 0.5) :
                           selectedWinRateFilter === '<0.5' ? (game.WinRate !== undefined && game.WinRate < 0.5) : true;
      if (!matchWinRate) return false;

      // Filter out games with 0 audience (assuming unplayed games)
      if (game.Audience === 0) return false;

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'winRateDesc': {
          const wrA = a.WinRate !== undefined ? a.WinRate : -1;
          const wrB = b.WinRate !== undefined ? b.WinRate : -1;
          if (wrA !== wrB) return wrB - wrA; // Descending win rate
          
          // Fallback to date sorting if win rate is same or missing
          const timeDiff = new Date(a.Date).getTime() - new Date(b.Date).getTime();
          if (timeDiff === 0) {
            const snoA = isNaN(Number(a.GameSno)) ? 0 : Number(a.GameSno);
            const snoB = isNaN(Number(b.GameSno)) ? 0 : Number(b.GameSno);
            return snoA - snoB;
          }
          return timeDiff;
        }
        case 'audienceDesc':
          return b.Audience - a.Audience;
        case 'tempDesc':
          return b['MaxTemp(C)'] - a['MaxTemp(C)'];
        case 'rainAsc':
          return a['Rainfall(mm)'] - b['Rainfall(mm)'];
        case 'date':
        default: {
          const timeDiff = new Date(a.Date).getTime() - new Date(b.Date).getTime();
          if (timeDiff === 0) {
            const snoA = isNaN(Number(a.GameSno)) ? 0 : Number(a.GameSno);
            const snoB = isNaN(Number(b.GameSno)) ? 0 : Number(b.GameSno);
            return snoA - snoB;
          }
          return timeDiff;
        }
      }
    });

    return filtered;
  }, [rawData, viewMode, selectedOption, sortMode, startYear, endYear, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter, selectedCheerleader, selectedWinRateFilter]);

  const maxTemp = chartData.length > 0 ? Math.max(...chartData.map(d => d['MaxTemp(C)'])) : null;
  const maxRain = chartData.length > 0 ? Math.max(...chartData.map(d => d['Rainfall(mm)'])) : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest' as const,
      intersect: true,
      axis: 'xy' as const,
    },
    onClick: (event: any, elements: any[]) => {
      if (elements.length > 0) {
        const dataIndex = elements[0].index;
        const game = chartData[dataIndex];
        setSelectedGame(game);
      }
    },
    onHover: (event: any, elements: any[]) => {
      const target = event.native ? event.native.target : event.target;
      if (target && target.style) {
        if (elements.length > 0) {
          target.style.cursor = 'pointer';
        } else {
          target.style.cursor = 'default';
        }
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: darkMode ? '#f8fafc' : '#111827',
        bodyColor: darkMode ? '#cbd5e1' : '#4b5563',
        borderColor: darkMode ? '#475569' : '#e5e7eb',
        borderWidth: 1,
        padding: 16,
        boxPadding: 8,
        usePointStyle: true,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' as const, family: 'Inter, sans-serif' },
        bodyFont: { size: 13, family: 'Inter, sans-serif' },
        callbacks: {
          title: function(context: any) {
            return context[0].label;
          },
          label: function(context: any) {
            const dataIndex = context.dataIndex;
            const data = chartData[dataIndex];
            
            const isMaxTemp = maxTemp !== null && data['MaxTemp(C)'] === maxTemp && maxTemp > 0;
            const isMaxRain = maxRain !== null && data['Rainfall(mm)'] === maxRain && maxRain > 0;
            
            const tempLabel = isMaxTemp ? `最高氣溫：${data['MaxTemp(C)']}°C (🔥 最高)` : `最高氣溫：${data['MaxTemp(C)']}°C`;
            const rainLabel = isMaxRain ? `降雨量：${data['Rainfall(mm)']} mm (🌧️ 最高)` : `降雨量：${data['Rainfall(mm)']} mm`;

            const dayOfWeekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const dateObj = new Date(data.Date);
            const dayStr = dayOfWeekMap[dateObj.getDay()];

            const tooltipLines = [
              `日期：${data.Date} (${dayStr})`,
              `場次：${data.GameSno}`,
              data.Audience ? `人數：${data.Audience.toLocaleString()}` : `人數：尚未開打`,
              `場地：${data.Stadium}`,
              `對戰：${data.AwayTeam} vs ${data.HomeTeam}`,
              tempLabel,
              rainLabel
            ];

            if (data['RainProb(%)'] !== undefined) {
              tooltipLines.push(`降雨機率：${data['RainProb(%)']}%`);
            }

            if (data.Theme) {
              tooltipLines.splice(2, 0, `主題日：${data.Theme} ⭐`);
            }

            if (data.Cheerleaders) {
              tooltipLines.push(`啦啦隊：${data.Cheerleaders}`);
            }

            tooltipLines.push('');
            tooltipLines.push('👉 點擊圓點查看詳細資訊');

            return tooltipLines;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        border: { display: false },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: darkMode ? '#94a3b8' : '#6b7280',
          font: { family: 'Inter, sans-serif' }
        }
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: {
          color: darkMode ? '#334155' : '#f3f4f6',
          borderDash: [5, 5],
        },
        ticks: {
          color: darkMode ? '#94a3b8' : '#6b7280',
          font: { family: 'Inter, sans-serif' },
          callback: function(value: any) {
            return value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value;
          }
        }
      }
    }
  };

  const pointBackgroundColors = chartData.map(d => {
    const isMaxTemp = maxTemp !== null && d['MaxTemp(C)'] === maxTemp && maxTemp > 0;
    const isMaxRain = maxRain !== null && d['Rainfall(mm)'] === maxRain && maxRain > 0;
    if (isMaxTemp && isMaxRain) return '#a855f7'; // purple
    if (isMaxTemp) return '#ef4444'; // red
    if (isMaxRain) return '#06b6d4'; // cyan
    if (d.Theme) return '#f59e0b'; // amber for theme
    return '#3b82f6'; // default blue
  });

  const pointBorderColors = chartData.map(d => {
    if (d.Theme) return '#fef3c7'; // light amber border for theme
    return '#ffffff'; // white border for others
  });

  const isMassiveData = chartData.length > 500;

  const pointBorderWidths = chartData.map(d => d.Theme ? (isMassiveData ? 1 : 3) : (isMassiveData ? 0 : 2));

  const pointRadii = chartData.map(d => {
    const isMaxTemp = maxTemp !== null && d['MaxTemp(C)'] === maxTemp && maxTemp > 0;
    const isMaxRain = maxRain !== null && d['Rainfall(mm)'] === maxRain && maxRain > 0;
    if (d.Theme) return isMassiveData ? 3 : 8;
    return (isMaxTemp || isMaxRain) ? (isMassiveData ? 2 : 6) : (isMassiveData ? 0 : 4);
  });

  const uniqueYearsInChart = Array.from(new Set(chartData.map(d => d.Date.split('/')[0])));
  const winRatesByYear = new Map<string, number>();
  chartData.forEach(d => {
    if (d.WinRate !== undefined) {
      winRatesByYear.set(d.Date.split('/')[0], d.WinRate);
    }
  });

  // Only display the average win rate if every year present in the chart has win rate data matched
  // (e.g. if the user selects 2020-2025, it displays; if they select All, and 2014 lacks it, hide).
  const allYearsHaveWinRate = uniqueYearsInChart.length > 0 && uniqueYearsInChart.every(year => winRatesByYear.has(year));
  const avgWinRate = allYearsHaveWinRate 
    ? Array.from(winRatesByYear.values()).reduce((a, b) => a + b, 0) / winRatesByYear.size 
    : null;

  // Dynamic tension to prevent Bezier curve loops/overshoots when data points are too dense
  const getCurveTension = (dataLength: number) => {
    if (dataLength > 500) return 0; // Completely straight lines for massive datasets
    if (dataLength > 200) return 0.1;
    if (dataLength > 100) return 0.2;
    if (dataLength > 50) return 0.3;
    return 0.4;
  };
  const dynamicTension = getCurveTension(chartData.length);

  // Safely calculate responsive chart width to prevent crashing mobile browsers (iOS limits canvas to 4096px - 8192px)
  const getSafeChartWidth = () => {
    // If not many points, stick to 100% of container
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    // On mobile, if we exceed roughly 20 points, we want horizontal scroll, 
    // but we ABSOLUTELY CANNOT exceed ~4000px on older iOS or we get a broken canvas crash.
    const maxPixels = isMobile ? 4000 : 8000;
    const desiredPixels = Math.max(800, chartData.length * 30);
    
    // Check viewport width safely
    const viewportW = typeof document !== 'undefined' ? document.body.clientWidth : 800;
    
    if (desiredPixels > viewportW) {
      return `${Math.min(desiredPixels, maxPixels)}px`;
    }
    return '100%';
  };
  const safeChartWidth = getSafeChartWidth();

  const chartJsData = {
    labels: chartData.map((d, i, arr) => {
      const sameDateGames = arr.filter(game => game.Date === d.Date);
      if (sameDateGames.length > 1) {
        const index = sameDateGames.findIndex(game => game === d);
        if (sameDateGames.length === 2) {
          return d.Date + (index === 0 ? ' (午)' : ' (晚)');
        }
        return d.Date + ` (第${index + 1}場)`;
      }
      return d.Date;
    }),
    datasets: [
      {
        label: '觀眾人數',
        data: chartData.map(d => d.Audience),
        borderColor: '#3b82f6',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
          return gradient;
        },
        fill: true,
        tension: dynamicTension,
        pointStyle: 'circle',
        pointRadius: pointRadii,
        pointHoverRadius: pointRadii.map(r => r + 2),
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBorderColors,
        borderWidth: 3,
        pointBorderWidth: pointBorderWidths,
        order: 2,
      }
    ]
  };

  // If sorting by date, add a Moving Average trendline to smooth out the spikes
  if (sortMode === 'date' && chartData.length > 5) {
    const windowSpan = 7; // 7-game moving average
    const movingAverageData = chartData.map((_, i, arr) => {
      // Calculate a centered moving average if possible, otherwise skew to available data
      const start = Math.max(0, i - Math.floor(windowSpan / 2));
      const end = Math.min(arr.length, i + Math.floor(windowSpan / 2) + 1);
      const slice = arr.slice(start, end);
      return Math.round(slice.reduce((acc, curr) => acc + curr.Audience, 0) / slice.length);
    });

    chartJsData.datasets.push({
      label: '7場移動平均趨勢',
      data: movingAverageData,
      borderColor: '#94a3b8', // slate-400
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.4,
      pointStyle: 'circle',
      pointRadius: 0,
      pointHoverRadius: 0,
      pointBackgroundColor: 'transparent',
      pointBorderColor: 'transparent',
      borderWidth: 2.5,
      borderDash: [5, 5],
      pointBorderWidth: 0,
      order: 1, // Draw the trendline behind the main points if possible, or adjust
    } as any);
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className="bg-blue-700 dark:bg-slate-800 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6" />
          <h1 className="text-xl font-bold">中職票房分析</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 hover:bg-blue-600 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label="切換深色模式"
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-blue-600 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-slate-800 p-4 shadow-md border-b border-gray-200 dark:border-slate-700 animate-in slide-in-from-top-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            GAS Web App URL (留空則使用測試資料)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        {loading && rawData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
            <div className="relative flex items-center justify-center">
              {/* 背景圓環 */}
              <div className="w-20 h-20 border-4 border-blue-100 rounded-full"></div>
              {/* 旋轉動畫 */}
              <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              {/* 中心圖示 */}
              <BarChart2 className="w-8 h-8 text-blue-600 absolute animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">正在讀取最新票房資料...</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">這可能需要幾秒鐘的時間，請稍候</p>
            </div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">分析維度</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="homeTeam">各隊主場人數</option>
              <option value="stadium">各球場人數</option>
              <option value="matchup">對戰組合交叉分析</option>
            </select>
          </div>
          
          {viewMode !== 'matchup' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {viewMode === 'homeTeam' ? '選擇球隊' : '選擇球場'}
              </label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          <div className={`space-y-1 ${viewMode === 'matchup' ? 'col-span-2 md:col-span-1' : 'md:col-span-2 lg:col-span-1'}`}>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">選擇年份範圍</label>
            <div className="flex items-center gap-2">
              <select
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="flex-1 min-w-0 p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none truncate"
              >
                <option value="All">最早</option>
                {availableYears.filter(y => y !== 'All').sort().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-gray-400 font-medium shrink-0">~</span>
              <select
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                className="flex-1 min-w-0 p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none truncate"
              >
                <option value="All">最新</option>
                {availableYears.filter(y => y !== 'All').sort((a, b) => b.localeCompare(a)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {viewMode === 'homeTeam' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">選擇球場</label>
              <select
                value={selectedStadiumFilter}
                onChange={(e) => setSelectedStadiumFilter(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">全部球場</option>
                {availableStadiumsForTeam.filter(s => s !== 'All').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">選擇星期</label>
            <select
              value={selectedDayOfWeek}
              onChange={(e) => setSelectedDayOfWeek(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部星期</option>
              <option value="星期一">星期一</option>
              <option value="星期二">星期二</option>
              <option value="星期三">星期三</option>
              <option value="星期四">星期四</option>
              <option value="星期五">星期五</option>
              <option value="星期六">星期六</option>
              <option value="星期日">星期日</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">主題日篩選</label>
            <select
              value={selectedThemeFilter}
              onChange={(e) => setSelectedThemeFilter(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部場次</option>
              <option value="ThemeOnly">僅看主題日 ⭐</option>
              <option value="NormalOnly">僅看一般例行賽</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">年度勝率篩選</label>
            <select
              value={selectedWinRateFilter}
              onChange={(e) => setSelectedWinRateFilter(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部戰績</option>
              <option value=">0.5">勝率 &gt; 0.500 (A段班)</option>
              <option value="<0.5">勝率 &lt; 0.500 (B段班)</option>
            </select>
          </div>

          {viewMode === 'homeTeam' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">選擇啦啦隊</label>
              <select
                value={selectedCheerleader}
                onChange={(e) => setSelectedCheerleader(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">全部人員</option>
                {availableCheerleaders.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sorting */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortMode('date')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'date' ? 'bg-gray-800 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            依日期排序
          </button>
          <button
            onClick={() => setSortMode('audienceDesc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'audienceDesc' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" /> 人數由高到低
          </button>
          <button
            onClick={() => setSortMode('tempDesc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'tempDesc' ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Thermometer className="w-4 h-4" /> 氣溫由高到低
          </button>
          <button
            onClick={() => setSortMode('rainAsc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'rainAsc' ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <CloudRain className="w-4 h-4" /> 降雨量由低到高
          </button>
          <button
            onClick={() => setSortMode('winRateDesc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'winRateDesc' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Trophy className="w-4 h-4" /> 年度勝率由高到低
          </button>
        </div>

        {/* Chart Area */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 min-h-[400px] flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {selectedOption} - 人數趨勢
              {loading && <span className="text-sm font-normal text-gray-400 animate-pulse">載入中...</span>}
            </h2>
            
            {!loading && chartData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-nowrap gap-3 items-stretch w-full md:w-auto mt-2 md:mt-0">
                {/* 總場次 */}
                <div className="col-span-1 bg-slate-50 dark:bg-slate-900/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-0.5 tracking-wider">總場次</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-800 dark:text-slate-100 text-xl font-black">{chartData.length}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">場</span>
                  </div>
                </div>
                
                {/* 總人數 */}
                <div className="col-span-1 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-emerald-700 dark:text-emerald-400/80 text-xs font-bold mb-0.5 tracking-wider">總人數</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-emerald-700 dark:text-emerald-400 text-xl font-black">{chartData.reduce((sum, d) => sum + d.Audience, 0).toLocaleString()}</span>
                    <span className="text-emerald-700 dark:text-emerald-400/80 text-xs font-medium">人</span>
                  </div>
                </div>

                {/* 平均年度勝率 */}
                {viewMode === 'homeTeam' && (
                  <div className="col-span-1 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                    <span className="text-indigo-700 dark:text-indigo-400/80 text-xs font-bold mb-0.5 tracking-wider">平均年度勝率</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-indigo-700 dark:text-indigo-400 text-xl font-black">
                        {(() => {
                          const validWinRates = chartData.filter(d => d.WinRate !== undefined).map(d => d.WinRate as number);
                          if (validWinRates.length === 0) return '-';
                          const avg = validWinRates.reduce((sum, wr) => sum + wr, 0) / validWinRates.length;
                          return avg.toFixed(3);
                        })()}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* 場均人數 (Highlighted) */}
                <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-2 flex flex-col items-start shadow-md relative overflow-hidden transition-transform hover:-translate-y-0.5">
                  <div className="absolute left-0 top-0 w-1.5 h-full bg-amber-400"></div>
                  <span className="text-amber-800/70 dark:text-amber-500 text-xs font-bold mb-0.5 tracking-wider">場均人數</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-amber-600 dark:text-amber-400 text-3xl font-black drop-shadow-sm">{Math.round(chartData.reduce((sum, d) => sum + d.Audience, 0) / chartData.length).toLocaleString()}</span>
                    <span className="text-amber-800/70 dark:text-amber-500 text-sm font-medium">人</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {error ? (
            <div className="flex-1 flex items-center justify-center text-red-500 whitespace-pre-line text-center">
              {error}
            </div>
          ) : chartData.length === 0 && !loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 py-16">
              <div className="bg-gray-50 p-6 rounded-full mb-4">
                <BarChart2 className="w-12 h-12 text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">找不到符合的賽事資料</p>
              <p className="text-sm text-gray-400">目前設定的篩選條件太嚴格，請嘗試放寬年份、星期或主題日限制。</p>
            </div>
          ) : viewMode === 'matchup' ? (
            <div className="flex flex-col flex-1 w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4 overflow-x-auto">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">對戰組合場均人數矩陣 (Heatmap)</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex justify-end items-center gap-2">
                <span>圖例顏色深淺代表平均人數多寡（顏色越橘越多人）</span>
              </div>
              <table className="w-full text-center border-collapse text-sm min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-3 border border-gray-200 bg-slate-50 dark:bg-slate-900/50 text-slate-600 font-semibold w-24 whitespace-nowrap">
                      主場 \ 客場
                    </th>
                    {Array.from(new Set([...chartData.map(d=>d.HomeTeam), ...chartData.map(d=>d.AwayTeam)])).filter(Boolean).sort().map(team => (
                      <th key={`col-${team}`} className="p-3 border border-gray-200 bg-slate-50 dark:bg-slate-900/50 text-slate-700 font-medium">
                        {team}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(chartData.map(d=>d.HomeTeam))).filter(Boolean).sort().map(home => {
                    const allTeams = Array.from(new Set([...chartData.map(d=>d.HomeTeam), ...chartData.map(d=>d.AwayTeam)])).filter(Boolean).sort();
                    
                    let maxAvg = 1;
                    chartData.forEach(d => maxAvg = Math.max(maxAvg, d.Audience)); // Simplified max bound for coloring
                    const absoluteMaxAvg = 15000; // Cap at 15k for color scaling

                    return (
                      <tr key={`row-${home}`}>
                        <td className="p-3 border border-gray-200 bg-slate-50 dark:bg-slate-900/50 font-semibold text-slate-700 whitespace-nowrap">
                          {home} <span className="text-xs text-slate-400 font-normal">(主)</span>
                        </td>
                        {allTeams.map(away => {
                          if (home === away) {
                            return <td key={`cell-${home}-${away}`} className="p-3 border border-gray-200 bg-gray-100 dark:bg-slate-700 text-gray-300">-</td>;
                          }
                          const matchGames = chartData.filter(d => d.HomeTeam === home && d.AwayTeam === away);
                          if (matchGames.length === 0) {
                            return <td key={`cell-${home}-${away}`} className="p-3 border border-gray-200 text-gray-300">-</td>;
                          }
                          const avg = Math.round(matchGames.reduce((acc, curr) => acc + curr.Audience, 0) / matchGames.length);
                          
                          // Color mapping
                          const intensity = Math.min(1, avg / absoluteMaxAvg);
                          // From white(0) to orange(1): #fff to #f97316
                          const r = Math.round(255 - (255 - 249) * intensity);
                          const g = Math.round(255 - (255 - 115) * intensity);
                          const b = Math.round(255 - (255 - 22) * intensity);
                          const bgColor = `rgba(${r}, ${g}, ${b}, ${0.1 + intensity * 0.9})`;
                          const textColor = intensity > 0.6 ? '#fff' : '#1e293b';

                          return (
                            <td key={`cell-${home}-${away}`} className="border border-gray-200 transition-colors hover:ring-2 hover:ring-inset hover:ring-blue-500 cursor-default" style={{ backgroundColor: bgColor, color: textColor }}>
                              <div className="flex flex-col items-center justify-center p-2">
                                <span className="font-bold text-[15px]">{avg.toLocaleString()}</span>
                                <span className="text-[10px] opacity-75 mt-0.5">({matchGames.length}場)</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4 text-xs text-center text-gray-400">
                註：左側縱軸為主場球隊，上方橫軸為客場球隊。<br/>
                格子內數字為「場均觀眾數」，下方小括號表示符合條件的有效賽事總場次。
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 w-full">
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-white mr-1.5 shadow-sm"></span>一般場次</div>
                <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-[#f59e0b] border-[3px] border-[#fef3c7] mr-1.5 shadow-sm"></span>主題日</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#ef4444] border-2 border-white mr-1.5 shadow-sm"></span>最高氣溫</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#06b6d4] border-2 border-white mr-1.5 shadow-sm"></span>最高降雨量</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#a855f7] border-2 border-white mr-1.5 shadow-sm"></span>最高溫且最高降雨</div>
              </div>
              <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="relative h-[300px] md:h-[400px]" style={{ width: safeChartWidth }}>
                  <Line options={chartOptions} data={chartJsData} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Grid Area */}
        {!loading && chartData.length > 0 && viewMode !== 'matchup' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col mt-4">
            <div className="p-4 border-b border-gray-100 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">詳細數據清單</h2>
              <span className="text-xs text-gray-400 font-medium">點擊列查看完整資訊</span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 text-gray-500 dark:text-gray-400 font-semibold text-xs border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">日期</th>
                    <th className="px-4 py-3">對戰組合</th>
                    <th className="px-4 py-3">球場</th>
                    <th className="px-4 py-3 text-right">人數</th>
                    <th className="px-4 py-3 text-center">氣象</th>
                    <th className="px-4 py-3">主題日</th>
                    <th className="px-4 py-3">啦啦隊</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {([...chartData].sort((a, b) => {
                    // For the table, if sortMode is 'date', we want newest -> oldest
                    if (sortMode === 'date') {
                      const timeDiff = new Date(b.Date).getTime() - new Date(a.Date).getTime();
                      if (timeDiff === 0) {
                        const snoA = isNaN(Number(a.GameSno)) ? 0 : Number(a.GameSno);
                        const snoB = isNaN(Number(b.GameSno)) ? 0 : Number(b.GameSno);
                        return snoB - snoA;
                      }
                      return timeDiff;
                    }
                    return 0; // retain chartData ordering for other modes
                  })).map((game, idx) => {
                    const isMaxTemp = maxTemp !== null && game['MaxTemp(C)'] === maxTemp && maxTemp > 0;
                    const isMaxRain = maxRain !== null && game['Rainfall(mm)'] === maxRain && maxRain > 0;
                    return (
                      <tr key={`${game.Date}-${game.GameSno}-${idx}`} className="hover:bg-blue-50/60 dark:hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => setSelectedGame(game)}>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{game.Date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                          {game.AwayTeam} <span className="text-gray-400 font-normal mx-1 text-xs">vs</span> {game.HomeTeam}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{game.Stadium}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">{game.Audience.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isMaxTemp && <Thermometer className="w-4 h-4 text-red-500" title="最高氣溫" />}
                            {isMaxRain && <CloudRain className="w-4 h-4 text-cyan-500" title="最高降雨量" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-amber-600 dark:text-amber-400 text-xs font-medium">{game.Theme || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[150px]" title={game.Cheerleaders}>{game.Cheerleaders || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Game Details Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedGame(null)}>
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-700 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg">賽事詳細資訊</h3>
              <button 
                onClick={() => setSelectedGame(null)}
                className="p-1 hover:bg-blue-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                <div className="col-span-2 flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">日期</span>
                  <span className="font-medium text-gray-900">{selectedGame.Date}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">對戰組合</span>
                  <span className="font-medium text-gray-900">{selectedGame.AwayTeam} vs {selectedGame.HomeTeam}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">場地</span>
                  <span className="font-medium text-gray-900">{selectedGame.Stadium}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">觀眾人數</span>
                  <span className="font-medium text-blue-600">{selectedGame.Audience.toLocaleString()} 人</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">最高氣溫</span>
                  <span className="font-medium text-red-500">{selectedGame['MaxTemp(C)']}°C</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 dark:text-gray-400">降雨量</span>
                  <span className="font-medium text-cyan-600">{selectedGame['Rainfall(mm)']} mm</span>
                </div>
                
                {selectedGame['RainProb(%)'] !== undefined && (
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500 dark:text-gray-400">降雨機率</span>
                    <span className="font-medium text-blue-500">{selectedGame['RainProb(%)']}%</span>
                  </div>
                )}
                
                {selectedGame.Theme && (
                  <div className="col-span-2 flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500 dark:text-gray-400">主題日</span>
                    <span className="font-medium text-amber-500 flex items-center gap-1">
                      {selectedGame.Theme} ⭐
                    </span>
                  </div>
                )}
                
                {selectedGame.Cheerleaders && (
                  <div className="col-span-2 flex flex-col gap-2 border-b pb-3">
                    <span className="text-gray-500 dark:text-gray-400">啦啦隊班表</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedGame.Cheerleaders.split(/[,、，]/).map(c => c.trim()).filter(Boolean).map((name, idx) => {
                        const igUrl = igMapping[name.toLowerCase()];
                        if (igUrl) {
                          return (
                            <a 
                              key={idx} 
                              href={igUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 text-pink-600 hover:bg-pink-100 rounded-full text-sm font-medium transition-colors"
                            >
                              {name}
                            </a>
                          );
                        }
                        return (
                          <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* @ts-ignore */}
              {(selectedGame.Url || selectedGame.URL) && (
                <div className="pt-4">
                  <a 
                    // @ts-ignore
                    href={selectedGame.Url || selectedGame.URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full gap-2 py-3 px-4 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100 rounded-xl font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    本場賽事 CPBL 官網詳細資訊
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
