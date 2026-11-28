import { createDuelPlugin } from '../lib/duelGamePlugin.js';
import { checkersInitialState, makeCheckersMove, checkersStatus, renderCheckers } from '../lib/checkersEngine.js';

export default createDuelPlugin({
  command: 'checkers',
  aliases: ['draughts'],
  key: 'checkersSessions',
  rules: "Rules: captures are compulsory; continue multi-jumps with the same piece; men move and capture forward; kings move and capture in both directions; reaching the far edge promotes a king.",
  description: 'Play isolated two-player checkers with compulsory captures, multi-jumps and king promotion.',
  engine: {
    initial: checkersInitialState,
    move: makeCheckersMove,
    status: checkersStatus,
    render: renderCheckers,
    sideName: side => side === 'w' ? 'Red' : 'Black'
  }
});
