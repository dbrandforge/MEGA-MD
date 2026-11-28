import { createDuelPlugin } from '../lib/duelGamePlugin.js';
import { chessInitialState, makeChessMove, chessStatus, renderChess } from '../lib/chessEngine.js';

export default createDuelPlugin({
  command: 'chess',
  key: 'chessSessions',
  rules: "Rules: legal piece movement, king safety, castling, en passant, promotion, check, checkmate and stalemate. Add q, r, b or n after the destination square to choose a promotion piece.",
  description: 'Play independent two-player chess matches with legal moves, check, checkmate and stalemate.',
  engine: {
    initial: chessInitialState,
    move: makeChessMove,
    status: chessStatus,
    render: renderChess,
    sideName: side => side === 'w' ? 'White' : 'Black'
  }
});
