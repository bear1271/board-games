// 五子棋规则与 AI（浏览器和 Node 通用）。15x15，无禁手，连成五子或以上获胜。
// 黑 = 1 先行，白 = -1。

import { TT, STOP, zobrist, weakPick } from './common.js';
export const SIZE = 15;
export const BLACK = 1, WHITE = -1;
const MATE = 1e9;
const DIRS = [1, SIZE, SIZE + 1, SIZE - 1];
const DX = [1, 0, 1, -1], DY = [0, 1, 1, 1];

export function initialState() {
  return { board: new Int8Array(SIZE * SIZE), side: BLACK, moves: [] };
}

export function applyMove(s, i) {
  const board = Int8Array.from(s.board);
  board[i] = s.side;
  return { board, side: -s.side, moves: [...s.moves, i] };
}

// 刚落在 i 的子是否连成五
export function isFive(board, i) {
  const p = board[i], x = i % SIZE, y = (i / SIZE) | 0;
  for (let d = 0; d < 4; d++) {
    let n = 1;
    for (const sgn of [1, -1]) {
      let cx = x + DX[d] * sgn, cy = y + DY[d] * sgn;
      while (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && board[cy * SIZE + cx] === p) {
        n++; cx += DX[d] * sgn; cy += DY[d] * sgn;
      }
    }
    if (n >= 5) return true;
  }
  return false;
}

export function winLine(board, i) {
  const p = board[i], x = i % SIZE, y = (i / SIZE) | 0;
  for (let d = 0; d < 4; d++) {
    const line = [i];
    for (const sgn of [1, -1]) {
      let cx = x + DX[d] * sgn, cy = y + DY[d] * sgn;
      while (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && board[cy * SIZE + cx] === p) {
        line.push(cy * SIZE + cx); cx += DX[d] * sgn; cy += DY[d] * sgn;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

// ---------------- 棋形 ----------------
const S = { FIVE: 1e7, OPEN4: 1e5, FOUR: 1.2e4, OPEN3: 4e3, THREE: 600, OPEN2: 300, TWO: 40, ONE: 5 };
const PATTERNS = [
  ['11111', S.FIVE],
  ['011110', S.OPEN4],
  ['11110', S.FOUR], ['01111', S.FOUR], ['11011', S.FOUR], ['10111', S.FOUR], ['11101', S.FOUR],
  ['001110', S.OPEN3], ['011100', S.OPEN3], ['011010', S.OPEN3], ['010110', S.OPEN3],
  ['11100', S.THREE], ['00111', S.THREE], ['11010', S.THREE], ['01011', S.THREE],
  ['10110', S.THREE], ['01101', S.THREE], ['10011', S.THREE], ['11001', S.THREE],
  ['10101', S.THREE], ['01110', S.THREE],
  ['001100', S.OPEN2], ['011000', S.OPEN2], ['000110', S.OPEN2],
  ['010100', S.OPEN2], ['001010', S.OPEN2], ['010010', S.OPEN2],
  ['11000', S.TWO], ['00011', S.TWO], ['10100', S.TWO], ['00101', S.TWO], ['01100', S.TWO], ['00110', S.TWO],
];

// 中心两侧各 5 格，每格 3 种状态（空/己方/对方或边界）编码成一个数，查表得棋形分。
// 表在第一次用到某种形状时才计算。
const TABLE = new Uint32Array(3 ** 10);

// 假设 player 落在 i，这一方向上能形成的最好棋形
function dirScore(board, i, d, player) {
  const x = i % SIZE, y = (i / SIZE) | 0;
  let key = 0;
  for (let k = -5; k <= 5; k++) {
    if (k === 0) continue;
    const cx = x + DX[d] * k, cy = y + DY[d] * k;
    let digit;
    if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) digit = 2;
    else { const v = board[cy * SIZE + cx]; digit = v === player ? 1 : v === 0 ? 0 : 2; }
    key = key * 3 + digit;
  }
  return TABLE[key] || (TABLE[key] = shapeScore(key));
}

function shapeScore(key) {
  const cells = [];
  for (let k = 0; k < 10; k++) { cells.unshift(key % 3); key = (key / 3) | 0; }
  cells.splice(5, 0, 1);
  const str = cells.join('');
  // 只认包含中心（下标 5）的棋形
  for (const [pat, sc] of PATTERNS) {
    let from = 0, at;
    while ((at = str.indexOf(pat, from)) !== -1) {
      if (at <= 5 && at + pat.length > 5 && pat[5 - at] === '1') return sc;
      from = at + 1;
    }
  }
  return S.ONE;
}

export function pointScore(board, i, player) {
  let sum = 0, fours = 0, threes = 0;
  for (let d = 0; d < 4; d++) {
    const s = dirScore(board, i, d, player);
    if (s >= S.FIVE) return S.FIVE;
    if (s >= S.FOUR) fours++;
    else if (s >= S.OPEN3) threes++;
    sum += s;
  }
  if (fours >= 2 || (fours && threes)) sum += 8e4; // 双四、四三
  else if (threes >= 2) sum += 3e4; // 双三
  return sum;
}

// 已有子周围两格内的空点
function candidates(board) {
  const seen = new Uint8Array(SIZE * SIZE), out = [];
  let any = false;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!board[i]) continue;
    any = true;
    const x = i % SIZE, y = (i / SIZE) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) continue;
      const j = cy * SIZE + cx;
      if (!board[j] && !seen[j]) { seen[j] = 1; out.push(j); }
    }
  }
  if (!any) out.push(((SIZE / 2) | 0) * SIZE + ((SIZE / 2) | 0));
  return out;
}

