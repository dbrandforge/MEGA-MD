const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const colorOf=p=>!p?null:(p.toLowerCase()==='w'?'w':'b');
export const checkersInitialState=()=>({board:Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>((r+c)%2===1&&r<3)?'b':((r+c)%2===1&&r>4)?'w':'')),turn:'w',forcedFrom:null,history:[]});
const dirs=(piece)=>piece==='W'||piece==='B'?[[-1,-1],[-1,1],[1,-1],[1,1]]:piece==='w'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
export const parseCheckersSquare=s=>/^[a-h][1-8]$/i.test(String(s||''))?[8-Number(s[1]),s.toLowerCase().charCodeAt(0)-97]:null;
const squareName=([r,c])=>String.fromCharCode(97+c)+(8-r);
function capturesFrom(board,r,c){
  const piece=board[r][c],color=colorOf(piece),out=[];
  if(!piece)return out;
  for(const [dr,dc] of dirs(piece)){const y=r+dr,x=c+dc,ty=r+2*dr,tx=c+2*dc;if(inside(ty,tx)&&colorOf(board[y]?.[x])&&colorOf(board[y][x])!==color&&!board[ty][tx])out.push({from:[r,c],to:[ty,tx],capture:[y,x]});}
  return out;
}
export function checkersLegalMoves(state){
  const b=state.board,all=[],jumps=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(colorOf(b[r][c])===state.turn){
    if(state.forcedFrom&&(r!==state.forcedFrom[0]||c!==state.forcedFrom[1]))continue;
    const caps=capturesFrom(b,r,c);jumps.push(...caps);
    if(!state.forcedFrom){for(const [dr,dc] of dirs(b[r][c])){const y=r+dr,x=c+dc;if(inside(y,x)&&!b[y][x])all.push({from:[r,c],to:[y,x]});}}
  }
  return jumps.length?jumps:all;
}
export function applyCheckersMove(state,move){
  const next=JSON.parse(JSON.stringify(state)),b=next.board,[r,c]=move.from,[y,x]=move.to,p=b[r][c];
  b[r][c]='';if(move.capture)b[move.capture[0]][move.capture[1]]='';
  const promoted=(p==='w'&&y===0)||(p==='b'&&y===7);
  b[y][x]=promoted?p.toUpperCase():p;
  if(move.capture&&!promoted&&capturesFrom(b,y,x).length){next.forcedFrom=[y,x];}
  else{next.forcedFrom=null;next.turn=next.turn==='w'?'b':'w';}
  next.history=[...(next.history||[]),{from:squareName([r,c]),to:squareName([y,x]),capture:!!move.capture,promotion:promoted}].slice(-100);
  return next;
}
export function makeCheckersMove(state,fromText,toText){
  const from=parseCheckersSquare(fromText),to=parseCheckersSquare(toText);
  if(!from||!to)return {ok:false,error:'Use board squares, e.g. .checkers move b6 a5.'};
  const move=checkersLegalMoves(state).find(m=>m.from[0]===from[0]&&m.from[1]===from[1]&&m.to[0]===to[0]&&m.to[1]===to[1]);
  if(!move)return {ok:false,error:'Illegal move. Captures are compulsory; check whose turn it is.'};
  return {ok:true,state:applyCheckersMove(state,move),move};
}
export function checkersStatus(state){
  const pieces={w:0,b:0};
  for(const row of state.board)for(const p of row)if(p)pieces[colorOf(p)]++;
  if(!pieces.w||!pieces.b)return {over:true,winner:pieces.w?'w':'b'};
  if(!checkersLegalMoves(state).length)return {over:true,winner:state.turn==='w'?'b':'w'};
  return {over:false};
}
export function renderCheckers(state){
  const glyph={w:'⛀',W:'⛁',b:'⛂',B:'⛃'};
  return state.board.map((row,r)=>`${8-r}  ${row.map(p=>glyph[p]||(((r+row.indexOf(p))%2)?'·':' ')).join(' ')}`).join('\n')+'\n   a b c d e f g h';
}
