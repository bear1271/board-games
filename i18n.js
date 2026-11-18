// 界面文字（中文 / English）。语言来源：网址 ?lang=en|zh > 上次的选择 > 浏览器语言。
const DICT = {
  zh: {
    title: '三棋对弈',
    'game.chess': '国际象棋', 'game.xiangqi': '象棋', 'game.gomoku': '五子棋',
    'btn.new': '新局', 'btn.undo': '悔棋', 'btn.flip': '翻转棋盘', 'btn.lang': 'English',
    'card.game': '对局', 'card.ws': '工作站', 'card.last': '上一步 AI', 'card.log': '分工记录', 'card.moves': '棋谱',
    'label.mode': '模式', 'label.level': '难度', 'label.where': '计算位置', 'label.addr': '地址',
    'mode.first': '我执先手', 'mode.second': '我执后手', 'mode.pvp': '双人对弈', 'mode.ava': 'AI 自己下（观战）',
    'where.auto': '自动分工', 'where.laptop': '只用笔记本', 'where.ws': '只用工作站',
    'auto.level': '赢了升一档，输了降一档',
    'ws.checking': '检测中…',
    'ws.online': '在线 · {cpus} 核（搜索用 {threads} 线程）· 往返 {rtt} ms',
    'ws.engines': 'Stockfish {sf} · Pikafish {pf} · 负载 {load}',
    'ws.ok': '可用', 'ws.missing': '未安装',
    'ws.offline': '连不上，AI 全部改在笔记本上算',
    'ws.public': '公开版没有连工作站，AI 全部在你的浏览器里算',
    'loc.laptop': '笔记本', 'loc.ws': '工作站', 'loc.browser': '浏览器',
    'why.forced': '{what}，{loc}直接算',
    'why.manualLaptopSub': '手动指定{loc}（{tier}档本该用工作站，这里用本地引擎代替，会弱一些）',
    'why.manualLaptop': '手动指定{loc}',
    'why.wsDown': '指定了工作站但连不上，退回{loc}',
    'why.chessLocalOnly': '{tier}档用的是本地小引擎，工作站上没有，仍在{loc}算',
    'why.manualWs': '手动指定工作站',
    'why.wsOffline': '工作站离线，{tier}档改用本地引擎代替',
    'why.toWs': '{tier}档要 {what}，交给工作站',
    'why.threads': '{n} 线程搜索',
    'why.local': '{tier}档本地就够，省一次网络往返',
    'why.wsError': '；工作站出错（{err}），改用{loc}',
    'why.sfFallback': '工作站不可用，{tier}档改用浏览器里的 Stockfish',
    'why.sfManual': '手动指定笔记本，{tier}档用浏览器里的 Stockfish',
    'why.sfBrowser': '{tier}档用浏览器里的 Stockfish',
    'why.browser': '{tier}档在你的浏览器里算',
    'why.browserDeep': '{tier}档在你的浏览器里深搜',
    'card.logPublic': '计算记录',
    'foot.credits': '国际象棋规则用 chess.js，强档 AI 用 Stockfish.js（GPLv3）。象棋和五子棋的 AI 是自己写的。',
    'foot.home': '← 返回主页',
    'forced.one': '只有一步可走', 'forced.center': '第一手下天元', 'forced.win': '可以直接连五', 'forced.block': '必须堵对方的冲四',
    'side.white': '白方', 'side.black': '黑方', 'side.red': '红方',
    'over.mate': '将死，{side}胜', 'over.stalemate': '逼和', 'over.threefold': '三次重复，和棋',
    'over.material': '子力不足，和棋', 'over.fifty': '和棋（50 回合）',
    'over.xqMate': '将死，{side}胜', 'over.xqStuck': '困毙，{side}胜', 'over.xqLong': '超过 150 回合，判和',
    'over.xqRepeat': '同一局面出现三次，判和', 'over.five': '{side}连成五子，获胜', 'over.full': '棋盘下满，和棋',
    'promote': '升变为：q 后 / r 车 / b 象 / n 马',
    'river.l': '楚 河', 'river.r': '汉 界',
    'status.thinking': '{side}（AI）思考中', 'status.turn': '轮到{side}',
    'moves.none': '尚未开始', 'think.none': '还没有 AI 走棋',
    'score.mateIn': '{n} 步杀', 'score.matedIn': '被 {n} 步杀', 'score.win': '已算出必胜', 'score.loss': '已算出必败',
    'score.xqWin': '已算出杀棋', 'score.xqLoss': '已算出被杀',
    'err.ai': 'AI 出错：{err}', 'err.illegal': '引擎给出非法着法 {m}',
    'log.move': '第 {n} 手 {m}：{loc}，{why}',
    'think.depth': '深度 {d}', 'think.deepest': '（最深 {d}）', 'think.nodes': '{n} 个局面', 'think.threads': '{n} 线程',
    'think.time': '计算 {ms} ms，总耗时 {total} ms', 'think.net': '，网络和排队 {ms} ms',
    'think.eval': '评估（AI 视角）：{v}', 'think.reason': '判断：{v}', 'think.weak': '按档位故意没走最佳着', 'think.pv': '主要变例：{v}',
    'engine.local': '本地搜索', 'engine.chessLocal': '本地 alpha-beta', 'engine.smp': 'Lazy SMP', 'engine.single': '单线程',
    'reason.five': '连五', 'reason.block': '堵冲四', 'reason.vcf': 'VCF 杀', 'reason.avoid': '避开对方 VCF',
    'adjust.won': '你赢了，难度调到「{tier}」，下一局生效', 'adjust.lost': '你输了，难度调到「{tier}」，下一局生效',
  },
  en: {
    title: 'Three Board Games',
    'game.chess': 'Chess', 'game.xiangqi': 'Xiangqi', 'game.gomoku': 'Gomoku',
    'btn.new': 'New game', 'btn.undo': 'Undo', 'btn.flip': 'Flip board', 'btn.lang': '中文',
    'card.game': 'Game', 'card.ws': 'Workstation', 'card.last': 'Last AI move', 'card.log': 'Where each move ran', 'card.moves': 'Moves',
    'label.mode': 'Mode', 'label.level': 'Level', 'label.where': 'Compute on', 'label.addr': 'Address',
    'mode.first': 'I move first', 'mode.second': 'I move second', 'mode.pvp': 'Two players', 'mode.ava': 'AI vs AI (watch)',
    'where.auto': 'Auto', 'where.laptop': 'Laptop only', 'where.ws': 'Workstation only',
    'auto.level': 'Level up after a win, down after a loss',
    'ws.checking': 'Checking…',
    'ws.online': 'Online · {cpus} cores ({threads} search threads) · {rtt} ms round trip',
    'ws.engines': 'Stockfish {sf} · Pikafish {pf} · load {load}',
    'ws.ok': 'ready', 'ws.missing': 'missing',
    'ws.offline': 'Unreachable; every AI move runs on the laptop',
    'ws.public': 'The public version has no workstation; every AI move runs in your browser',
    'loc.laptop': 'laptop', 'loc.ws': 'workstation', 'loc.browser': 'browser',
    'why.forced': '{what}, computed on the {loc}',
    'why.manualLaptopSub': 'Set to {loc} ({tier} normally uses the workstation; a weaker local engine stands in)',
    'why.manualLaptop': 'Set to {loc}',
    'why.wsDown': 'Set to workstation, but it is unreachable; using the {loc}',
    'why.chessLocalOnly': '{tier} uses the small local engine, which the workstation lacks; staying on the {loc}',
    'why.manualWs': 'Set to workstation',
    'why.wsOffline': 'Workstation offline; a local engine stands in for {tier}',
    'why.toWs': '{tier} needs {what}; sent to the workstation',
    'why.threads': '{n}-thread search',
    'why.local': '{tier} is light enough to run locally, saving a network round trip',
    'why.wsError': '; workstation error ({err}), using the {loc}',
    'why.sfFallback': 'Workstation unavailable; {tier} uses in-browser Stockfish',
    'why.sfManual': 'Set to laptop; {tier} uses in-browser Stockfish',
    'why.sfBrowser': '{tier} uses Stockfish running in your browser',
    'why.browser': '{tier} runs in your browser',
    'why.browserDeep': '{tier} searches deeply in your browser',
    'card.logPublic': 'Engine log',
    'foot.credits': 'Chess rules by chess.js; strong chess AI by Stockfish.js (GPLv3). The xiangqi and gomoku engines are written from scratch.',
    'foot.home': '← Back to home',
    'forced.one': 'Only one legal move', 'forced.center': 'First stone goes in the center', 'forced.win': 'Five in a row is available', 'forced.block': 'Must block a four',
    'side.white': 'White', 'side.black': 'Black', 'side.red': 'Red',
    'over.mate': 'Checkmate, {side} wins', 'over.stalemate': 'Stalemate', 'over.threefold': 'Draw by threefold repetition',
    'over.material': 'Draw by insufficient material', 'over.fifty': 'Draw (fifty-move rule)',
    'over.xqMate': 'Checkmate, {side} wins', 'over.xqStuck': 'No legal moves, {side} wins', 'over.xqLong': 'Draw after 150 moves',
    'over.xqRepeat': 'Draw: the same position occurred three times', 'over.five': '{side} made five in a row and wins', 'over.full': 'Board full, draw',
    'promote': 'Promote to: q queen / r rook / b bishop / n knight',
    'river.l': 'River', 'river.r': 'Border',
    'status.thinking': '{side} (AI) is thinking', 'status.turn': '{side} to move',
    'moves.none': 'No moves yet', 'think.none': 'No AI move yet',
    'score.mateIn': 'mate in {n}', 'score.matedIn': 'mated in {n}', 'score.win': 'forced win found', 'score.loss': 'forced loss found',
    'score.xqWin': 'mate found', 'score.xqLoss': 'getting mated',
    'err.ai': 'AI error: {err}', 'err.illegal': 'Engine returned an illegal move {m}',
    'log.move': 'Move {n} {m}: {loc}, {why}',
    'think.depth': 'depth {d}', 'think.deepest': ' (deepest {d})', 'think.nodes': '{n} positions', 'think.threads': '{n} thread(s)',
    'think.time': 'search {ms} ms, total {total} ms', 'think.net': ', network and queue {ms} ms',
    'think.eval': 'Evaluation (AI side): {v}', 'think.reason': 'Reason: {v}', 'think.weak': 'Deliberately not the best move, per level', 'think.pv': 'Main line: {v}',
    'engine.local': 'local search', 'engine.chessLocal': 'local alpha-beta', 'engine.smp': 'Lazy SMP', 'engine.single': 'single thread',
    'reason.five': 'five in a row', 'reason.block': 'block the four', 'reason.vcf': 'VCF win', 'reason.avoid': "avoid opponent's VCF",
    'adjust.won': 'You won; level set to "{tier}" for the next game', 'adjust.lost': 'You lost; level set to "{tier}" for the next game',
  },
};

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  try { const s = localStorage.getItem('lang'); if (s === 'en' || s === 'zh') return s; } catch {}
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export let lang = pickLang();
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch {}
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  history.replaceState(null, '', u);
}
export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.zh[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
// 大数字：中文用万/亿，英文用 K/M
export function fmtNum(n) {
  n = n ?? 0;
  if (lang === 'zh') return n >= 1e8 ? (n / 1e8).toFixed(1) + ' 亿' : n >= 1e4 ? (n / 1e4).toFixed(1) + ' 万' : String(n);
  return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
}
// 页面上带 data-i18n 的元素
export function applyStatic() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}