// 打分后排序的候选点：进攻分 + 防守分
function scoredMoves(board, side) {
  const res = [];
  for (const i of candidates(board)) {
    const me = pointScore(board, i, side), op = pointScore(board, i, -side);
    res.push({ i, me, op, s: me + op * 0.9 });
  }
  res.sort((a, b) => b.s - a.s);
  return res;
}

// ---------------- VCF：连续冲四取胜 ----------------
// 进攻方每一步都冲四（下一步能连五），防守方只能去堵，直到形成两个连五点（防不住）。
// 返回第一步落点，没找到返回 -1。

// 在 i 落子后，沿经过 i 的四条线找 player 的连五点
function fivePointsThrough(board, i, player, out) {
  const x = i % SIZE, y = (i / SIZE) | 0;
  for (let d = 0; d < 4; d++) for (const sgn of [1, -1]) for (let k = 1; k <= 4; k++) {
    const cx = x + DX[d] * k * sgn, cy = y + DY[d] * k * sgn;
    if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) break;
    const j = cy * SIZE + cx;
    if (board[j] === -player) break;
    if (board[j] || out.includes(j)) continue;
    board[j] = player;
    if (isFive(board, j)) out.push(j);
    board[j] = 0;
  }
  return out;
}

function anyFivePoint(board, player) {
  for (const i of candidates(board)) {
    board[i] = player;
    const f = isFive(board, i);
    board[i] = 0;
    if (f) return i;
  }
  return -1;
}

export function vcf(board, side, { maxDepth = 14, deadline = Infinity, nodes = { n: 0 } } = {}) {
  const win = anyFivePoint(board, side);
  if (win >= 0) return win;
  const oppFive = anyFivePoint(board, -side);
  return vcfInner(board, side, maxDepth, deadline, nodes, oppFive);
}

function vcfInner(board, side, depth, deadline, nodes, oppFive) {
  if (depth <= 0) return -1;
  if ((++nodes.n & 255) === 0 && Date.now() > deadline) return -1;
  let cands = candidates(board);
  if (oppFive >= 0) cands = [oppFive]; // 对方已有冲四，只能先堵（顺便冲四才继续）
  for (const i of cands) {
    if (board[i]) continue;
    let four = false;
    for (let d = 0; d < 4 && !four; d++) if (dirScore(board, i, d, side) >= S.FOUR) four = true;
    if (!four) continue;
    board[i] = side;
    const fives = fivePointsThrough(board, i, side, []);
    let ok = false;
    if (fives.length >= 2) {
      ok = true;
    } else if (fives.length === 1) {
      const k = fives[0];
      board[k] = -side; // 对方被迫堵
      if (!isFive(board, k)) {
        // 对方堵的这一手如果形成冲四，我们下一步必须先堵它
        const counter = fivePointsThrough(board, k, -side, []);
        ok = counter.length <= 1 && vcfInner(board, side, depth - 1, deadline, nodes, counter.length ? counter[0] : -1) >= 0;
      }
      board[k] = 0;
    }
    board[i] = 0;
    if (ok) return i;
  }
  return -1;
}

// ---------------- 搜索 ----------------
const Z1 = zobrist(SIZE * SIZE * 2, 0x2545f491), Z2 = zobrist(SIZE * SIZE * 2, 0x68e31da4);
const zi = (i, p) => i * 2 + (p === BLACK ? 0 : 1);
const SIDE1 = 0x3c6ef372 | 0, SIDE2 = 0x1b873593 | 0;

