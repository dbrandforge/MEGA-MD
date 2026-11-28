const FILES = 'abcdefgh';
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const chessStartBoard = () => [
  [...'rnbqkbnr'], [...'pppppppp'], ...Array.from({length:4},()=>Array(8).fill('')),
  [...'PPPPPPPP'], [...'RNBQKBNR']
];
const colorOf = p => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;
const enemy = c => c === 'w' ? 'b' : 'w';
export const parseSquare = s => /^[a-h][1-8]$/i.test(String(s||'')) ? [8-Number(s[1]), FILES.indexOf(s[0].toLowerCase())] : null;
export const squareName = ([r,c]) => FILES[c] + (8-r);
export const chessInitialState = () => ({ board: chessStartBoard(), turn:'w', castling:'KQkq', enPassant:null, halfmove:0, fullmove:1, history:[] });

function attacked(board, r, c, by) {
  const pawnRow = r + (by === 'w' ? 1 : -1);
  for (const dc of [-1,1]) if (inside(pawnRow,c+dc) && board[pawnRow][c+dc] === (by === 'w' ? 'P':'p')) return true;
  for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const p=inside(r+dr,c+dc)?board[r+dr][c+dc]:'';
    if (p === (by==='w'?'N':'n')) return true;
  }
  for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    for(let n=1;n<8;n++){const y=r+dr*n,x=c+dc*n;if(!inside(y,x))break;const p=board[y][x];if(!p)continue;
      if(colorOf(p)===by){const q=p.toLowerCase();if(q==='q'||(n===1&&q==='k')||((dr===0||dc===0)&&q==='r')||((dr!==0&&dc!==0)&&q==='b'))return true;}break;
    }
  }
  return false;
}
function kingPosition(board,color){for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]===(color==='w'?'K':'k'))return [r,c];return null;}
export function chessInCheck(state,color=state.turn){const k=kingPosition(state.board,color);return !k||attacked(state.board,k[0],k[1],enemy(color));}

