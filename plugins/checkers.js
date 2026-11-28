import { createDuelPlugin } from '../lib/duelGamePlugin.js';
import { checkersInitialState, makeCheckersMove, checkersStatus, renderCheckers } from '../lib/checkersEngine.js';

export default createDuelPlugin({
  command: 'checkers',
  aliases: ['draughts'],
  key: 'checkersSessions',
  description: 'Play isolated two-player checkers with compulsory captures, multi-jumps and king promotion.',
  engine: {
    initial: checkersInitialState,
    move: makeCheckersMove,
    status: checkersStatus,
    render: renderCheckers,
    sideName: side => side === 'w' ? 'Red' : 'Black'
  }
});
