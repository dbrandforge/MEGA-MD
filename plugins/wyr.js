import axios from 'axios';
import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';

const KEY = 'wouldYouRatherSessions';
const EXPIRY_MS = 30 * 60 * 1000;
const FALLBACK = [
 ['Have unlimited free travel','Have unlimited free food'],
 ['Be respected by everyone','Be loved by everyone'],
 ['Know every language','Play every musical instrument'],
 ['Build a successful business','Have a dream career with no stress'],
 ['Relive your best memory','Erase your worst memory'],
 ['Always tell the truth','Always know when someone is lying'],
 ['Live by the beach','Live in a beautiful mountain home'],
 ['Have more time','Have more money'],
 ['Be famous for something meaningful','Be privately wealthy'],
 ['Give brilliant advice','Always know the right question to ask'],
 ['Never need sleep','Never need to eat'],
 ['Explore outer space','Explore the deepest ocean'],
 ['Have a photographic memory','Learn any skill in a week'],
 ['Change one decision from your past','See one major event in your future'],
 ['Own a small thriving business','Lead a large global company'],
 ['Spend a year travelling','Spend a year building something lasting'],
 ['Be able to pause time','Be able to rewind time'],
 ['Have perfect confidence','Have perfect discipline'],
 ['Live without social media','Live without streaming entertainment'],
 ['Be the funniest person in the room','Be the wisest person in the room']
];
const choose = () => FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
const getSessions = async chatId => (await store.getSetting(chatId, KEY)) || {};
const saveSessions = (chatId, sessions) => store.saveSetting(chatId, KEY, sessions);
function botMentioned(sock, message) {
 const number=(sock.user?.id||'').split(':')[0].split('@')[0];
 return (message.message?.extendedTextMessage?.contextInfo?.mentionedJid||[]).some(j=>j.split('@')[0].split(':')[0]===number);
}
async function fetchOptions() {
 const res=await axios.get('https://discardapi.dpdns.org/api/quote/wyr?apikey=guru',{timeout:7000});
 const q=res.data?.question;
 if(res.data?.status!==true || !q?.option1 || !q?.option2) throw new Error('Invalid WYR response');
 return [String(q.option1).trim(),String(q.option2).trim()];
}
async function sendQuestion(sock,chatId,senderId,quoted) {
 let options, source='community bank';
 try { options=await fetchOptions(); source='live question'; }
 catch { options=choose(); }
 const sent=await sock.sendMessage(chatId,{text:`🤔 *WOULD YOU RATHER?*\n\n🅰️ ${options[0]}\n\n🅱️ ${options[1]}\n\n_Reply to this message to get another dilemma, or tag me._\n\n_Source: ${source}_`},quoted?{quoted}:undefined);
 const sessions=await getSessions(chatId);
 sessions[senderId]={questionMessageId:sent?.key?.id||null,updatedAt:Date.now(),expiresAt:Date.now()+EXPIRY_MS};
 await saveSessions(chatId,sessions);
}
export async function handleWyrContinuity(sock,chatId,message,senderId) {
 if(!chatId?.endsWith('@g.us')||message?.key?.fromMe||!isFeatureGroup(chatId)) return false;
 const sessions=await getSessions(chatId), session=sessions[senderId];
 if(!session) return false;
 const access = await isGameAllowed(chatId, 'wyr');
 if(!access.ok){await sock.sendMessage(chatId,{text:access.msg},{quoted:message});return true;}
 if(session.expiresAt && session.expiresAt<Date.now()){delete sessions[senderId];await saveSessions(chatId,sessions);return false;}
 const ctx=message.message?.extendedTextMessage?.contextInfo||message.message?.imageMessage?.contextInfo||{};
 const replied=!!(ctx.stanzaId&&session.questionMessageId&&ctx.stanzaId===session.questionMessageId);
 if(!replied&&!botMentioned(sock,message)) return false;
 await sendQuestion(sock,chatId,senderId,message);
 return true;
}
export default {
 command:'wyr', aliases:['wouldyourather'], category:'games',
 description:'Would You Rather with resilient question-provider fallback.',
 usage:'.wyr',
 groupOnly:true,
 async handler(sock,message,args,context) {
  const chatId=context.chatId||message.key.remoteJid;
  const senderId=context.senderId||message.key.participant||message.key.remoteJid;
  if(!isFeatureGroup(chatId)) return sock.sendMessage(chatId,{text:'Would You Rather is available in the designated game groups.'},{quoted:message});
  const access=await isGameAllowed(chatId,'wyr');
  if(!access.ok) return sock.sendMessage(chatId,{text:access.msg},{quoted:message});
  const sessions=await getSessions(chatId);
  if(sessions[senderId]?.expiresAt>Date.now()) {
   return sock.sendMessage(chatId,{text:'You already have an active dilemma. Reply to it or tag me for another.'},{quoted:message});
  }
  try { await sendQuestion(sock,chatId,senderId,message); }
  catch(error) {
   console.error('WYR send failed:',error);
   await sock.sendMessage(chatId,{text:'Could not send a Would You Rather question. Please try again.'},{quoted:message});
  }
 }
};
