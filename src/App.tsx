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
import { Settings, BarChart2, CloudRain, Thermometer, Users } from 'lucide-react';

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
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showSettings, setShowSettings] = useState(false);

  // Reset filters when view mode changes
  useEffect(() => {
    setSelectedYear('All');
    setSelectedStadiumFilter('All');
    setSelectedDayOfWeek('All');
    setSelectedThemeFilter('All');
    setSelectedOption(''); // Reset selected option to trigger auto-select
  }, [viewMode]);

  // Reset stadium filter when selected team changes
  useEffect(() => {
    setSelectedStadiumFilter('All');
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
          const response = await fetch(gasUrl);
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();
          const flatData = Object.values(data).flat() as GameData[];
          // Use Date + GameSno to prevent 2024 and 2025 games from overwriting each other
          const uniqueData = Array.from(new Map(flatData.map(item => [`${item.Date}-${item.GameSno}`, item])).values());
          
          // Ensure numeric values
          const processedData = uniqueData.map(item => ({
            ...item,
            Audience: Number(item.Audience) || 0,
            'MaxTemp(C)': Number(item['MaxTemp(C)']) || 0,
            'Rainfall(mm)': Number(item['Rainfall(mm)']) || 0,
            Theme: item.Theme || '',
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
      const match = d.Date.match(/^(\d{4})/);
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

  // Filter and sort data
  const chartData = useMemo(() => {
    let filtered = rawData.filter(game => {
      const matchView = viewMode === 'homeTeam' ? game.HomeTeam === selectedOption : game.Stadium === selectedOption;
      if (!matchView) return false;

      const yearMatch = game.Date.match(/^(\d{4})/);
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
  }, [rawData, viewMode, selectedOption, sortMode, selectedYear, selectedStadiumFilter, selectedDayOfWeek, selectedThemeFilter]);

  const maxTemp = chartData.length > 0 ? Math.max(...chartData.map(d => d['MaxTemp(C)'])) : null;
  const maxRain = chartData.length > 0 ? Math.max(...chartData.map(d => d['Rainfall(mm)'])) : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
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
              `人數：${data.Audience.toLocaleString()}`,
              `場地：${data.Stadium}`,
              `對戰：${data.AwayTeam} vs ${data.HomeTeam}`,
              tempLabel,
              rainLabel
            ];

            if (data.Theme) {
              tooltipLines.splice(2, 0, `主題日：${data.Theme} ⭐`);
            }

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
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-blue-600 rounded-full transition-colors"
          aria-label="設定"
        >
          <Settings className="w-5 h-5" />
        </button>
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
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
    </div>
  );
}
