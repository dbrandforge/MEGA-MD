import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';

const USED_KEY = 'aliveReplyCycle';
const REPLIES = [
  "I'd be alive waiting you dey find? 😏\n\nI'm here. The group is not safe.",
  "Alive? I never die. Na una drama dey keep me operational. 😂",
  "Still breathing in code and minding everybody's business. What's next? 👀",
  "Present, accounted for, and already regretting opening this group. 😭",
  "Online and operational. Unfortunately, so are some of your decisions. 😌",
  "I checked the system. The bot is fine. The humans remain under investigation. 🕵️",
  "I never go anywhere. I only pretend to be busy when the wahala gets personal. 😂",
  "Fully alive. Battery of patience: critically low. 🔋",
  "I'm active. Your peace of mind, however, is not my department. 😏",
  "Still here, still watching, still collecting evidence for absolutely no reason. 👀",
  "System status: excellent. Group behaviour: needs urgent review. 🤦",
  "I dey. Who is disturbing the peace this time? 😂",
  "No be today I go shut down. I have unfinished business with this group. 😈",
  "Alive and alert. Please keep your chaos organised. Thank you. 😌",
  "The server is breathing. The group chat is doing too much. 😭",
  "I remain undefeated by network issues and questionable conversations. 🫡",
  "Reporting for duty. Kindly submit today's drama in chronological order. 📋",
  "I'm awake. The question is: are you people okay? 😂",
  "Bot is healthy. Common sense is still loading for some members. ⏳",
  "Always around. I have seen things in this group that code cannot explain. 👀",
  "Still online. Please remember that screenshots have excellent memory. 😏",
  "Alive, responsive, and minding everybody's business professionally. 🥂",
  "No outage here. Just a group full of plot twists. 🎬",
  "I'm good. The group should consider a software update for its behaviour. 😂"
];

const LADY_REPLIES = [
  "My love! How are you doing today? 💕",
  "My baby, what's popping? Have you missed me? 😘",
  "Madam fine girl, you have finally remembered your favourite bot. 😂",
  "Hello, gorgeous. Who is stressing my favourite person today? 💗",
  "My love, have you eaten or should I start worrying? 🥹",
  "Baby girl, the room just got brighter. What's the update? ✨",
  "Omo, see who is here. My favourite troublemaker! 😍",
  "Sweetheart, are you behaving today or should I be concerned? 😏",
  "My baby, should I come and give you premium attention? 😉",
  "Have you fallen in love with me or are we still pretending? 😂💕",
  "Fine girl, your personal hype bot is reporting for duty. 💃",
  "My love, tell me who deserves to be blocked from disturbing your peace. 😌",
  "Madam CEO of sweetness, how is your day going? 👑",
  "Baby, I hope somebody has reminded you how special you are today. 💖",
  "Ah-ah, my darling! You came looking for me again. I knew it. 😂",
  "My love, are we catching cruise or catching feelings today? 🥰",
  "Sweet girl, what can I do to make you smile this evening? 💕",
  "You need attention? Say less. Your favourite bot is available. 😌",
  "My baby, should I come and spoil you with affection? 😉",
  "Hello, queen. The group has been waiting for your energy. 👑",
  "Darling, who is disturbing your soft life? Give me the report. 😂",
  "My love, don't just say bot and disappear. Come and gist with me. 💗",
  "Baby girl, are we being romantic today or causing small chaos? 😈",
  "If I say I missed you, will you believe me? 😘",
  "My sweetheart, your presence is noted and appreciated. Now gist me! 👀",
  "Fine girl, I hope your day is as lovely as your confidence. ✨",
  "My love, should I reserve a little extra attention just for you? 💞",
  "Madam, you called? Your unofficial admirer has arrived. 😂"
];

