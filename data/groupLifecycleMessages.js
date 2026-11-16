export const goodnightMessages = [
  'Goodnight, sinners of Sin City. Behave yourselves in your dreams. 😈🌙',
  'The court is adjourned, troublemakers. Sleep well and come back with fresh nonsense tomorrow. 😂🌙',
  'Sin City is going on night mode. Rest those restless fingers. Goodnight, sinners! 🔒😴',
  'Goodnight, beautiful disasters. May your dreams be sweet and your group-chat offences remain undiscovered. 😏🌙',
  'Everybody park your wahala for tonight. Even professional troublemakers need sleep. Goodnight! 🛌😂',
  'Lights out, sinners! No midnight plotting in the group. We know how you people behave. 😭🌙',
  'Goodnight, Sin City residents. May your enemies sleep early and your data last till morning. 🤲🏽😂',
  'The gates are closed. Go and recharge your batteries, agents of confusion. See you in the morning. 🔐😴',
  'Sleep tight, sinners. If you must misbehave, at least do it in your dreams tonight. 😈💤',
  'Goodnight, my people. Tomorrow is another day to disgrace yourselves with confidence. 😂🌙'
];

export const goodmorningMessages = [
  'Good morning, sinners of Sin City. New day, fresh energy, same questionable decisions. ☀️😈',
  'Rise and shine, agents of confusion. Sin City is open again. Try to behave… or at least be creative. 😂🌅',
  'Good morning, beautiful problems. The gates are open; let the daily wahala begin. 🔓☀️',
  'Wake up, sinners! Your group has missed your noise. Go gently… we are watching. 👀😂',
  'Morning, Sin City residents. May your hustle prosper and your drama remain entertaining. ☀️🥂',
  'Good morning, troublemakers. Another day to make questionable choices with full confidence. 😭🌞',
  'The city is awake! Stretch, hydrate and prepare to disturb everybody respectfully. 😂🌅',
  'Good morning, my favourite suspects. Sin City is back online. Let the madness resume. 🚦😈',
  'Up you go, sinners! May today favour you more than your last situationship did. 😏☀️',
  'A very good morning to the people who turned this group into a full-time reality show. 😂🌞'
];

export const memberLeftMessages = [
  '{name} don commot group. Hope say road clear? 🚶🏽‍♂️😂',
  'Omo, {name} don waka! No farewell speech, no press conference. 😭👋',
  '{name} has left the building. Somebody check whether the wahala followed them. 🚪😏',
  'Pastor {name} don commot group. May the peace they seek locate them. 😂🙏🏽',
  '{name} don carry their slippers go. We wish them strength outside these four walls. 🩴🤣',
  'One sinner don disappear from the congregation. Safe journey, {name}! 😈👋',
  '{name} has exited Sin City. The door is not locked from outside o. 😂🚶🏽‍♀️',
  'Breaking news: {name} don resign from the department of premium gbas-gbos. 😭📰',
  '{name} has chosen peace over premium group notifications. We respect the decision. 😂🕊️',
  'The exit button has claimed another one. Safe journey, {name}. No hard feelings. 👋',
  '{name} don quietly disappear like person wey owe contribution. We see you o. 😭',
  'A moment of silence for {name}; former resident, current visitor from afar. 😂',
  '{name} has left us to face the outside world. May their data and patience be sufficient. 🤲🏽',
  'No long story, no closing remarks. {name} has taken the exit. Take care out there. 👋',
  '{name} don choose another community. May the new group understand their full personality. 😭😂',
  'The city just lost one resident: {name}. We hope the next stop brings good vibes. 🌆',
  '{name} has logged out of this particular wahala. Wishing them a peaceful journey. 🫡',
  'Some journeys require a different group chat. Safe travels, {name}. 😂🚪',
  '{name} don waka go find greener notification settings. All the best! 🌱🤣',
  'Former resident alert: {name} has left the group. The memories remain in the chat history. 📜',
  '{name} has made a strategic withdrawal. We shall not hold a press conference. 😭',
  'One less voice in the room: {name}. May your next group be lively but not too lively. 😂',
  '{name} has exited stage left. No drama, just a clean departure. 🎭👋',
  'The group roster has changed. {name}, wherever you are headed, go well. 🤝',
  '{name} don close this chapter. We wish them better chapters ahead. 📖',
  'Another notification-free life begins for {name}. Enjoy the silence while it lasts. 😂',
  '{name} has left the chat. We will let the door close gently behind them. 🚪'
];

export const memberRemovedMessages = [
  '{name}, you no dey hear word? See as you collect express exit. Try hear word next time. 🐐😂🚪',
  'Admin don show {name} the door. This is what happens when warning becomes decoration. 😭🚪',
  '{name} don receive group-to-street transfer. Please let the lesson enter. 😂📦',
  'Oga {name}, rules no be decoration. Enjoy your compulsory break from Sin City. 😏🚫',
  'And just like that, {name} don collect red card. Next time, use your head small. 🟥😂',
  '{name} has been escorted out of the congregation. No appeal from the pulpit today. ⛪🚪',
  'You see am? {name} no gree hear word, now na outside they go reason am. 😭🐐',
  'Sin City security don do their work. {name}, reflect on your choices abeg. 🫡🚪'
];

export const memberDepartureMessages = [
  '{name} is no longer in the group. 👋',
  'One member don step out: {name}. Safe journey. 🚶🏽',
  '{name} has exited the group. Make we keep it moving. 👋',
  'Group update: {name} is no longer a member here.'
];

export function pickRotatingMessage(messages, previousIndex = -1, random = Math.random) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  if (messages.length === 1) return { text: messages[0], index: 0 };
  let index = Math.floor(random() * messages.length);
  if (index === previousIndex) index = (index + 1 + Math.floor(random() * (messages.length - 1))) % messages.length;
  return { text: messages[index], index };
}

function normalizeDepartureJid(value) {
  if (value && typeof value === 'object') {
    return [value.id, value.jid, value.phoneNumber, value.lid]
      .flatMap(normalizeDepartureJid)
      .filter(Boolean);
  }
  const jid = String(value || '').trim().replace(/:\d+(?=@)/, '').toLowerCase();
  if (!jid) return [];
  return [jid.endsWith('@c.us') ? jid.slice(0, -'@c.us'.length) + '@s.whatsapp.net' : jid];
}

export function classifyDeparture(update, participant, {
  actorAliases = [],
  participantAliases = []
} = {}) {
  const actorValues = [update?.author, update?.actor, update?.by, ...actorAliases];
  const actorIdentities = new Set(actorValues.flatMap(normalizeDepartureJid));
  if (!actorIdentities.size) return 'unknown';
  const participantIdentities = new Set([participant, ...participantAliases].flatMap(normalizeDepartureJid));
  return [...actorIdentities].some(identity => participantIdentities.has(identity))
    ? 'left'
    : 'removed';
}


export const memberRemovedReturnMessages = [
  'Stubborn goat, you don come back. Sha behave this time. 😂',
  'See who don find road come back again. No wahala, behave yourself. 😂',
  'You thought we would not notice your return? Welcome back, troublemaker. 😭',
  'Omo, security don release you? This time, use your head small. 😂',
  'You don collect second chance. No come turn am to third chance. 😏'
];

export const memberLeftReturnMessages = [
  'Pastor pikin, you don come back. You sure say you go fit handle the pressure? 😂',
  'Ah! The pressure outside no gree you? Welcome back. 😭',
  'You don miss us abi na the wahala you miss? 😂',
  'Welcome back, saint. Hope say outside don teach you patience. 😂',
  'You don return to the congregation. Hope your testimony ready? 🙏🏽😂'
];