export class Searcher {
  constructor({ tt = null, stop = null, helper = 0, width = 12 } = {}) {
    this.tt = tt || new TT(19);
    this.stop = stop;
    this.helper = helper;
    this.width = width;
    this.nodes = 0;
  }

  checkTime() {
    if (Date.now() > this.deadline || (this.stop && this.stop[0])) throw STOP;
  }

  // 静态评估（行棋方视角）
  leaf(list) {
    let myMax = 0, opFive = 0;
    for (const m of list) {
      if (m.me > myMax) myMax = m.me;
      if (m.op >= S.FIVE) opFive++;
    }
    if (myMax >= S.FIVE) return MATE / 2;
    if (opFive >= 2) return -MATE / 2;
    if (!opFive && myMax >= S.OPEN4) return MATE / 4;
    // 单个冲四只是逼对方堵一手，不能按连五算分，否则 AI 会到处乱冲四。
    // 对方的冲五点（我必须堵）不计入对方威胁，但我因此失去先手，进攻分打折。
    const cap = (v) => Math.min(v, 1.5e5);
    const me = list.map((m) => cap(m.me)).sort((a, b) => b - a);
    const op = list.filter((m) => m.op < S.FIVE).map((m) => m.op).sort((a, b) => b - a);
    let mySum = 0, opSum = 0;
    for (let k = 0; k < 3; k++) { mySum += me[k] || 0; opSum += op[k] || 0; }
    return Math.round(mySum * (opFive ? 0.6 : 1.2) - opSum);
  }

