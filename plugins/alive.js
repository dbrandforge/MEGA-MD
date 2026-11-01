import store from '../lib/lightweight_store.js';

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

export async function sendAliveResponse(sock, message, context = {}) {
  const chatId = context.chatId || message.key.remoteJid;
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  if (!Array.isArray(used)) used = [];
  let available = REPLIES.map((_, index) => index).filter(index => !used.includes(index));
  if (!available.length) {
    used = [];
    available = REPLIES.map((_, index) => index);
  }
  const index = available[Math.floor(Math.random() * available.length)];
  used.push(index);
  await store.saveSetting(chatId, USED_KEY, used);
  return sock.sendMessage(chatId, { text: REPLIES[index] }, { quoted: message });
}

export default {
  command: 'alive',
  aliases: ['bot'],
  category: 'general',
  description: 'Forge Guard liveness reply with a no-repeat response cycle.',
  usage: '.alive',
  isPrefixless: true,
  async handler(sock, message, args, context) {
    return sendAliveResponse(sock, message, context);
  }
};
