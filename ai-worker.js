// 笔记本端的 AI 线程：在浏览器后台算，不卡界面。
import * as X from './engine/xiangqi.js';
import * as G from './engine/gomoku.js';
import * as L from './engine/chess-local.js';

self.onmessage = ({ data }) => {
  const { id, game, state, opts } = data;
  let r;
  try {
    if (game === 'chess') {
      r = L.bestMove(state.fen, { maxDepth: 5, ...opts });
      r.engine = 'chessLocal';
    } else if (game === 'xiangqi') {
      const s = X.fromFen(state.fen);
      s.history = state.history || [];
      r = X.bestMove(s, { maxDepth: 64, ...opts });
      r.engine = 'local';
    } else {
      const s = { board: Int8Array.from(state.board), side: state.side, moves: state.moves };
      r = G.bestMove(s, { maxDepth: 20, ...opts });
      r.engine = 'local';
    }
    delete r.byDepth;
    self.postMessage({ id, ok: true, ...r, threads: 1 });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e) });
  }
};
