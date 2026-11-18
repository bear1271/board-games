// 国际象棋的本地简易 AI：在 chess.js 上做 alpha-beta，用于笔记本端或工作站离线时。
// 强的 AI 是工作站上的 Stockfish。
import { Chess } from '../vendor/chess.js';
import { weakPick } from './common.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];

function evaluate(game) {
  // 白方视角
  let s = 0;
  const b = game.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (!p) continue;
    let v = VAL[p.type];
    if (p.type === 'n' || p.type === 'b') v += (CENTER[r] + CENTER[c]) * 5;
    if (p.type === 'p') v += (p.color === 'w' ? 6 - r : r - 1) * 8 + (c === 3 || c === 4 ? 10 : 0);
    s += p.color === 'w' ? v : -v;
  }
  return s;
}

const STOP = {};

// noise / temperature 用于弱化（单位：分，100 = 一个兵）
export function bestMove(fen, { timeMs = 1500, maxDepth = 4, noise = 0, temperature = 0, clamp, rand } = {}) {
  const weak = noise || temperature;
  const game = new Chess(fen);
  const deadline = Date.now() + timeMs;
  const t0 = Date.now();
  let nodes = 0;
  const order = (moves) =>
    moves.sort((a, b) => (b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : -1) -
                         (a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : -1));
  function search(depth, alpha, beta, ply) {
    if ((++nodes & 255) === 0 && Date.now() > deadline) throw STOP;
    if (game.isCheckmate()) return -100000 + ply;
    if (game.isDraw()) return 0;
    if (depth === 0) return evaluate(game) * (game.turn() === 'w' ? 1 : -1);
    let best = -Infinity;
    for (const m of order(game.moves({ verbose: true }))) {
      game.move(m);
      const sc = -search(depth - 1, -beta, -alpha, ply + 1);
      game.undo();
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  }
  let root = order(game.moves({ verbose: true }));
  let result = { move: root[0]?.lan, score: 0, depth: 0 };
  for (let d = 1; d <= maxDepth; d++) {
    try {
      let best = -Infinity, bm = root[0], scored = [];
      for (const m of root) {
        game.move(m);
        const sc = -search(d - 1, -Infinity, weak ? Infinity : -best, 1);
        game.undo();
        scored.push([sc, m]);
        if (sc > best) { best = sc; bm = m; }
      }
      root = scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
      result = { move: bm.lan, score: best, depth: d, scored: scored.map(([v, m]) => [v, m.lan]) };
    } catch (e) {
      if (e !== STOP) throw e;
      break;
    }
  }
  if (weak && result.scored?.length) {
    const m = weakPick(result.scored, { noise, temperature, clamp, rand });
    if (m !== result.move) result.weakened = true;
    result.score = result.scored.find((x) => x[1] === m)[0];
    result.move = m;
  }
  delete result.scored;
  return { ...result, nodes, ms: Date.now() - t0 };
}