  negamax(board, side, depth, alpha, beta, h1, h2) {
    if ((++this.nodes & 255) === 0) this.checkTime();
    const list = scoredMoves(board, side);
    if (!list.length) return 0;
    if (list[0].me >= S.FIVE || list.some((m) => m.me >= S.FIVE)) return MATE - 1;
    if (depth <= 0) return this.leaf(list);

    const tt = this.tt;
    let ttMove = -1;
    if (tt.probe(h1, h2)) {
      ttMove = tt.move;
      if (tt.depth >= depth) {
        const v = tt.score;
        if (tt.flag === 0) return v;
        if (tt.flag === 1 && v >= beta) return v;
        if (tt.flag === 2 && v <= alpha) return v;
      }
    }
    // 对方有冲五点时只能去堵
    let moves = list.filter((m) => m.op >= S.FIVE);
    if (!moves.length) {
      moves = list.slice(0, this.width);
      if (ttMove >= 0) {
        const k = moves.findIndex((m) => m.i === ttMove);
        if (k > 0) moves.unshift(moves.splice(k, 1)[0]);
      }
      if (this.helper && moves.length > 2) { // helper 线程交换前几个着法的顺序
        const j = 1 + (this.helper % (moves.length - 1));
        [moves[1], moves[j]] = [moves[j], moves[1]];
      }
    }
    const a0 = alpha;
    let best = -MATE, bestMove = -1, first = true;
    for (const m of moves) {
      board[m.i] = side;
      const n1 = h1 ^ Z1[zi(m.i, side)] ^ SIDE1, n2 = h2 ^ Z2[zi(m.i, side)] ^ SIDE2;
      let sc;
      if (first) sc = -this.negamax(board, -side, depth - 1, -beta, -alpha, n1, n2);
      else {
        sc = -this.negamax(board, -side, depth - 1, -alpha - 1, -alpha, n1, n2);
        if (sc > alpha && sc < beta) sc = -this.negamax(board, -side, depth - 1, -beta, -alpha, n1, n2);
      }
      board[m.i] = 0;
      first = false;
      if (sc > MATE / 2) sc -= 1; // 越快赢越好
      if (sc > best) { best = sc; bestMove = m.i; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    tt.store(h1, h2, depth, best <= a0 ? 2 : best >= beta ? 1 : 0, best, bestMove);
    return best;
  }

  // vcf: 'attack' 先找自己的 VCF；'both' 还检查走完后对方有没有 VCF
  searchRoot(s, { timeMs = 1000, maxDepth = 20, exactRoot = false, vcf: useVcf = null, onDepth } = {}) {
    this.deadline = Date.now() + timeMs;
    this.nodes = 0;
    const t0 = Date.now();
    const board = Int8Array.from(s.board);
    let h1 = s.side === BLACK ? 0 : SIDE1, h2 = s.side === BLACK ? 0 : SIDE2;
    for (let i = 0; i < board.length; i++) if (board[i]) { h1 ^= Z1[zi(i, board[i])]; h2 ^= Z2[zi(i, board[i])]; }
    const all = scoredMoves(board, s.side);
    const done = (move, score, why) => ({ move, score, depth: 0, nodes: this.nodes, ms: Date.now() - t0, scored: [[score, move]], why });
    const win = all.find((m) => m.me >= S.FIVE);
    if (win) return done(win.i, MATE, 'five');
    const blocks = all.filter((m) => m.op >= S.FIVE);
    if (blocks.length === 1 && !exactRoot) return done(blocks[0].i, 0, 'block');
    if (useVcf && !blocks.length && !this.helper) {
      const v = vcf(board, s.side, { deadline: Date.now() + timeMs / 4 });
      if (v >= 0) return done(v, MATE / 2, 'vcf');
    }
    let root = blocks.length ? blocks : all.slice(0, Math.max(this.width * 2, 20));
    let order = root.map((m) => m.i);
    if (this.helper && order.length > 2) order = [order[0], ...order.slice(1).reverse()];
    let result = { move: order[0], score: 0, depth: 0, scored: order.map((i) => [0, i]) };
    const startDepth = this.helper ? 1 + 2 * (this.helper & 1) : 1;
    for (let d = startDepth; d <= maxDepth; d += 2) { // 只搜奇数层，叶子总是对方行棋，各层分数可比
      let best = -MATE - 1, bestMove = order[0];
      const scored = [];
      try {
        for (const i of order) {
          board[i] = s.side;
          const n1 = h1 ^ Z1[zi(i, s.side)] ^ SIDE1, n2 = h2 ^ Z2[zi(i, s.side)] ^ SIDE2;
          let sc;
          if (exactRoot || !scored.length) {
            sc = -this.negamax(board, -s.side, d - 1, -MATE - 1, exactRoot ? MATE + 1 : -best, n1, n2);
          } else {
            sc = -this.negamax(board, -s.side, d - 1, -best - 1, -best, n1, n2);
            if (sc > best) sc = -this.negamax(board, -s.side, d - 1, -MATE - 1, -best, n1, n2);
          }
          board[i] = 0;
          scored.push([sc, i]);
          if (sc > best) { best = sc; bestMove = i; }
        }
      } catch (e) {
        if (e !== STOP) throw e;
        board.set(s.board);
        break;
      }
      order = scored.slice().sort((a, b) => b[0] - a[0]).map((x) => x[1]);
      result = { move: bestMove, score: best, depth: d, scored };
      onDepth && onDepth({ depth: d, score: best, move: bestMove, nodes: this.nodes, ms: Date.now() - t0 });
      if (Math.abs(best) >= MATE / 4) break;
    }
    // 防守：如果选中的着法让对方有 VCF，换一个让对方没有 VCF 的
    if (useVcf === 'both' && !this.helper && !exactRoot) {
      const ranked = result.scored.slice().sort((a, b) => b[0] - a[0]);
      const until = Date.now() + Math.max(200, timeMs / 4);
      for (const [sc, i] of ranked.slice(0, 8)) {
        board[i] = s.side;
        const threat = vcf(board, -s.side, { deadline: until });
        board[i] = 0;
        if (threat < 0) { if (i !== result.move) { result.move = i; result.score = sc; result.why = 'avoid'; } break; }
        if (Date.now() > until) break;
      }
    }
    result.nodes = this.nodes;
    result.ms = Date.now() - t0;
    return result;
  }
}

// opts: timeMs, maxDepth, width, vcf, noise, temperature（弱化用，单位同棋形分，活三 = 4000）
export function bestMove(s, opts = {}) {
  const weak = opts.noise || opts.temperature;
  const r = new Searcher(opts).searchRoot(s, { ...opts, exactRoot: weak });
  if (weak && r.scored?.length > 1) {
    const m = weakPick(r.scored, { noise: opts.noise, temperature: opts.temperature, clamp: opts.clamp ?? 2e5, rand: opts.rand });
    if (m !== r.move) r.weakened = true;
    r.score = r.scored.find((x) => x[1] === m)[0];
    r.move = m;
  }
  delete r.scored;
  return r;
}

export function rootCandidates(s, n = 24) {
  return scoredMoves(s.board, s.side).slice(0, n).map((m) => m.i);
}
