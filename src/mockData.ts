export interface GameData {
  GameSno: string;
  Date: string;
  Stadium: string;
  AwayTeam: string;
  HomeTeam: string;
  Audience: number;
  "MaxTemp(C)": number;
  "Rainfall(mm)": number;
  Theme?: string;
}

export const generateMockData = (): Record<string, GameData[]> => {
  const teams = ["中信兄弟", "統一獅", "樂天桃猿", "富邦悍將", "味全龍", "台鋼雄鷹"];
  const stadiums = ["臺北大巨蛋", "新莊棒球場", "桃園棒球場", "洲際棒球場", "台南棒球場", "天母棒球場", "澄清湖棒球場"];
  
  const result: Record<string, GameData[]> = {};
  
  teams.forEach(team => {
    const teamData: GameData[] = [];
    for (let i = 1; i <= 30; i++) {
      const isHome = Math.random() > 0.5;
      const homeTeam = isHome ? team : teams[Math.floor(Math.random() * teams.length)];
      const awayTeam = isHome ? teams[Math.floor(Math.random() * teams.length)] : team;
      
      if (homeTeam === awayTeam) continue;
      
      const date = new Date(2024, 3, i + Math.floor(Math.random() * 150));
      
      const mockThemes = ["女孩日", "動漫祭", "鄉民大會", "復古日", "寵物日"];
      const hasTheme = Math.random() > 0.8;
      
      teamData.push({
        GameSno: `G${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        Date: date.toISOString().split('T')[0],
        Stadium: stadiums[Math.floor(Math.random() * stadiums.length)],
        AwayTeam: awayTeam,
        HomeTeam: homeTeam,
        Audience: Math.floor(Math.random() * 15000) + 3000 + (hasTheme ? 5000 : 0), // 主題日人數較多
        "MaxTemp(C)": Math.floor(Math.random() * 15) + 20,
        "Rainfall(mm)": Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0,
        Theme: hasTheme ? mockThemes[Math.floor(Math.random() * mockThemes.length)] : "",
      });
    }
    // Sort by date
    teamData.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
    result[team] = teamData;
  });
  
  return result;
};
