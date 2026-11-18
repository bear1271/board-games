# Three Board Games · 三棋对弈

Chess, xiangqi and gomoku against an AI with seven difficulty levels. Everything runs in the browser; there is no server.

国际象棋、象棋、五子棋人机对弈，七档难度。全部在浏览器里计算，没有服务器。

## Engines

- **Chess**: rules by [chess.js](https://github.com/jhlywa/chess.js). The two lowest levels use a small alpha-beta search written for this project; higher levels use [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19 (lite, single-threaded WebAssembly), with `UCI_Elo` limits for the middle levels.
- **Xiangqi** and **gomoku**: engines written for this project (`engine/`). Xiangqi uses alpha-beta with PVS, null-move pruning, LMR, quiescence search and a transposition table; gomoku uses pattern scoring, alpha-beta and a VCF (continuous-four) search.
- Lower levels are weakened by limiting depth, adding noise to move scores, and sampling moves by a softmax temperature (`tiers.js`).

## Licenses

- Code written for this project: MIT (see `LICENSE`).
- `vendor/chess.js`: BSD 2-Clause, © Jeff Hlywa.
- `vendor/stockfish/`: GPL-3.0 (see `vendor/stockfish/COPYING.txt`). Source: https://github.com/nmrugg/stockfish.js (v19.0.1) and https://github.com/official-stockfish/Stockfish.
