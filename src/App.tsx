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
import { Settings, BarChart2, CloudRain, Thermometer, Users, X, ExternalLink } from 'lucide-react';

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

type ViewMode = 'homeTeam' | 'stadium';
type SortMode = 'date' | 'audienceDesc' | 'tempDesc' | 'rainAsc';

export default function App() {
  const [gasUrl, setGasUrl] = useState('https://script.google.com/macros/s/AKfycbyGtfNgLdduKu5UfeSj5tVo4A3OmJQy_5s4B33BsPTpJ8z_eK0hYH01bED-UJ08mKV4/exec');
  const [rawData, setRawData] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('homeTeam');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedStadiumFilter, setSelectedStadiumFilter] = useState<string>('All');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('All');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('All');
  const [selectedCheerleader, setSelectedCheerleader] = useState<string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [igMapping, setIgMapping] = useState<Record<string, string>>({});

  // Reset filters when view mode changes
  useEffect(() => {
    setSelectedYear('All');
    setSelectedStadiumFilter('All');
    setSelectedDayOfWeek('All');
    setSelectedThemeFilter('All');
    setSelectedCheerleader('All');
    setSelectedOption(''); // Reset selected option to trigger auto-select
  }, [viewMode]);

  // Reset stadium filter when selected team changes
  useEffect(() => {
    setSelectedStadiumFilter('All');
    setSelectedCheerleader('All');
  }, [selectedOption]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!gasUrl) {
          // Use mock data
          const mock = generateMockData();
          const flatData = Object.values(mock).flat();
          // Use Date + GameSno to prevent collisions
          const uniqueData = Array.from(new Map(flatData.map(item => [`${item.Date}-${item.GameSno}`, item])).values());
          setRawData(uniqueData);
        } else {
          const response = await fetch(`${gasUrl}${gasUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`, {
            cache: 'no-store'
          });
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();
          
          // Extract IG mapping if the sheet exists
          const newIgMapping: Record<string, string> = {};
          const igSheetKey = Object.keys(data).find(k => {
            const normalized = k.replace(/\s/g, '').toLowerCase();
            return normalized.includes('啦啦隊ig') || normalized.includes('cheerleadersig') || normalized === 'ig';
          });
          
          if (igSheetKey) {
            // GAS might return an array of objects or an object of objects depending on how it's parsed
            const igData = Array.isArray(data[igSheetKey]) ? data[igSheetKey] : Object.values(data[igSheetKey]);
            igData.forEach((row: any) => {
              if (!row || typeof row !== 'object') return;
              
              // Normalize keys to handle spaces or different cases
              const normalizedRow: Record<string, any> = {};
              Object.keys(row).forEach(key => {
                normalizedRow[key.replace(/\s/g, '').toLowerCase()] = row[key];
              });

              // Check various possible column names for Name and IG
              const name = normalizedRow['名字'] || normalizedRow['name'] || normalizedRow['姓名'] || normalizedRow['啦啦隊'];
              const ig = normalizedRow['ig'] || normalizedRow['連結'] || normalizedRow['url'] || normalizedRow['ig連結'];
              
              if (name && ig) {
                newIgMapping[name.toString().trim().toLowerCase()] = ig.toString().trim();
              }
            });
            delete data[igSheetKey]; // Remove so it doesn't break game data parsing
          }
          setIgMapping(newIgMapping);

          const flatData = Object.values(data).flat() as GameData[];
          // Use Date + GameSno to prevent 2024 and 2025 games from overwriting each other
          const uniqueData = Array.from(new Map(flatData.map(item => [`${item.Date}-${item.GameSno}`, item])).values());
          
          // Ensure numeric values
          const processedData = uniqueData.map(item => ({
            ...item,
            Audience: Number(item.Audience) || 0,
            'MaxTemp(C)': Number(item['MaxTemp(C)']) || 0,
            'Rainfall(mm)': Number(item['Rainfall(mm)']) || 0,
            'RainProb(%)': item['RainProb(%)'] !== undefined && item['RainProb(%)'] !== '' ? Number(item['RainProb(%)']) : undefined,
            Theme: item.Theme || item['主題日'] || '',
            Url: item.Url || item.URL || item['連結'] || '', // Map URL from column G
            Cheerleaders: item.Cheerleaders || item['啦啦隊'] || item['啦啦隊班表'] || '',
          }));
          
          setRawData(processedData);
        }
      } catch (err: any) {
        let errorMessage = '無法載入資料，請檢查網址或網路連線。';
        if (err.message === 'Failed to fetch') {
          errorMessage = '取得資料失敗 (Failed to fetch)。請確認：\n1. GAS 網址是否正確\n2. GAS 部署時「誰可以存取」是否設定為「所有人 (Anyone)」\n3. 網址是否支援跨域請求 (CORS)';
        } else if (err instanceof Error) {
          errorMessage = `錯誤: ${err.message}`;
        }
        setError(errorMessage);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gasUrl]);

  // Extract options based on view mode
  const options = useMemo(() => {
    if (rawData.length === 0) return [];
    const set = new Set<string>();
    rawData.forEach(game => {
      if (viewMode === 'homeTeam' && game.HomeTeam) set.add(game.HomeTeam);
      if (viewMode === 'stadium' && game.Stadium) set.add(game.Stadium);
    });
    const sortedOptions = Array.from(set).sort();
    
    // Auto-select first option if current selection is invalid
    if (!sortedOptions.includes(selectedOption) && sortedOptions.length > 0) {
      setSelectedOption(sortedOptions[0]);
    }
    
    return sortedOptions;
  }, [rawData, viewMode, selectedOption]);

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
      
      const matchView = viewMode === 'homeTeam' ? game.HomeTeam === selectedOption : game.Stadium === selectedOption;
      if (!matchView) return false;

      const yearMatch = String(game.Date).match(/^(\d{4})/);
      const itemYear = yearMatch ? yearMatch[1] : '';
      const matchYear = selectedYear === 'All' || itemYear === selectedYear;
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

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'audienceDesc':
          return b.Audience - a.Audience;
        case 'tempDesc':
          return b['MaxTemp(C)'] - a['MaxTemp(C)'];
        case 'rainAsc':
          return a['Rainfall(mm)'] - b['Rainfall(mm)'];
        case 'date':
        default:
          return new Date(a.Date).getTime() - new Date(b.Date).getTime();
      }
    });

    return filtered;
  }, [rawData, viewMode, selectedOption, sortMode, selectedYear, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter, selectedCheerleader]);

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
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#111827',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
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
          color: '#6b7280',
          font: { family: 'Inter, sans-serif' }
        }
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: {
          color: '#f3f4f6',
          borderDash: [5, 5],
        },
        ticks: {
          color: '#6b7280',
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

  const pointBorderWidths = chartData.map(d => d.Theme ? 3 : 2);

  const pointRadii = chartData.map(d => {
    const isMaxTemp = maxTemp !== null && d['MaxTemp(C)'] === maxTemp && maxTemp > 0;
    const isMaxRain = maxRain !== null && d['Rainfall(mm)'] === maxRain && maxRain > 0;
    if (d.Theme) return 8;
    return (isMaxTemp || isMaxRain) ? 6 : 4;
  });

  const chartJsData = {
    labels: chartData.map(d => d.Date),
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
        tension: 0.4,
        pointStyle: 'circle',
        pointRadius: pointRadii,
        pointHoverRadius: pointRadii.map(r => r + 2),
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBorderColors,
        borderWidth: 3,
        pointBorderWidth: pointBorderWidths,
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6" />
          <h1 className="text-xl font-bold">中職票房分析</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-blue-600 rounded-full transition-colors"
            aria-label="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white p-4 shadow-md border-b border-gray-200 animate-in slide-in-from-top-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GAS Web App URL (留空則使用測試資料)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <h3 className="text-xl font-bold text-gray-800">正在讀取最新票房資料...</h3>
              <p className="text-sm text-gray-500 animate-pulse">這可能需要幾秒鐘的時間，請稍候</p>
            </div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">分析維度</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="homeTeam">各隊主場人數</option>
              <option value="stadium">各球場人數</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {viewMode === 'homeTeam' ? '選擇球隊' : '選擇球場'}
            </label>
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">選擇年份</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部年份</option>
              {availableYears.filter(y => y !== 'All').map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {viewMode === 'homeTeam' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">選擇球場</label>
              <select
                value={selectedStadiumFilter}
                onChange={(e) => setSelectedStadiumFilter(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">全部球場</option>
                {availableStadiumsForTeam.filter(s => s !== 'All').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">選擇星期</label>
            <select
              value={selectedDayOfWeek}
              onChange={(e) => setSelectedDayOfWeek(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">主題日篩選</label>
            <select
              value={selectedThemeFilter}
              onChange={(e) => setSelectedThemeFilter(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">全部場次</option>
              <option value="ThemeOnly">僅看主題日 ⭐</option>
              <option value="NormalOnly">僅看一般例行賽</option>
            </select>
          </div>

          {viewMode === 'homeTeam' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">選擇啦啦隊</label>
              <select
                value={selectedCheerleader}
                onChange={(e) => setSelectedCheerleader(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              sortMode === 'date' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            依日期排序
          </button>
          <button
            onClick={() => setSortMode('audienceDesc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'audienceDesc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" /> 人數由高到低
          </button>
          <button
            onClick={() => setSortMode('tempDesc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'tempDesc' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Thermometer className="w-4 h-4" /> 氣溫由高到低
          </button>
          <button
            onClick={() => setSortMode('rainAsc')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortMode === 'rainAsc' ? 'bg-cyan-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CloudRain className="w-4 h-4" /> 降雨量由低到高
          </button>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            {selectedOption} - 人數趨勢
            {loading && <span className="text-sm font-normal text-gray-400 animate-pulse">載入中...</span>}
          </h2>
          
          {error ? (
            <div className="flex-1 flex items-center justify-center text-red-500 whitespace-pre-line text-center">
              {error}
            </div>
          ) : chartData.length === 0 && !loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              沒有符合的資料
            </div>
          ) : (
            <div className="flex flex-col flex-1 w-full">
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-600">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-white mr-1.5 shadow-sm"></span>一般場次</div>
                <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-[#f59e0b] border-[3px] border-[#fef3c7] mr-1.5 shadow-sm"></span>主題日</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#ef4444] border-2 border-white mr-1.5 shadow-sm"></span>最高氣溫</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#06b6d4] border-2 border-white mr-1.5 shadow-sm"></span>最高降雨量</div>
                <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-[#a855f7] border-2 border-white mr-1.5 shadow-sm"></span>最高溫且最高降雨</div>
              </div>
              <div className="w-full overflow-x-auto pb-4">
                <div className="relative min-h-[400px]" style={{ width: Math.max(800, chartData.length * 30) + 'px' }}>
                  <Line options={chartOptions} data={chartJsData} />
                </div>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* Game Details Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedGame(null)}>
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
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
                  <span className="text-gray-500">日期</span>
                  <span className="font-medium text-gray-900">{selectedGame.Date}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500">對戰組合</span>
                  <span className="font-medium text-gray-900">{selectedGame.AwayTeam} vs {selectedGame.HomeTeam}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500">場地</span>
                  <span className="font-medium text-gray-900">{selectedGame.Stadium}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500">觀眾人數</span>
                  <span className="font-medium text-blue-600">{selectedGame.Audience.toLocaleString()} 人</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500">最高氣溫</span>
                  <span className="font-medium text-red-500">{selectedGame['MaxTemp(C)']}°C</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500">降雨量</span>
                  <span className="font-medium text-cyan-600">{selectedGame['Rainfall(mm)']} mm</span>
                </div>
                
                {selectedGame['RainProb(%)'] !== undefined && (
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">降雨機率</span>
                    <span className="font-medium text-blue-500">{selectedGame['RainProb(%)']}%</span>
                  </div>
                )}
                
                {selectedGame.Theme && (
                  <div className="col-span-2 flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">主題日</span>
                    <span className="font-medium text-amber-500 flex items-center gap-1">
                      {selectedGame.Theme} ⭐
                    </span>
                  </div>
                )}
                
                {selectedGame.Cheerleaders && (
                  <div className="col-span-2 flex flex-col gap-2 border-b pb-3">
                    <span className="text-gray-500">啦啦隊班表</span>
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
                          <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
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
                    className="flex items-center justify-center w-full gap-2 py-3 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-medium transition-colors"
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
