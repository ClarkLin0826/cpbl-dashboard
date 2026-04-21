import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Settings, BarChart2, CloudRain, Thermometer, Users, X, ExternalLink, Trophy, Calendar, RefreshCw, Filter, Share2, Check, TrendingUp, TrendingDown, Camera } from 'lucide-react';
import { toBlob } from 'html-to-image';

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

type ViewMode = 'homeTeam' | 'stadium' | 'matchup' | 'cheerleaderWinRate';
type SortMode = 'date' | 'audienceDesc' | 'tempDesc' | 'rainAsc' | 'winRateDesc';

export default function App() {
  const searchParams = new URL(window.location.href).searchParams;
  
  const [gasUrl, setGasUrl] = useState('https://script.google.com/macros/s/AKfycbyGtfNgLdduKu5UfeSj5tVo4A3OmJQy_5s4B33BsPTpJ8z_eK0hYH01bED-UJ08mKV4/exec');
  const [rawData, setRawData] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>((searchParams.get('v') as ViewMode) || 'homeTeam');
  const [selectedOption, setSelectedOption] = useState<string>(searchParams.get('team') || '');
  const [startYear, setStartYear] = useState<string>(searchParams.get('sy') || 'All');
  const [endYear, setEndYear] = useState<string>(searchParams.get('ey') || 'All');
  const [selectedStadiumFilter, setSelectedStadiumFilter] = useState<string>(searchParams.get('stad') || 'All');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>(searchParams.get('day') || 'All');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>(searchParams.get('theme') || 'All');
  const [selectedCheerleader, setSelectedCheerleader] = useState<string>(searchParams.get('cheer') || 'All');
  const [selectedGameResult, setSelectedGameResult] = useState<string>(searchParams.get('res') || 'All');
  const [showNextWeek, setShowNextWeek] = useState(searchParams.get('nw') === 'true');
  const [sortMode, setSortMode] = useState<SortMode>((searchParams.get('sort') as SortMode) || 'date');
  
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [igMapping, setIgMapping] = useState<Record<string, string>>({});
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chartType, setChartType] = useState<'trend' | 'yoy'>('trend');
  const [toastContent, setToastContent] = useState<{title: string, message: string, urlText?: string} | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Sync PWA theme colors to match the header exactly to prevent Android white line glitches
  useEffect(() => {
    // dynamically manage theme-color meta tag
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    
    // Clear inline styles that caused the blue line bug
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';

    if (darkMode) {
      document.documentElement.classList.add('dark');
      metaTheme.setAttribute('content', '#1e293b'); // Matches header dark:bg-slate-800
    } else {
      document.documentElement.classList.remove('dark');
      metaTheme.setAttribute('content', '#1d4ed8'); // Matches header bg-blue-700
    }
  }, [darkMode]);

  // Rotate loading text
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading && rawData.length === 0) {
      interval = setInterval(() => {
        setLoadingTextIndex(prev => (prev + 1) % 2);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading, rawData.length]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleOptionChange = (newValue: string) => {
    setSelectedOption(newValue);
    setIsFirstLoad(false);

    // 不要對「各球場」套用自動選擇年份
    if (viewMode !== 'stadium') {
      if (newValue === 'All') {
        setStartYear('All');
        setEndYear('All');
      } else {
        let activeGames: GameData[] = [];
        if (viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') {
          activeGames = rawData.filter(d => d.HomeTeam === newValue || d.AwayTeam === newValue);
        }
        
        if (activeGames.length > 0) {
          // Collect all valid years (e.g., '2004' from '2004/05/11')
          const years = activeGames
            .map(d => parseInt(d.Date ? d.Date.substring(0, 4) : '0', 10))
            .filter(y => y > 0 && !isNaN(y));
            
          if (years.length > 0) {
            const minYear = Math.min(...years).toString();
            const maxYear = Math.max(...years).toString();
            
            setStartYear(minYear);
            setEndYear(maxYear);
          }
        }
      }
    }
  };

  // Sync state to URL
  useEffect(() => {
    if (isFirstLoad) return;
    const params = new URLSearchParams();
    if (viewMode !== 'homeTeam') params.set('v', viewMode);
    if (selectedOption) params.set('team', selectedOption);
    if (startYear !== 'All') params.set('sy', startYear);
    if (endYear !== 'All') params.set('ey', endYear);
    if (selectedStadiumFilter !== 'All') params.set('stad', selectedStadiumFilter);
    if (selectedDayOfWeek !== 'All') params.set('day', selectedDayOfWeek);
    if (selectedThemeFilter !== 'All') params.set('theme', selectedThemeFilter);
    if (selectedCheerleader !== 'All') params.set('cheer', selectedCheerleader);
    if (selectedGameResult !== 'All') params.set('res', selectedGameResult);
    if (showNextWeek) params.set('nw', 'true');
    if (sortMode !== 'date') params.set('sort', sortMode);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [viewMode, selectedOption, startYear, endYear, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter, selectedCheerleader, selectedGameResult, showNextWeek, sortMode, isFirstLoad]);

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
    setSelectedGameResult('All');
    setSelectedOption(''); // Reset selected option to trigger auto-select
    if (viewMode === 'matchup' || viewMode === 'cheerleaderWinRate') {
      setShowNextWeek(false);
    }
  }, [viewMode]);

  // Reset stadium filter when selected team changes
  useEffect(() => {
    setSelectedStadiumFilter('All');
    setSelectedCheerleader('All');
  }, [selectedOption]);

  const processData = useCallback((data: any, isInitial: boolean, isMountedObj = { current: true }) => {
    if (!isMountedObj.current) return;
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
          
          // Basic normalization beforehand for the matchup view specifically
          let homeTeam = item.HomeTeam || item['主場'];
          let awayTeam = item.AwayTeam || item['客場'];
          let stadium = item.Stadium || item['球場'];
          const rawMatch = item.Matchup || item['對戰組合'] || '';
          
          if (rawMatch && (!homeTeam || !awayTeam || !stadium)) {
            const matchResult = rawMatch.match(/^(.+?)\s+v\.s\.\s+(.+?)\s+@(.+)$/);
            if (matchResult) {
              if (!awayTeam) awayTeam = matchResult[1].trim();
              if (!homeTeam) homeTeam = matchResult[2].trim();
              if (!stadium) stadium = matchResult[3].trim();
            }
          }
          
          uniqueGamesMap.set(uniqueKey, {
            ...item,
            HomeTeam: homeTeam || item.HomeTeam,
            AwayTeam: awayTeam || item.AwayTeam,
            Stadium: stadium || item.Stadium
          });
        });
      }
    });
    
    const uniqueData = Array.from(uniqueGamesMap.values());
    const processedData = uniqueData.map(item => {
      let homeTeam = (item.HomeTeam || '').trim();
      if (homeTeam.includes('統一') && homeTeam.includes('獅')) homeTeam = '統一7-ELEVEn獅';
      if (homeTeam === '統一狮') homeTeam = '統一7-ELEVEn獅';
      
      let awayTeam = (item.AwayTeam || '').trim();
      if (awayTeam.includes('統一') && awayTeam.includes('獅')) awayTeam = '統一7-ELEVEn獅';
      if (awayTeam === '統一狮') awayTeam = '統一7-ELEVEn獅';
      
      let stadium = (item.Stadium || '').trim();
      
      // Parse scores and result
      let awayScore = (item as any).AwayScore !== undefined && (item as any).AwayScore !== '' ? Number((item as any).AwayScore) : undefined;
      let homeScore = (item as any).HomeScore !== undefined && (item as any).HomeScore !== '' ? Number((item as any).HomeScore) : undefined;
      let homeResult = (item as any).HomeResult || (item as any)['主場結果'] || '';

      // Auto-calculate HomeResult if not explicitly provided but scores are available
      if (!homeResult && awayScore !== undefined && homeScore !== undefined) {
         if (homeScore > awayScore) homeResult = '勝';
         else if (homeScore < awayScore) homeResult = '敗';
         else homeResult = '和';
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
        AwayScore: awayScore,
        HomeScore: homeScore,
        HomeResult: homeResult,
      };
    });
    
    setRawData(processedData);

    if (isInitial) {
      const currentSearchParams = new URLSearchParams(window.location.search);
      let defaultStartYear = currentSearchParams.get('sy') || 'All';
      let defaultEndYear = currentSearchParams.get('ey') || 'All';

      const years = Array.from(new Set(processedData.map(d => d.Date ? d.Date.split('/')[0] : '').filter(Boolean))).sort();
      if (years.length > 0) {
        const latestYear = years[years.length - 1];
        const startIdx = Math.max(0, years.length - 3);
        
        if (defaultStartYear === 'All' && !currentSearchParams.has('sy')) defaultStartYear = years[startIdx];
        if (defaultEndYear === 'All' && !currentSearchParams.has('ey')) defaultEndYear = latestYear;
        
        setStartYear(defaultStartYear);
        setEndYear(defaultEndYear);
      }

      const activeTeams = ['台鋼雄鷹', '中信兄弟', '味全龍', '統一7-ELEVEn獅', '樂天桃猿', '富邦悍將'];
      const allHomeTeams = new Set(processedData.map(d => d.HomeTeam).filter(Boolean));
      let defaultTeam = currentSearchParams.get('team') || '';
      
      if (!defaultTeam) {
        for (const t of activeTeams) {
          if (allHomeTeams.has(t)) {
            defaultTeam = t;
            break;
          }
        }
        if (!defaultTeam) {
          defaultTeam = Array.from(allHomeTeams).sort()[0] as string;
        }
      }
      setSelectedOption(defaultTeam);
      setIsFirstLoad(false);
    }
    setLastUpdated(new Date());
  }, []); // Remove searchParams to prevent unnecessary re-evaluation the processData logic

  // Fetch data
  useEffect(() => {
    let isMounted = true;
    const isMountedObj = { current: true };

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
          // Capture isFirstLoad solely at mount evaluation time
          let isInitialRender = isFirstLoad;
          
          if ('caches' in window) {
            try {
              const cache = await caches.open(CACHE_NAME);
              const cachedResponse = await cache.match(gasUrl + '_all');
              if (cachedResponse) {
                const cachedData = await cachedResponse.json();
                processData(JSON.parse(JSON.stringify(cachedData)), isInitialRender, isMountedObj);
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
                if (!isMountedObj.current) return;
                processData(JSON.parse(JSON.stringify(recentData)), isInitialRender, isMountedObj);
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

            if (!isMountedObj.current) return;
            processData(JSON.parse(JSON.stringify(data)), isInitialRender, isMountedObj);
            if (!hasRenderedFromCache && !hasRenderedRecent) {
              setLoading(false);
            }
          })
          .catch(err => {
            if (!isMountedObj.current) return;
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
              console.warn('Background update fetch failed, but partial/cached data is available:', err.message);
            }
          });
        }
      } catch (err: any) {
        if (!isMountedObj.current) return;
        let errorMessage = '發生未預期的錯誤。';
        if (err instanceof Error) errorMessage = `錯誤: ${err.message}`;
        setError(errorMessage);
        console.error(err);
        setLoading(false);
      }
    };

    fetchData();
    return () => { 
      isMounted = false; 
      isMountedObj.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasUrl]); // strictly limiting to gasUrl to prevent loop with isFirstLoad escaping or useCallback changes

  // Update selected option when options change and current is invalid
  useEffect(() => {
    if (rawData.length === 0) return;
    const set = new Set<string>();
    rawData.forEach(game => {
      if ((viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') && game.HomeTeam) set.add(game.HomeTeam);
      if (viewMode === 'stadium' && game.Stadium) set.add(game.Stadium);
    });
    const sortedOptions = Array.from(set).sort();
    
    if (!sortedOptions.includes(selectedOption) && sortedOptions.length > 0) {
      if (viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') {
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
      if ((viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') && game.HomeTeam) set.add(game.HomeTeam);
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
    if (viewMode === 'stadium') return ['All']; // If we are primarily selecting a stadium, the stadium combobox doesn't need to show everything twice
    if ((viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') && !selectedOption) return ['All'];
    
    const stadiums = new Set<string>();
    
    rawData.forEach(game => {
      if ((viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') && game.HomeTeam !== selectedOption) return;
      if (!game.Date) return;
      
      const gameDate = new Date(game.Date);
      if (showNextWeek) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(23, 59, 59, 999);
        if (gameDate < today || gameDate > nextWeek) return;
      } else {
        if (!game.Audience && game['RainProb(%)'] === undefined) return;
        const yearMatch = String(game.Date).match(/^(\d{4})/);
        const itemYear = yearMatch ? yearMatch[1] : '';
        if (startYear !== 'All' && itemYear < startYear) return;
        if (endYear !== 'All' && itemYear > endYear) return;
        if (game.Audience === 0) return;
      }
      
      if (game.Stadium) stadiums.add(game.Stadium);
    });
    
    return ['All', ...Array.from(stadiums).sort()];
  }, [rawData, viewMode, selectedOption, startYear, endYear, showNextWeek]);

  // Extract available cheerleaders for the selected team
  const availableCheerleaders = useMemo(() => {
    if (viewMode !== 'homeTeam' || !selectedOption) return ['All'];
    const cheerleadersSet = new Set<string>();
    
    rawData.forEach(game => {
      if (game.HomeTeam !== selectedOption) return;
      if (!game.Date) return;
      
      const gameDate = new Date(game.Date);
      if (showNextWeek) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(23, 59, 59, 999);
        if (gameDate < today || gameDate > nextWeek) return;
      } else {
        if (!game.Audience && game['RainProb(%)'] === undefined) return;
        const yearMatch = String(game.Date).match(/^(\d{4})/);
        const itemYear = yearMatch ? yearMatch[1] : '';
        if (startYear !== 'All' && itemYear < startYear) return;
        if (endYear !== 'All' && itemYear > endYear) return;
        if (game.Audience === 0) return;
      }
      
      if (selectedStadiumFilter !== 'All' && game.Stadium !== selectedStadiumFilter) return;

      if (game.Cheerleaders) {
        game.Cheerleaders.split(/[,、]/).forEach(c => {
          const name = c.trim();
          if (name) cheerleadersSet.add(name);
        });
      }
    });

    return ['All', ...Array.from(cheerleadersSet).sort()];
  }, [rawData, viewMode, selectedOption, startYear, endYear, showNextWeek, selectedStadiumFilter]);

  // Filter and sort data
  const chartData = useMemo(() => {
    let filtered = rawData.filter(game => {
      if (!game.Date) return false;
      
      const gameDate = new Date(game.Date);
      
      if (showNextWeek) {
        // Future week mode: only games from today to today+7
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(23, 59, 59, 999);
        
        if (gameDate < today || gameDate > nextWeek) return false;
      } else {
        // Normal mode
        // Filter out future games that don't have RainProb(%) and don't have Audience
        if (!game.Audience && game['RainProb(%)'] === undefined) {
          return false;
        }

        const yearMatch = String(game.Date).match(/^(\d{4})/);
        const itemYear = yearMatch ? yearMatch[1] : '';
        
        let matchYear = true;
        if (startYear !== 'All' && itemYear < startYear) matchYear = false;
        if (endYear !== 'All' && itemYear > endYear) matchYear = false;
        if (!matchYear) return false;
      }
      
      if (viewMode !== 'matchup') {
        const matchView = (viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') ? game.HomeTeam === selectedOption : game.Stadium === selectedOption;
        if (!matchView) return false;
      }

      const matchStadium = (viewMode === 'homeTeam' || viewMode === 'matchup' || viewMode === 'cheerleaderWinRate') ? (selectedStadiumFilter === 'All' || game.Stadium === selectedStadiumFilter) : true;
      if (!matchStadium) return false;

      const dayOfWeekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const dayStr = dayOfWeekMap[gameDate.getDay()];
      const matchDay = selectedDayOfWeek === 'All' || dayStr === selectedDayOfWeek;
      if (!matchDay) return false;

      const matchTheme = selectedThemeFilter === 'All' ? true :
                         selectedThemeFilter === 'ThemeOnly' ? !!game.Theme :
                         !game.Theme;
      if (!matchTheme) return false;

      const matchCheerleader = selectedCheerleader === 'All' || 
                               (game.Cheerleaders && game.Cheerleaders.split(/[,、]/).map(c => c.trim()).includes(selectedCheerleader));
      if (!matchCheerleader) return false;

      const matchGameResult = selectedGameResult === 'All' ? true :
                              selectedGameResult === 'W' ? game.HomeResult === '勝' :
                              selectedGameResult === 'L' ? game.HomeResult === '敗' :
                              selectedGameResult === 'T' ? game.HomeResult === '和' : true;
      if (!matchGameResult) return false;

      // Filter out games with 0 audience (assuming unplayed games) only in normal mode
      if (!showNextWeek && game.Audience === 0) return false;

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'winRateDesc': {
          const diffA = (a.HomeScore || 0) - (a.AwayScore || 0);
          const diffB = (b.HomeScore || 0) - (b.AwayScore || 0);
          if (diffA !== diffB) return diffB - diffA; // Descending point difference
          
          // Fallback to date sorting if point difference is same
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
  }, [rawData, viewMode, selectedOption, sortMode, startYear, endYear, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter, selectedCheerleader, selectedGameResult, showNextWeek]);

  const dataForYoY = useMemo(() => {
    return rawData.filter(game => {
      if (!game.Date) return false;
      if (showNextWeek) return false; // YoY doesn't apply to future weeks

      if (viewMode !== 'matchup') {
        const matchView = (viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') ? game.HomeTeam === selectedOption : game.Stadium === selectedOption;
        if (!matchView) return false;
      }

      const matchStadium = (viewMode === 'homeTeam' || viewMode === 'matchup' || viewMode === 'cheerleaderWinRate') ? (selectedStadiumFilter === 'All' || game.Stadium === selectedStadiumFilter) : true;
      if (!matchStadium) return false;

      const dayOfWeekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const dayStr = dayOfWeekMap[new Date(game.Date).getDay()];
      if (selectedDayOfWeek !== 'All' && dayStr !== selectedDayOfWeek) return false;

      const matchTheme = selectedThemeFilter === 'All' ? true :
                         selectedThemeFilter === 'ThemeOnly' ? !!game.Theme :
                         !game.Theme;
      if (!matchTheme) return false;

      const matchCheerleader = selectedCheerleader === 'All' || 
                               (game.Cheerleaders && game.Cheerleaders.split(/[,、]/).map(c => c.trim()).includes(selectedCheerleader));
      if (!matchCheerleader) return false;

      const matchGameResult = selectedGameResult === 'All' ? true :
                              selectedGameResult === 'W' ? game.HomeResult === '勝' :
                              selectedGameResult === 'L' ? game.HomeResult === '敗' :
                              selectedGameResult === 'T' ? game.HomeResult === '和' : true;
      if (!matchGameResult) return false;

      if (game.Audience === 0) return false;

      return true;
    });
  }, [rawData, viewMode, selectedOption, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter, selectedCheerleader, selectedGameResult, showNextWeek]);

  const yearlyStats = useMemo(() => {
    if (dataForYoY.length === 0) return [];
    
    const grouped = new Map<string, { total: number, count: number }>();
    dataForYoY.forEach(game => {
      const yearStr = game.Date.split('/')[0];
      if (!grouped.has(yearStr)) grouped.set(yearStr, { total: 0, count: 0 });
      const stat = grouped.get(yearStr)!;
      stat.total += game.Audience;
      stat.count += 1;
    });
    
    const results = Array.from(grouped.entries()).map(([year, val]) => ({
      year,
      total: val.total,
      count: val.count,
      avg: Math.round(val.total / val.count)
    })).sort((a, b) => a.year.localeCompare(b.year));

    return results.map((stat, i, arr) => {
      let growth: number | null = null;
      if (i > 0) {
        const prevYearStr = String(Number(stat.year) - 1);
        const prevStat = arr.find(s => s.year === prevYearStr);
        if (prevStat && prevStat.avg > 0) {
          growth = ((stat.avg - prevStat.avg) / prevStat.avg) * 100;
        }
      }
      return { ...stat, growth };
    });
  }, [dataForYoY]);

  const cheerleaderStats = useMemo(() => {
    if (viewMode !== 'cheerleaderWinRate') return [];
    const stats: Record<string, { wins: number, games: number }> = {};
    chartData.forEach(game => {
      if (!game.HomeResult || (game.HomeResult !== '勝' && game.HomeResult !== '敗' && game.HomeResult !== '和')) return;
      if (!game.Cheerleaders) return;

      const cheerleaders = game.Cheerleaders.split(/[,、，]/).map(c => c.trim()).filter(Boolean);
      cheerleaders.forEach(c => {
         if (!stats[c]) stats[c] = { wins: 0, games: 0 };
         stats[c].games++;
         if (game.HomeResult === '勝') {
            stats[c].wins++;
         }
      });
    });

    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data, rate: data.wins / data.games }))
      .sort((a, b) => b.rate === a.rate ? b.games - a.games : b.rate - a.rate)
      .filter(d => d.games >= 5); // 至少 5 場才列入排行
  }, [chartData, viewMode]);

  const maxTemp = chartData.length > 0 ? Math.max(...chartData.map(d => d['MaxTemp(C)'])) : null;
  const maxRain = chartData.length > 0 ? Math.max(...chartData.map(d => d['Rainfall(mm)'])) : null;

  const exportChartImage = async () => {
    const chartContainer = document.getElementById('exportable-chart-area');
    if (!chartContainer) return;

    setIsExporting(true);
    
    // Temporarily fix scroll position for html-to-image
    const scrollContainers = chartContainer.querySelectorAll('.overflow-x-auto');
    const scrollState: { el: HTMLElement, transform: string, transition: string }[] = [];
    
    scrollContainers.forEach(container => {
      const scrollLeft = container.scrollLeft;
      if (scrollLeft > 0 && container.firstElementChild) {
        const inner = container.firstElementChild as HTMLElement;
        scrollState.push({ 
           el: inner, 
           transform: inner.style.transform,
           transition: inner.style.transition
        });
        inner.style.transition = 'none';
        inner.style.transform = `translateX(-${scrollLeft}px)`;
      }
    });

    try {
      const blob = await toBlob(chartContainer, {
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        pixelRatio: 2 // High resolution
      });
      
      if (!blob) throw new Error("Failed to create image blob");

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      let sharedNative = false;
      const shareText = `看看 ${selectedOption} 的中職票房數據與分析！\n\n📊 互動圖表與詳細資訊：${window.location.href}`;

      // Try using Web Share API if supported and on mobile (it can share images natively with text)
      if (navigator.share && navigator.canShare && isMobile) {
        const file = new File([blob], `CPBL_Chart_${selectedOption}_${startYear}-${endYear}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            // Mobile apps (like FB/IG/Threads) often ignore the "text" field when sharing a "file".
            // Pre-emptively copy the text to clipboard so users can easily "Paste" it as the caption.
            if (navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(shareText);
              } catch (e) {
                console.warn("Auto-copy text for mobile failed", e);
              }
            }

            await navigator.share({
              title: '中職票房分析',
              text: shareText, // keep for apps that do support both (like LINE, Telegram, etc.)
              files: [file]
            });
            sharedNative = true;

            // Show toast just in case they return to the browser and want to copy it again
            setToastContent({
              title: '🎉 圖片分享成功！',
              message: '若您的社群 APP 沒有自動帶入推廣文字，\n剛才系統已經幫您將「推廣文字與網址」複製到剪貼簿了！在貼文中直接貼上即可。',
              urlText: shareText
            });
            setTimeout(() => setToastContent(null), 8000);
            
          } catch (error) {
            if ((error as any).name !== 'AbortError') {
               console.log("Web Share failed, falling back to clipboard", error);
            } else {
               return; // User canceled
            }
          }
        }
      }

      // Desktop logic: Try to copy image to clipboard for easy Ctrl+V sharing
      if (!sharedNative) {
        let copiedToClipboard = false;
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copiedToClipboard = true;
            setToastContent({
              title: '🎉 圖表截圖已複製成功！',
              message: '您可以直接到 Facebook 貼上圖片 (Ctrl+V) 囉！',
              urlText: shareText
            });
            setTimeout(() => setToastContent(null), 8000);
          } catch (err) {
            console.warn("Clipboard write failed, downloading instead...", err);
          }
        }

        // Fallback: Download image if clipboard write is blocked or unsupported
        if (!copiedToClipboard) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `CPBL_Chart_${selectedOption}_${startYear}-${endYear}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          setToastContent({
            title: '⬇️ 圖表已下載至電腦',
            message: '由於瀏覽器限制複製圖片，已幫您存為圖檔！直接將圖檔拉到社群發布即可！',
            urlText: shareText
          });
          setTimeout(() => setToastContent(null), 8000);
        }
      }
      
    } catch (error) {
      console.error('Failed to export image', error);
      setToastContent({
        title: '❌ 匯出失敗',
        message: '圖片匯出過程發生錯誤，請重試或回報。'
      });
      setTimeout(() => setToastContent(null), 5000);
    } finally {
      // Revert scroll transforms
      scrollState.forEach(({ el, transform, transition }) => {
        el.style.transform = transform;
        el.style.transition = transition;
      });
      setIsExporting(false);
    }
  };

  const handleForceRefresh = async () => {
    if (!gasUrl) return;
    setLoading(true);
    
    // Clear cache
    if ('caches' in window) {
      try {
        await caches.delete('cpbl-gas-cache-v1');
      } catch (e) {
        console.error("Failed to delete cache", e);
      }
    }
    
    try {
      const url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}mode=all&forceRefresh=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      // Update cache
      if ('caches' in window) {
        try {
          const cache = await caches.open('cpbl-gas-cache-v1');
          await cache.put(gasUrl + '_all', new Response(JSON.stringify(data)));
        } catch (e) {
          console.error("Failed to re-cache", e);
        }
      }
      
      const isInitialRender = false;
      
      processData(data, isInitialRender);
      
    } catch (err: any) {
      console.error(err);
      let errorMessage = '發生未預期的錯誤。';
      if (err instanceof Error) errorMessage = `錯誤: ${err.message}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        enabled: typeof window !== 'undefined' ? window.innerWidth > 768 : true,
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
            ];

            if (data.HomeResult) {
              tooltipLines.push(`比分：客 ${data.AwayTeam} ${data.AwayScore ?? '-'} vs ${data.HomeScore ?? '-'} ${data.HomeTeam} (${data.HomeResult})`);
            } else if (data.AwayScore !== undefined && data.HomeScore !== undefined) {
              tooltipLines.push(`比分：客 ${data.AwayTeam} ${data.AwayScore} vs ${data.HomeScore} ${data.HomeTeam}`);
            } else {
              tooltipLines.push(`對戰：${data.AwayTeam} vs ${data.HomeTeam}`);
            }

            tooltipLines.push(tempLabel, rainLabel);

            if (data['RainProb(%)'] !== undefined) {
              tooltipLines.push(`降雨機率：${data['RainProb(%)']}%`);
            }

            if (data.Theme) {
              tooltipLines.splice(2, 0, `主題日：${data.Theme} ⭐`);
            }

            if (data.Cheerleaders) {
              const names = data.Cheerleaders.split(/[,、，]/).map(n => n.trim()).filter(Boolean);
              if (names.length > 6) {
                tooltipLines.push(`啦啦隊：`);
                for (let i = 0; i < names.length; i += 6) {
                  tooltipLines.push(`　${names.slice(i, i + 6).join(', ')}`);
                }
              } else {
                tooltipLines.push(`啦啦隊：${names.join(', ')}`);
              }
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
      <header className="bg-blue-700 dark:bg-slate-800 text-white px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] shadow-md flex justify-between items-center sticky top-0 z-[60] transition-colors duration-300">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6" />
          <h1 className="text-xl font-bold">中職票房分析</h1>
          {lastUpdated && (
            <span className="hidden sm:inline-block ml-4 text-xs text-blue-200 dark:text-slate-400">
              最後更新: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors font-medium text-sm border ${
              copied 
                ? 'bg-green-500/20 text-green-100 border-green-400/50 dark:bg-green-500/20 dark:text-green-300' 
                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600'
            }`}
            title="複製當前狀態連結"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? '已複製連結' : '分享'}</span>
          </button>
          
          <div className="w-px h-6 bg-blue-500 dark:bg-slate-600 mx-1"></div>

          <button 
            onClick={handleForceRefresh}
            disabled={loading}
            className={`p-2 hover:bg-blue-600 dark:hover:bg-slate-700 rounded-full transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="強制重新抓取資料"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 hover:bg-blue-600 dark:hover:bg-slate-700 rounded-full transition-colors"
            title="切換深色模式"
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

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
            <div className="text-center space-y-2 h-16">
              <h3 key={loadingTextIndex} className="text-xl font-bold text-gray-800 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-500">
                {loadingTextIndex === 0 ? "正在讀取最新票房資料..." : "優先載入最新三年資料..."}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">這可能需要幾秒鐘的時間，請稍候</p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Filter Toggle */}
            <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Filter className="w-4 h-4" /> 
                篩選條件 / 分析選項
              </span>
              <button 
                onClick={() => setIsFiltersOpen(!isFiltersOpen)} 
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium rounded-lg text-sm"
              >
                {isFiltersOpen ? '收起' : '展開'}
              </button>
            </div>

            {/* Controls */}
            <div className={`${isFiltersOpen ? 'grid' : 'hidden'} md:grid bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in`}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">分析維度</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="homeTeam">各隊主場人數</option>
              <option value="stadium">各球場人數</option>
              <option value="cheerleaderWinRate">各隊啦啦隊勝率排行</option>
              <option value="matchup">對戰組合交叉分析</option>
            </select>
          </div>
          
          {viewMode !== 'matchup' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {(viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') ? '選擇球隊' : '選擇球場'}
              </label>
              <select
                value={selectedOption}
                onChange={(e) => handleOptionChange(e.target.value)}
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
                value={showNextWeek ? 'All' : startYear}
                onChange={(e) => setStartYear(e.target.value)}
                disabled={showNextWeek}
                className="flex-1 min-w-0 p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none truncate disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="All">最早</option>
                {availableYears.filter(y => y !== 'All').sort().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-gray-400 font-medium shrink-0">~</span>
              <select
                value={showNextWeek ? 'All' : endYear}
                onChange={(e) => setEndYear(e.target.value)}
                disabled={showNextWeek}
                className="flex-1 min-w-0 p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none truncate disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="All">最新</option>
                {availableYears.filter(y => y !== 'All').sort((a, b) => b.localeCompare(a)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {(viewMode === 'homeTeam' || viewMode === 'matchup' || viewMode === 'cheerleaderWinRate') && (
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
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">比賽結果篩選</label>
            <select
              value={selectedGameResult}
              onChange={(e) => setSelectedGameResult(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部賽事</option>
              <option value="W">主場勝</option>
              <option value="L">主場敗</option>
              <option value="T">主場和</option>
            </select>
          </div>

          {(viewMode === 'homeTeam' || viewMode === 'cheerleaderWinRate') && (
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
        <div className="flex flex-wrap gap-2 items-center">
          {viewMode !== 'matchup' && viewMode !== 'cheerleaderWinRate' && (
            <>
              <button
                onClick={() => {
                  const nextState = !showNextWeek;
                  setShowNextWeek(nextState);
                  if (nextState) {
                    setSortMode('date');
                    setChartType('trend'); // Fix yearly comparison bug
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  showNextWeek 
                    ? 'bg-fuchsia-600 text-white shadow-md transform scale-105' 
                    : 'bg-white dark:bg-slate-800 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-800 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/40'
                }`}
              >
                <Calendar className="w-4 h-4" /> 
                {showNextWeek ? '返回歷史資料' : '預覽未來一週'}
              </button>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block"></div>
            </>
          )}

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

          <div className="flex-1"></div>
          <button
            onClick={exportChartImage}
            disabled={chartData.length === 0 || isExporting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              (chartData.length === 0 || isExporting) ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
             title="儲存為圖片 / 分享圖表至社群平台"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} {isExporting ? '處理中...' : '截圖分享圖表'}
          </button>
        </div>

        {/* Chart Area */}
        <div id="exportable-chart-area" className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col ${showNextWeek ? '' : 'min-h-[400px]'}`}>
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      {showNextWeek ? `${selectedOption} - 未來一週賽程預覽` : viewMode === 'matchup' ? '對戰組合場均人數矩陣 (Heatmap)' : viewMode === 'cheerleaderWinRate' ? '啦啦隊主場勝率排名' : `${selectedOption} - 人數趨勢`}
                      {loading && <span className="text-sm font-normal text-gray-400 animate-pulse">載入中...</span>}
                    </h2>
                    {!showNextWeek && viewMode !== 'matchup' && viewMode !== 'cheerleaderWinRate' && chartData.length > 0 && (
                      <div className="flex bg-gray-100 dark:bg-slate-700/80 p-0.5 rounded-lg border border-gray-200 dark:border-slate-600">
                        <button
                          onClick={() => setChartType('trend')}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${chartType === 'trend' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                          每日趨勢
                        </button>
                        <button
                          onClick={() => setChartType('yoy')}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${chartType === 'yoy' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                          年度比較
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 篩選條件標示 (讓截圖可以看到) */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                    {startYear === 'All' && endYear === 'All' ? '歷年' : `${startYear === 'All' ? '最早期' : startYear} ~ ${endYear === 'All' ? '最新' : endYear}`}
                  </span>
                  {selectedStadiumFilter !== 'All' && <span>📍 {selectedStadiumFilter}</span>}
                  {selectedDayOfWeek !== 'All' && <span>📅 {selectedDayOfWeek}</span>}
                  {selectedThemeFilter === 'ThemeOnly' && <span>⭐ 僅主題日</span>}
                  {selectedThemeFilter === 'NormalOnly' && <span>⚾ 僅一般例行賽</span>}
                  {selectedGameResult !== 'All' && <span>🏆 比賽結果: {selectedGameResult === 'W' ? '主場勝' : selectedGameResult === 'L' ? '主場敗' : '和局'}</span>}
                  {selectedCheerleader !== 'All' && <span>💃 {selectedCheerleader}</span>}
                </div>
              </div>
              
              {!loading && chartData.length > 0 && !showNextWeek && chartType === 'trend' && viewMode !== 'cheerleaderWinRate' && (
                <div className="flex flex-wrap lg:flex-nowrap gap-3 items-stretch w-full xl:w-auto mt-2 xl:mt-0 justify-start xl:justify-end">
                  {/* 總場次 */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-0.5 tracking-wider">總場次</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-slate-800 dark:text-slate-100 text-xl font-black">{chartData.length}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">場</span>
                    </div>
                  </div>
                
                  {/* 總人數 */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                    <span className="text-emerald-700 dark:text-emerald-400/80 text-xs font-bold mb-0.5 tracking-wider">總人數</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-emerald-700 dark:text-emerald-400 text-xl font-black">{chartData.reduce((sum, d) => sum + d.Audience, 0).toLocaleString()}</span>
                      <span className="text-emerald-700 dark:text-emerald-400/80 text-xs font-medium">人</span>
                    </div>
                  </div>

                  {/* 平均年度勝率 */}
                  {viewMode === 'homeTeam' && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2 flex flex-col items-start shadow-sm transition-transform hover:-translate-y-0.5">
                      <span className="text-indigo-700 dark:text-indigo-400/80 text-xs font-bold mb-0.5 tracking-wider">主場勝率</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-indigo-700 dark:text-indigo-400 text-xl font-black">
                        {(() => {
                          const gamesWithResult = chartData.filter(d => d.HomeResult === '勝' || d.HomeResult === '敗');
                          if (gamesWithResult.length === 0) return '-';
                          const wins = gamesWithResult.filter(d => d.HomeResult === '勝').length;
                          const winRate = wins / gamesWithResult.length;
                          return winRate.toFixed(3);
                        })()}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* 場均人數 (Highlighted) */}
                <div className="w-full md:w-auto mt-2 xl:mt-0 xl:flex-1 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-2 flex flex-col items-start shadow-md relative overflow-hidden transition-transform hover:-translate-y-0.5">
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
            <div className="flex flex-col flex-1 w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">對戰組合場均人數矩陣 (Heatmap)</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex justify-end items-center gap-2">
                <span>圖例顏色深淺代表平均人數多寡（顏色越橘越多人）</span>
              </div>
              <div className="overflow-x-auto w-full pb-2">
                <table className="w-full text-center border-separate border-spacing-0 text-sm min-w-[600px] border-t border-l border-gray-200 dark:border-slate-700">
                <thead>
                  <tr>
                    <th className="p-3 border-b border-r border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-200 font-semibold w-24 sm:w-32 whitespace-nowrap sticky left-0 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] bg-clip-padding">
                      主場 \ 客場
                    </th>
                    {Array.from(new Set([...chartData.map(d=>d.HomeTeam), ...chartData.map(d=>d.AwayTeam)])).filter(Boolean).sort().map(team => (
                      <th key={`col-${team}`} className="p-3 border-b border-r border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium bg-clip-padding">
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
                        <td className="p-3 border-b border-r border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] w-24 sm:w-32 bg-clip-padding">
                          {home} <span className="text-[10px] sm:text-xs text-slate-400 font-normal">(主)</span>
                        </td>
                        {allTeams.map(away => {
                          if (home === away) {
                            return <td key={`cell-${home}-${away}`} className="p-3 border-b border-r border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-500 bg-clip-padding">-</td>;
                          }
                          const matchGames = chartData.filter(d => d.HomeTeam === home && d.AwayTeam === away);
                          if (matchGames.length === 0) {
                            return <td key={`cell-${home}-${away}`} className="p-3 border-b border-r border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 bg-white dark:bg-slate-800 bg-clip-padding">-</td>;
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
                            <td key={`cell-${home}-${away}`} className="border-b border-r border-gray-200 dark:border-slate-700 transition-colors hover:ring-2 hover:ring-inset hover:ring-blue-500 cursor-default bg-clip-padding" style={{ backgroundColor: bgColor, color: textColor }}>
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
              </div>
              <div className="mt-4 text-xs text-center text-gray-400">
                註：左側縱軸為主場球隊，上方橫軸為客場球隊。<br/>
                格子內數字為「場均觀眾數」，下方小括號表示符合條件的有效賽事總場次。
              </div>
            </div>
          ) : viewMode === 'cheerleaderWinRate' ? (
            <div className="flex flex-col flex-1 w-full bg-white dark:bg-slate-800 p-2 md:p-6 mb-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">
                {selectedOption === 'All' ? '全聯盟啦啦隊主場勝率排行' : `${selectedOption} 啦啦隊主場勝率排行`}
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                計算方式為主場勝場數除以總場次（不含延賽，至少參與 5 場）
              </div>

              {cheerleaderStats.length === 0 ? (
                <div className="text-center text-gray-400 py-10">目前沒有符合條件的啦啦隊勝率資料。</div>
              ) : (
                <div className="w-full sm:w-fit max-w-full overflow-x-auto custom-scrollbar rounded-xl border border-gray-200 dark:border-slate-700 mx-auto shadow-sm">
                  <table className="w-full sm:w-auto text-center text-sm table-auto min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-3 px-2 font-bold border-b border-gray-200 dark:border-slate-700 w-16 whitespace-nowrap">排名</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 text-left sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/80 whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]">啦啦隊名稱</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 w-24 whitespace-nowrap">參與場次</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 w-24 whitespace-nowrap">主場隊伍勝</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 w-32 whitespace-nowrap">勝率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                      {cheerleaderStats.map((stat, idx) => (
                        <tr key={stat.name} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-2 font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">#{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 text-left sticky left-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-blue-50/50 dark:group-hover:bg-slate-700/30 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)] whitespace-nowrap">{stat.name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{stat.games} 場</td>
                          <td className="py-3 px-4 text-emerald-600 dark:text-emerald-500 font-semibold whitespace-nowrap">{stat.wins} 勝</td>
                          <td className="py-3 px-4 text-rose-500 dark:text-rose-400 font-bold text-lg whitespace-nowrap">
                            {(stat.rate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : showNextWeek ? (
            <div className="flex items-center justify-center p-4 sm:p-6 mt-2 rounded-xl bg-fuchsia-50/50 dark:bg-slate-900 border border-fuchsia-100 dark:border-slate-800">
              <div className="flex flex-row items-center gap-4 max-w-lg">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm shrink-0">
                  <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-fuchsia-500 dark:text-fuchsia-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">未來一週天氣與賽程</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">下方清單已為您篩選出未來七天的賽程，請往下滑動查閱詳細的啦啦隊班表與降雨機率預報。</p>
                </div>
              </div>
            </div>
          ) : chartType === 'yoy' ? (
            <div className="flex flex-col flex-1 w-full bg-white dark:bg-slate-800 p-2 md:p-6 mb-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-8 text-center">歷年場均人數與成長率</h3>
              
              {/* CSS Bar Chart */}
              <div className="w-full relative pb-10 pt-4 mt-2">
                {/* Max label floating independent of the scrolling container so it always shows */}
                <div className="absolute top-0 right-4 sm:right-10 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-full text-amber-600 dark:text-amber-400 text-xs font-medium shadow-sm flex items-center gap-1.5 z-20">
                   <TrendingUp className="w-3.5 h-3.5" /> 年最高場均: {Math.max(...yearlyStats.map(s => s.avg)).toLocaleString()}
                </div>
                
                <div className="flex h-64 relative ml-8 sm:ml-12 border-l border-b border-gray-200 dark:border-slate-600 mt-16">
                   {/* Y-axis Guides and Ticks (Fixed outside scrolling area) */}
                   <div className="absolute left-0 top-0 w-full h-full flex flex-col justify-between pointer-events-none z-0">
                      {[100, 75, 50, 25, 0].map(percent => {
                        const maxAvg = Math.max(...yearlyStats.map(s => s.avg), 1000); // Minimum scale of 1000
                        // Round max to nearest thousand for cleaner ticks
                        const tickMax = Math.ceil(maxAvg / 1000) * 1000;
                        const val = Math.round((tickMax * percent) / 100);
                        
                        return (
                          <div key={percent} className="w-full border-t border-gray-100 dark:border-slate-700/50 relative">
                             <span className="absolute -top-2.5 -left-2 -translate-x-full pr-2 text-[10px] sm:text-xs text-gray-400 font-medium whitespace-nowrap">
                               {val.toLocaleString()}
                             </span>
                          </div>
                        )
                      })}
                   </div>

                   {/* Scrollable Bar Area */}
                   <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar flex min-w-0 h-[352px] -mt-[64px] -mb-[32px]">
                     <div className="flex items-end gap-4 sm:gap-8 md:gap-12 px-6 sm:px-10 h-[352px] min-w-max pb-[34px]">
                       {yearlyStats.map((stat, idx) => {
                          const maxAvg = Math.max(...yearlyStats.map(s => s.avg), 1000);
                          const tickMax = Math.ceil(maxAvg / 1000) * 1000;
                          const heightPercent = tickMax > 0 ? (stat.avg / tickMax) * 100 : 0;
                          return (
                            <div key={stat.year} className="flex flex-col justify-end items-center gap-2 group relative w-10 sm:w-16 md:w-20 h-64 shrink-0 z-10 pointer-events-auto">
                             {/* Tooltip visible on hover inside the bar area */}
                         <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs py-1.5 px-3 rounded shadow-lg pointer-events-none whitespace-nowrap z-10 flex flex-col items-center">
                            <span className="font-bold text-sm tracking-wide">{stat.avg.toLocaleString()} 人</span>
                            {stat.growth !== null && (
                              <span className={`text-[10px] mt-0.5 font-medium ${stat.growth > 0 ? 'text-emerald-400 dark:text-emerald-600' : stat.growth < 0 ? 'text-red-400 dark:text-red-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                {stat.growth > 0 ? '+' : ''}{stat.growth.toFixed(1)}% YoY
                              </span>
                            )}
                         </div>
                         
                         {/* Bar */}
                         <div className="w-full flex-1 flex flex-col justify-end relative">
                           <div 
                             className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 dark:from-blue-700 dark:to-cyan-500 rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-110 shadow-sm relative overflow-hidden" 
                             style={{ height: `${Math.max(2, heightPercent)}%` }}
                           >
                              <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                           </div>
                         </div>
                         
                         {/* X-axis Label */}
                         <div className="absolute -bottom-8 whitespace-nowrap">
                           <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{stat.year}</span>
                         </div>
                      </div>
                    )
                 })}
                     </div>
                   </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto custom-scrollbar rounded-xl border border-gray-200 dark:border-slate-700 mx-auto w-full max-w-4xl shadow-sm">
                 <table className="w-full text-center text-sm table-auto min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">年度</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">總場次</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">總數</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">場均人數</th>
                        <th className="py-3 px-4 font-bold border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">年度成長率 (YoY)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                      {[...yearlyStats].reverse().map(stat => (
                        <tr key={stat.year} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{stat.year}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{stat.count} 場</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{stat.total.toLocaleString()}</td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-bold text-base whitespace-nowrap">{stat.avg.toLocaleString()}</td>
                          <td className="py-3 px-4 font-medium whitespace-nowrap">
                            {stat.growth !== null ? (
                               stat.growth > 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 py-1 px-2 rounded-full w-24 mx-auto">
                                    <TrendingUp className="w-4 h-4" /> +{stat.growth.toFixed(1)}%
                                  </span>
                               ) : stat.growth < 0 ? (
                                  <span className="text-red-500 dark:text-red-400 flex items-center justify-center gap-1 bg-red-50 dark:bg-red-900/20 py-1 px-2 rounded-full w-24 mx-auto">
                                    <TrendingDown className="w-4 h-4" /> {stat.growth.toFixed(1)}%
                                  </span>
                               ) : (
                                  <span className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 py-1 px-2 rounded-full w-24 mx-auto block">-</span>
                                )
                            ) : (
                               <span className="text-slate-400 dark:text-slate-500 text-xs">無前期資料</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
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
              <div className="flex w-full pb-4 items-stretch">
                {chartJsData && (
                  <div className="relative h-[300px] md:h-[400px] w-[60px] sm:w-[70px] shrink-0 bg-white dark:bg-slate-800 z-10 border-r border-gray-100 dark:border-slate-700">
                    <Line 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          legend: { display: false },
                          tooltip: { enabled: false }
                        },
                        scales: {
                          ...chartOptions.scales,
                          x: {
                            ...chartOptions.scales.x,
                            ticks: {
                              ...chartOptions.scales.x.ticks,
                              color: 'transparent'
                            },
                            grid: { display: false },
                            border: { display: false }
                          }
                        }
                      }} 
                      data={{
                        ...chartJsData,
                        datasets: chartJsData.datasets.map(d => ({
                          ...d,
                          borderColor: 'transparent',
                          backgroundColor: 'transparent',
                          pointBackgroundColor: 'transparent',
                          pointBorderColor: 'transparent',
                          pointHoverBackgroundColor: 'transparent',
                          pointHoverBorderColor: 'transparent'
                        }))
                      }} 
                    />
                  </div>
                )}
                <div className="flex-1 overflow-x-auto custom-scrollbar">
                  <div className="relative h-[300px] md:h-[400px]" style={{ width: safeChartWidth }}>
                    <Line 
                      options={{
                        ...chartOptions,
                        scales: {
                          ...chartOptions.scales,
                          y: {
                            ...chartOptions.scales.y,
                            ticks: {
                              ...chartOptions.scales.y.ticks,
                              display: false
                            }
                          }
                        }
                      }} 
                      data={chartJsData} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Grid Area */}
        {!loading && chartData.length > 0 && viewMode !== 'matchup' && viewMode !== 'cheerleaderWinRate' && chartType === 'trend' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col mt-4">
            <div className="p-4 border-b border-gray-100 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">詳細數據清單</h2>
              <span className="text-xs text-gray-400 font-medium">點擊列查看完整資訊</span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-30 text-gray-500 dark:text-gray-400 font-semibold text-xs border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="px-2 sm:px-3 py-3 sticky left-0 z-40 bg-slate-50 dark:bg-slate-800 w-[65px] min-w-[65px] max-w-[65px] sm:w-[100px] sm:min-w-[100px] sm:max-w-[100px]">日期</th>
                    <th className="px-2 sm:px-3 py-3 sticky left-[65px] sm:left-[100px] z-40 bg-slate-50 dark:bg-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] w-[95px] min-w-[95px] max-w-[95px] sm:w-auto sm:min-w-[auto] sm:max-w-none">對戰組合</th>
                    <th className="px-4 py-3">球場</th>
                    <th className="px-4 py-3 text-right">人數</th>
                    <th className="px-4 py-3 text-center">氣象</th>
                    <th className="px-4 py-3">主題日</th>
                    <th className="px-4 py-3">啦啦隊</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {([...chartData].sort((a, b) => {
                    // For the table, if sortMode is 'date', we want newest -> oldest for history
                    // But for future week, we want oldest -> newest (closest upcoming first)
                    if (sortMode === 'date') {
                      const timeDiff = new Date(b.Date).getTime() - new Date(a.Date).getTime();
                      if (timeDiff === 0) {
                        const snoA = isNaN(Number(a.GameSno)) ? 0 : Number(a.GameSno);
                        const snoB = isNaN(Number(b.GameSno)) ? 0 : Number(b.GameSno);
                        return showNextWeek ? snoA - snoB : snoB - snoA;
                      }
                      return showNextWeek ? -timeDiff : timeDiff;
                    }
                    return 0; // retain chartData ordering for other modes
                  })).map((game, idx) => {
                    const isMaxTemp = maxTemp !== null && game['MaxTemp(C)'] === maxTemp && maxTemp > 0;
                    const isMaxRain = maxRain !== null && game['Rainfall(mm)'] === maxRain && maxRain > 0;
                    return (
                      <tr key={`${game.Date}-${game.GameSno}-${idx}`} className="group hover:bg-blue-50/60 dark:hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => setSelectedGame(game)}>
                        <td className="px-2 sm:px-3 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs sticky left-0 z-20 bg-white dark:bg-slate-800 group-hover:bg-blue-50/60 dark:group-hover:bg-slate-700 transition-colors w-[65px] min-w-[65px] max-w-[65px] sm:w-[100px] sm:min-w-[100px] sm:max-w-[100px] align-middle">
                          <div className="flex flex-col sm:block text-[10px] sm:text-xs leading-[1.3]">
                            <span className="sm:hidden text-gray-400 scale-[0.85] origin-left">{game.Date.substring(0, 4)}</span>
                            <span className="sm:hidden font-semibold">{game.Date.substring(5)}</span>
                            <span className="hidden sm:inline">{game.Date}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-3 font-medium text-gray-800 dark:text-gray-100 sticky left-[65px] sm:left-[100px] z-20 bg-white dark:bg-slate-800 group-hover:bg-blue-50/60 dark:group-hover:bg-slate-700 transition-colors shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] w-[95px] min-w-[95px] max-w-[95px] sm:w-auto sm:min-w-[auto] sm:max-w-none overflow-hidden align-middle">
                          <div className="flex flex-col sm:flex-row sm:items-center text-[10px] sm:text-sm leading-[1.3] gap-0.5 sm:gap-0">
                            <span className="truncate w-full">{game.AwayTeam}</span>
                            <span className="hidden sm:inline text-gray-400 font-normal mx-1 text-xs">vs</span>
                            <span className="truncate w-full">{game.HomeTeam}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{game.Stadium}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {game.Audience === 0 ? <span className="text-gray-400 font-normal">尚未舉行</span> : game.Audience.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isMaxTemp && <Thermometer className="w-4 h-4 text-red-500" title="最高氣溫" />}
                            {isMaxRain && <CloudRain className="w-4 h-4 text-cyan-500" title="最高降雨量" />}
                            {game['RainProb(%)'] !== undefined && game['RainProb(%)'] > 0 && (
                              <span className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 px-1.5 py-0.5 rounded font-medium">
                                降雨 {game['RainProb(%)']}%
                              </span>
                            )}
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

      {/* Sponsorship Section */}
      <div className="flex justify-center my-8 px-4">
        <div className="bg-gradient-to-b from-white to-emerald-50/30 dark:from-slate-800 dark:to-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-sm border border-emerald-100/80 dark:border-emerald-900/30 max-w-sm w-full text-center hover:shadow-md transition-all duration-300">
          <p className="text-gray-600 dark:text-gray-300 font-medium mb-4 text-sm leading-relaxed">
            請開發者買杯進場看球的啤酒 🍺<br className="hidden sm:block" />支持持續更新數據！
          </p>
          <a
            href="https://p.ecpay.com.tw/96AD638"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full sm:w-auto bg-[#00C66B] hover:bg-[#00ab5d] text-white px-6 py-2.5 rounded-full font-semibold text-sm shadow-md shadow-[#00C66B]/20 hover:shadow-[#00C66B]/40 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            以綠界 ECPay 贊助支持
          </a>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="w-full text-center pb-8 text-xs text-gray-400 dark:text-gray-500 max-w-7xl mx-auto px-4">
        <p>數據來源為公開資訊，本站為獨立數據統整平台，與官方無關</p>
        <p className="mt-1">
          <a href="mailto:clarklin0826@gmail.com" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2">連絡開發者</a>
        </p>
      </footer>

      {/* Game Details Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedGame(null)}>
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
                <div className="col-span-2 flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">日期</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedGame.Date}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">對戰組合</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">客 {selectedGame.AwayTeam} vs 主 {selectedGame.HomeTeam}</span>
                </div>
                {selectedGame.HomeResult ? (
                  <div className="col-span-2 flex items-center justify-between border-b dark:border-slate-700 pb-2 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 rounded -mx-2">
                    <span className="text-gray-500 dark:text-gray-400">比賽結果</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {selectedGame.AwayScore ?? '-'} : {selectedGame.HomeScore ?? '-'} (主場{selectedGame.HomeResult})
                    </span>
                  </div>
                ) : (selectedGame.AwayScore !== undefined && selectedGame.HomeScore !== undefined) ? (
                  <div className="col-span-2 flex items-center justify-between border-b dark:border-slate-700 pb-2 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 rounded -mx-2">
                    <span className="text-gray-500 dark:text-gray-400">比賽結果</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {selectedGame.AwayScore} : {selectedGame.HomeScore}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">場地</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedGame.Stadium}</span>
                </div>
                <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">觀眾人數</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{selectedGame.Audience === 0 ? '尚未舉行' : `${selectedGame.Audience.toLocaleString()} 人`}</span>
                </div>
                <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">最高氣溫</span>
                  <span className="font-medium text-red-500 dark:text-red-400">{selectedGame['MaxTemp(C)']}°C</span>
                </div>
                <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">降雨量</span>
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">{selectedGame['Rainfall(mm)']} mm</span>
                </div>
                
                {selectedGame['RainProb(%)'] !== undefined && (
                  <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">降雨機率</span>
                    <span className="font-medium text-purple-500 dark:text-purple-400">{selectedGame['RainProb(%)']}%</span>
                  </div>
                )}
                
                {selectedGame.Theme && (
                  <div className="col-span-2 flex items-center justify-between border-b dark:border-slate-700 pb-2">
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

      {toastContent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-4 rounded-xl shadow-2xl flex flex-col min-w-[300px] max-w-sm animate-in fade-in slide-in-from-bottom-8">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h4 className="font-bold text-emerald-400 dark:text-emerald-600">{toastContent.title}</h4>
              <p className="text-sm mt-1 whitespace-pre-line text-slate-200 dark:text-slate-700">{toastContent.message}</p>
            </div>
            <button onClick={() => setToastContent(null)} className="text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-black shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          {toastContent.urlText && (
            <button 
              onClick={() => {
                navigator.clipboard.writeText(toastContent.urlText!);
                setToastContent(prev => prev ? {...prev, message: '🔗 說明文字與網址已複製！您可以一併貼上到貼文中了。'} : null);
              }}
              className="mt-3 text-sm bg-blue-600 hover:bg-blue-500 dark:bg-blue-100 dark:hover:bg-blue-200 dark:text-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" /> 複製貼文說明文字與網址
            </button>
          )}
        </div>
      )}
    </div>
  );
}