const GUY_REPLIES = [
  "Oga, how far? Wetin dey happen? 🤝",
  "Chairman! What's popping? The boss has arrived. 😎",
  "My guy, how body? Hope the hustle is moving. 💪",
  "Oga mi, you don show face. What's the latest gist? 😂",
  "Chairman of enjoyment, how market? 🥂",
  "Boss, are we making money or making excuses today? 😏",
  "My gee! Who get update for us? 👀",
  "Oga, welcome back. Your seat in the council of cruise is ready. 😂",
  "Chairman, how the levels? Everything dey intact? 🫡",
  "My brother, hope the wins are louder than the stress. 💯",
  "Big man, what are we solving today? 🤝",
  "Oga, you called? Your digital guy is on standby. 😎",
  "Chairman of the streets, how far with the agenda? 😂",
  "My guy, no dulling. What's the latest? 🔥",
  "Boss man, are we catching cruise or chasing opportunities? 💼",
  "Oga, I hope you've been behaving. Should I check the records? 👀",
  "My bro, how is life treating you? Better report good news. 😁",
  "Chairman, the floor is yours. Give us the update. 🎤",
  "Oga, you need advice, banter or just someone to hail you? 😂",
  "My guy, your presence has been acknowledged. Carry on. 🫡",
  "Big chairman, what's the situation on ground? 📍",
  "Omo, the real boss has entered. How far, my guy? 🔥",
  "Oga, hope your account balance is smiling this week. 💸",
  "Chairman, your personal hype department is open. What's good? 😎",
  "My guy, we move. What are we discussing today? 🤜🤛",
  "Oga, no pressure. Just checking that my chairman is doing fine. 🤝",
  "Boss, who is owing you an explanation today? 😂",
  "Chairman, should we discuss business or disturb the peace small? 😏"
];

function pickNoRepeat(bank, used) {
  let available = bank.map((_, i) => i).filter(i => !used.includes(i));
  if (!available.length) {
    used = [];
    available = bank.map((_, i) => i);
  }
  const index = available[Math.floor(Math.random() * available.length)];
  used.push(index);
  return { text: bank[index], used };
}

export async function sendAliveResponse(sock, message, context = {}) {
  const chatId = context.chatId || message.key.remoteJid;
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  if (!Array.isArray(used)) used = [];
  const selected = pickNoRepeat(REPLIES, used);
  await store.saveSetting(chatId, USED_KEY, selected.used);
  return sock.sendMessage(chatId, { text: selected.text }, { quoted: message });
}

function cleanDisplayName(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[\r\n@]/g, '').trim().split(/\s+/)[0].slice(0, 24);
}

export async function sendGenderAwareBotResponse(sock, message, context = {}) {
  const chatId = context.chatId || message.key.remoteJid;
  const senderId = context.senderId || message.key.participant || message.key.remoteJid;
  const gender = await getUserGender(senderId).catch(() => null);
  if (gender !== 'guy' && gender !== 'lady') return sendAliveResponse(sock, message, { chatId });

  const contacts = sock.store?.contacts || {};
  const contact = contacts[senderId] || {};
  const name = cleanDisplayName(message.pushName || contact.notify || contact.name || '');
  const bank = gender === 'lady' ? LADY_REPLIES : GUY_REPLIES;
  const cycleKey = `botGenderReply:${gender}:${senderId}`;
  let used = (await store.getSetting(chatId, cycleKey)) || [];
  if (!Array.isArray(used)) used = [];
  const selected = pickNoRepeat(bank, used);
  await store.saveSetting(chatId, cycleKey, selected.used);
  const greeting = name ? `${name}, ` : '';
  return sock.sendMessage(chatId, { text: `${greeting}${selected.text}` }, { quoted: message });
}

export default {
  command: 'alive',
  aliases: ['bot'],
  category: 'general',
  description: 'Forge Guard liveness and gender-aware response.',
  usage: '.alive',
  isPrefixless: true,
  async handler(sock, message, args, context) {
    return sendAliveResponse(sock, message, context);
  }
};
