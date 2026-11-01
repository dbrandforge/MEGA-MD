import axios from 'axios';
import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';

const KEY = 'wouldYouRatherSessions';
const EXPIRY_MS = 30 * 60 * 1000;
const FALLBACK = [
 ['Have a partner who is an expert kisser','Have a partner who knows exactly how to make you laugh'],
 ['Enjoy slow romantic tension for hours','Have instant irresistible chemistry'],
 ['Receive a surprise romantic weekend away','Plan a secret night of pure indulgence'],
 ['Have a partner who is brilliant at dirty talk','Have a partner whose touch says everything'],
 ['Be kissed passionately in the rain','Be pulled close for a spontaneous kiss'],
 ['Have a partner who is adventurous in private','Have a partner who is deeply affectionate in public'],
 ['Know your partner’s every fantasy','Have your partner know exactly what you secretly want'],
 ['Have incredible sexual chemistry with no conversation','Have deep emotional connection with undeniable attraction'],
 ['Go on a date that ends at sunrise','Have a night in that neither of you forgets'],
 ['Be the one who initiates every kiss','Always have your partner make the first move'],
 ['Have a partner with a dangerously attractive voice','Have a partner with an unforgettable scent'],
 ['Share one bold fantasy with your partner','Hear one fantasy your partner has never admitted'],
 ['Have a spontaneous make-out session','Have a carefully planned romantic evening'],
 ['Be caught flirting by your crush','Catch your crush secretly flirting with you'],
 ['Have a partner who loves public affection','Have a partner who saves all affection for private moments'],
 ['Spend a whole evening kissing','Spend a whole evening talking about your deepest desires'],
 ['Have a partner who is confident and dominant','Have a partner who is gentle and attentive'],
 ['Have perfect timing for every romantic moment','Have chemistry so strong timing does not matter'],
 ['Receive a bold late-night message','Receive a voice note that makes you blush'],
 ['Have one unforgettable first kiss','Have one unforgettable last kiss'],
 ['Be with someone who reads your body language','Be with someone who asks exactly what you like'],
 ['Explore a new romantic experience together','Perfect the intimate things you already enjoy'],
 ['Have a partner who is playful and teasing','Have a partner who is intense and passionate'],
 ['Be desired from across a crowded room','Be adored in the quiet of your own home'],
 ['Have a partner who plans every detail','Have a partner who makes spontaneous decisions'],
 ['Share a private nickname nobody else knows','Have a secret signal that only you both understand'],
 ['Have a partner who is openly jealous but respectful','Have a partner who is completely unbothered and secure'],
 ['Get a sensual massage','Give your partner a sensual massage'],
 ['Have a partner who remembers every little detail','Have a partner who surprises you with bold gestures'],
 ['Spend a weekend with no phones and no interruptions','Spend a weekend exploring a new city together'],
 ['Be amazing at flirting but shy about commitment','Be confident about commitment but awkward at flirting'],
 ['Have a partner who loves experimenting together','Have a partner who prefers familiar routines'],
 ['Share your most embarrassing romantic story','Share your most daring consensual fantasy'],
 ['Have a partner who is an excellent dancer','Have a partner who is an excellent slow kisser'],
 ['Get a passionate kiss every morning','Get a long affectionate hug every night'],
 ['Have a partner who is very expressive','Have a partner whose actions speak louder than words'],
 ['Know exactly when your partner wants affection','Have your partner always know when you need space'],
 ['Have a relationship full of playful teasing','Have a relationship full of deep conversations'],
 ['Be able to relive your best intimate memory','Create a completely new unforgettable one'],
 ['Have undeniable attraction on the first date','Have attraction that grows stronger every time you meet'],
 ['Be your partner’s first great love','Be your partner’s most unforgettable love'],
 ['Have a partner who loves surprises','Have a partner who tells you exactly what they want'],
 ['Be kissed on the neck unexpectedly','Be held tightly from behind unexpectedly'],
 ['Have a private romantic getaway','Have a public date everyone wishes they had'],
 ['Be with someone who is adventurous but communicative','Be with someone who is predictable but deeply attentive'],
 ['Have one question about your partner answered honestly','Have one secret desire of yours understood without explaining'],
 ['Have a partner who can make you blush with words','Have a partner who can make you blush with a look'],
 ['Enjoy a slow-burn romance','Experience love at first sight'],
 ['Have a partner who is confident about boundaries','Have a partner who is exceptional at communicating needs'],
 ['Share a daring but harmless public flirtation','Share a private moment that feels like the whole world disappeared']
];
const questionKey = options => options.map(value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()).sort().join('||');
const USED_KEY = 'wouldYouRatherUsedQuestions';
const choose = values => values[Math.floor(Math.random()*values.length)];
async function chooseFreshOptions(chatId) {
 const used = (await store.getSetting(chatId, USED_KEY)) || [];
 for (let attempt=0; attempt<6; attempt++) {
  try {
   const options = await fetchOptions();
   const key = questionKey(options);
   if (!used.includes(key)) {
    used.push(key);
    await store.saveSetting(chatId, USED_KEY, used.slice(-1000));
    return {options,source:'live question'};
   }
  } catch {}
 }
 let available = FALLBACK.filter(options => !used.includes(questionKey(options)));
 let history = used;
 if (!available.length) {
  // Start a fresh cycle only after the full curated bank has been exhausted.
  history = [];
  available = [...FALLBACK];
 }
 const options = choose(available);
 history.push(questionKey(options));
 await store.saveSetting(chatId, USED_KEY, history.slice(-1000));
 return {options,source:'mature community bank'};
}
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
 const {options,source}=await chooseFreshOptions(chatId);
 const sent=await sock.sendMessage(chatId,{text:`😈 *WOULD YOU RATHER? — AFTER DARK*\n\n🅰️ ${options[0]}\n\n🅱️ ${options[1]}\n\n_Choose your poison. Reply to this message for another dilemma, or tag me._\n\n_Source: ${source}_`},quoted?{quoted}:undefined);
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
 description:'Mature Would You Rather with group-wide duplicate prevention.',
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
