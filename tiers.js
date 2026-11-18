// 七档难度。网页和校准脚本（tools/tournament.js）共用这份配置。
//
// 弱化手段：
//   maxDepth    搜索深度上限
//   noise       给每个候选着法的分数加高斯噪声（标准差），模拟“看错”
//   temperature 按分数做 softmax 抽样，越大越随机，模拟“随手一步”
//   elo         Stockfish 自带的限强（1320–3190）
//   nodes       Pikafish 每步只搜这么多局面
// where: laptop = 浏览器里算；ws = 工作站。smp = 工作站多线程（Lazy SMP）。
// fallback: 工作站连不上时，在笔记本上用的替代配置。

export const NAMES = {
  zh: ['新手', '入门', '初级', '中级', '高级', '大师', '最强'],
  en: ['Novice', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Master', 'Maximum'],
};

export const HINTS = {
  zh: {
    chess: [
      '刚学会走子：经常丢子，看不出一步杀',
      '会基本吃子：偶尔失误，只看两步',
      'Stockfish 限强 Elo 1320，大约俱乐部新会员',
      'Stockfish 限强 Elo 1700，业余中等',
      'Stockfish 限强 Elo 2100，业余强手',
      'Stockfish 限强 Elo 2600，职业水平',
      'Stockfish 全力，3 秒一步',
    ],
    xiangqi: [
      '刚学会走子：经常丢子',
      '会基本吃子：偶尔失误，只看两步',
      '只看三步，偶尔走软',
      '本地引擎全力 1 秒',
      '工作站 30 线程 2 秒',
      'Pikafish，每步只看少量局面',
      'Pikafish 全力，3 秒一步',
    ],
    gomoku: [
      '只看一步，常常漏掉对方的活三',
      '只看一步，偶尔漏防',
      '看三步，偶尔走软',
      '本地全力 1 秒，会找连续冲四杀',
      '工作站 30 线程 2 秒，也会防对方的连续冲四',
      '工作站 30 线程 4 秒',
      '工作站 30 线程 8 秒',
    ],
  },
  en: {
    chess: [
      'Just learned the moves: often hangs pieces, misses mate in one',
      'Knows basic captures: occasional blunders, looks two moves ahead',
      'Stockfish limited to Elo 1320, about a new club player',
      'Stockfish limited to Elo 1700, mid-level amateur',
      'Stockfish limited to Elo 2100, strong amateur',
      'Stockfish limited to Elo 2600, professional level',
      'Full-strength Stockfish, 3 seconds a move',
    ],
    xiangqi: [
      'Just learned the moves: often hangs pieces',
      'Knows basic captures: occasional blunders, looks two moves ahead',
      'Looks three moves ahead, sometimes plays loosely',
      'Local engine at full strength, 1 second a move',
      'Workstation, 30 threads, 2 seconds a move',
      'Pikafish, searching only a few positions a move',
      'Full-strength Pikafish, 3 seconds a move',
    ],
    gomoku: [
      "Looks one move ahead, often misses the opponent's open three",
      'Looks one move ahead, occasionally misses a defence',
      'Looks three moves ahead, sometimes plays loosely',
      'Local engine at full strength, 1 second; finds four-in-a-row combinations',
      "Workstation, 30 threads, 2 seconds; also defends against the opponent's combinations",
      'Workstation, 30 threads, 4 seconds',
      'Workstation, 30 threads, 8 seconds',
    ],
  },
};

export const TIERS = {
  chess: [
    { where: 'laptop', timeMs: 300, maxDepth: 1, noise: 150, temperature: 60, clamp: 1500 },
    { where: 'laptop', timeMs: 600, maxDepth: 2, noise: 60, temperature: 25 },
    { where: 'ws', timeMs: 300, elo: 1320, fallback: { timeMs: 1500, maxDepth: 3 } },
    { where: 'ws', timeMs: 300, elo: 1700, fallback: { timeMs: 2000, maxDepth: 4 } },
    { where: 'ws', timeMs: 500, elo: 2100, fallback: { timeMs: 2000, maxDepth: 4 } },
    { where: 'ws', timeMs: 1000, elo: 2600, fallback: { timeMs: 3000, maxDepth: 5 } },
    { where: 'ws', timeMs: 3000, skill: 20, fallback: { timeMs: 3000, maxDepth: 5 } },
  ],
  xiangqi: [
    { where: 'laptop', timeMs: 300, maxDepth: 1, noise: 150, temperature: 60, clamp: 1500 },
    { where: 'laptop', timeMs: 500, maxDepth: 2, noise: 60, temperature: 25 },
    { where: 'laptop', timeMs: 800, maxDepth: 3, noise: 20, temperature: 8 },
    { where: 'laptop', timeMs: 1000 },
    { where: 'ws', timeMs: 2000, smp: true, fallback: { timeMs: 2000 } },
    { where: 'ws', engine: 'pikafish', nodes: 20000, timeMs: 1000, fallback: { timeMs: 3000 } },
    { where: 'ws', engine: 'pikafish', timeMs: 3000, fallback: { timeMs: 3000 } },
  ],
  gomoku: [
    { where: 'laptop', timeMs: 300, maxDepth: 1, noise: 12000, temperature: 6000, clamp: 2e4 },
    { where: 'laptop', timeMs: 500, maxDepth: 1, noise: 2000, temperature: 600, clamp: 1e5 },
    { where: 'laptop', timeMs: 800, maxDepth: 3, noise: 800, temperature: 300 },
    { where: 'laptop', timeMs: 1000, vcf: 'attack' },
    { where: 'ws', timeMs: 2000, vcf: 'both', smp: true, fallback: { timeMs: 2000, vcf: 'both' } },
    { where: 'ws', timeMs: 4000, vcf: 'both', smp: true, fallback: { timeMs: 3000, vcf: 'both' } },
    { where: 'ws', timeMs: 8000, vcf: 'both', smp: true, fallback: { timeMs: 3000, vcf: 'both' } },
  ],
};

// 公开版（没有工作站）：国际象棋的工作站档改用浏览器里的 Stockfish（精简版），参数不变；
// 象棋、五子棋的工作站档改为浏览器里单线程搜索，用下面的时间。
export const PUBLIC_OVERRIDES = {
  xiangqi: { 4: { timeMs: 2000 }, 5: { timeMs: 4000 }, 6: { timeMs: 8000 } },
  gomoku: { 4: { timeMs: 2000, vcf: 'both' }, 5: { timeMs: 4000, vcf: 'both' }, 6: { timeMs: 8000, vcf: 'both' } },
};
export const PUBLIC_HINTS = {
  zh: {
    chess: { 6: 'Stockfish 浏览器精简版全力，3 秒一步' },
    xiangqi: { 4: '浏览器里全力 2 秒', 5: '浏览器里全力 4 秒', 6: '浏览器里全力 8 秒' },
    gomoku: { 4: '浏览器里全力 2 秒，也会防对方的连续冲四', 5: '浏览器里全力 4 秒', 6: '浏览器里全力 8 秒' },
  },
  en: {
    chess: { 6: 'In-browser Stockfish (lite) at full strength, 3 seconds a move' },
    xiangqi: { 4: 'Full strength in your browser, 2 seconds a move', 5: 'Full strength in your browser, 4 seconds a move', 6: 'Full strength in your browser, 8 seconds a move' },
    gomoku: { 4: "Full strength in your browser, 2 seconds; also defends against the opponent's combinations", 5: 'Full strength in your browser, 4 seconds a move', 6: 'Full strength in your browser, 8 seconds a move' },
  },
};