function pseudoMoves(state,r,c){
  const b=state.board,p=b[r][c],color=colorOf(p),type=p.toLowerCase(),moves=[];
  if(!p||color!==state.turn)return moves;
  const add=(y,x,extra={})=>{if(inside(y,x)&&colorOf(b[y][x])!==color&&b[y][x]?.toLowerCase()!=='k')moves.push({from:[r,c],to:[y,x],...extra});};
  if(type==='p'){
    const d=color==='w'?-1:1,start=color==='w'?6:1,last=color==='w'?0:7;
    if(inside(r+d,c)&&!b[r+d][c]){add(r+d,c);if(r===start&&!b[r+2*d][c])add(r+2*d,c,{double:true});}
    for(const dc of [-1,1]){const y=r+d,x=c+dc;if(!inside(y,x))continue;if(colorOf(b[y][x])===enemy(color))add(y,x);else if(state.enPassant&&state.enPassant[0]===y&&state.enPassant[1]===x)add(y,x,{enPassant:true});}
    return moves.map(m=>m.to[0]===last?{...m,promotion:true}:m);
  }
  const dirs=type==='n'?[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]:type==='k'?[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]:type==='b'?[[-1,-1],[-1,1],[1,-1],[1,1]]:type==='r'?[[-1,0],[1,0],[0,-1],[0,1]]:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for(const [dr,dc] of dirs){for(let n=1;n<=(type==='n'||type==='k'?1:7);n++){const y=r+dr*n,x=c+dc*n;if(!inside(y,x))break;if(colorOf(b[y][x])===color)break;add(y,x);if(b[y][x])break;}}
  if(type==='k'&&!chessInCheck(state,color)){
    const row=color==='w'?7:0,enemyColor=enemy(color);
    const canK=state.castling.includes(color==='w'?'K':'k');
    const canQ=state.castling.includes(color==='w'?'Q':'q');
    if(r===row&&c===4&&canK&&!b[row][5]&&!b[row][6]&&b[row][7]===(color==='w'?'R':'r')&&!attacked(b,row,5,enemyColor)&&!attacked(b,row,6,enemyColor))add(row,6,{castle:'K'});
    if(r===row&&c===4&&canQ&&!b[row][1]&&!b[row][2]&&!b[row][3]&&b[row][0]===(color==='w'?'R':'r')&&!attacked(b,row,3,enemyColor)&&!attacked(b,row,2,enemyColor))add(row,2,{castle:'Q'});
  }
  return moves;
}
export function chessLegalMoves(state){
  const result=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(colorOf(state.board[r][c])===state.turn){
    for(const m of pseudoMoves(state,r,c)){const next=applyChessMove(state,m,'q');if(!chessInCheck(next,state.turn))result.push(m);}
  }
  return result;
}
export function applyChessMove(state,move,promotion='q'){
  const next=JSON.parse(JSON.stringify(state)),b=next.board,[r,c]=move.from,[y,x]=move.to,p=b[r][c],color=colorOf(p);
  const captured=b[y][x];
  b[r][c]='';
  if(move.enPassant)b[color==='w'?y+1:y-1][x]='';
  if(move.castle==='K'){b[y][5]=b[y][7];b[y][7]='';}
  if(move.castle==='Q'){b[y][3]=b[y][0];b[y][0]='';}
  b[y][x]=move.promotion?(color==='w'?String(promotion||'q').toUpperCase():String(promotion||'q').toLowerCase()):p;
  if(p==='K')next.castling=next.castling.replace(/[KQ]/g,'');
  if(p==='k')next.castling=next.castling.replace(/[kq]/g,'');
  if(r===7&&c===0||y===7&&x===0)next.castling=next.castling.replace('Q','');
  if(r===7&&c===7||y===7&&x===7)next.castling=next.castling.replace('K','');
  if(r===0&&c===0||y===0&&x===0)next.castling=next.castling.replace('q','');
  if(r===0&&c===7||y===0&&x===7)next.castling=next.castling.replace('k','');
  next.enPassant=p.toLowerCase()==='p'&&Math.abs(y-r)===2?[(y+r)/2,x]:null;
  next.halfmove=p.toLowerCase()==='p'||captured?0:next.halfmove+1;
  if(color==='b')next.fullmove++;
  next.turn=enemy(color);
  next.history=[...(next.history||[]),{from:squareName([r,c]),to:squareName([y,x]),piece:p}].slice(-80);
  return next;
}
export function makeChessMove(state,fromText,toText,promotion='q'){
  const from=parseSquare(fromText),to=parseSquare(toText);
  if(!from||!to)return {ok:false,error:'Use algebraic squares, e.g. .chess move e2 e4.'};
  const promotionPiece=String(promotion||'q').toLowerCase();
  if (!['q','r','b','n'].includes(promotionPiece)) return {ok:false,error:'Promotion must be q, r, b or n.'};
  const move=chessLegalMoves(state).find(m=>m.from[0]===from[0]&&m.from[1]===from[1]&&m.to[0]===to[0]&&m.to[1]===to[1]);
  if(!move)return {ok:false,error:'Illegal move. Check the piece movement, turn, and king safety.'};
  return {ok:true,state:applyChessMove(state,move,promotionPiece),move};
}
export function chessStatus(state){
  const moves=chessLegalMoves(state),check=chessInCheck(state);
  if(!moves.length)return {over:true,checkmate:check,draw:!check,winner:check?enemy(state.turn):null};
  if(state.halfmove>=100)return {over:true,draw:true,reason:'50-move rule'};
  return {over:false,check};
}
const PIECES={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
export function renderChess(state){
  return state.board.map((row,r)=>`${8-r}  ${row.map(p=>PIECES[p]||'·').join(' ')}`).join('\n')+'\n   a b c d e f g h';
}
