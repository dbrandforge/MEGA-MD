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
  'Breaking news: {name} don resign from the department of premium gbas-gbos. 😭📰'
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

export function pickRotatingMessage(messages, previousIndex = -1, random = Math.random) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  if (messages.length === 1) return { text: messages[0], index: 0 };
  let index = Math.floor(random() * messages.length);
  if (index === previousIndex) index = (index + 1 + Math.floor(random() * (messages.length - 1))) % messages.length;
  return { text: messages[index], index };
}

export function classifyDeparture(update, participant) {
  const actor = update?.author || update?.actor || update?.by;
  if (!actor) return 'unknown';
  const normalize = jid => String(jid || '').split(':')[0].replace(/@s\.whatsapp\.net$|@lid$/,'');
  return normalize(actor) === normalize(participant) ? 'left' : 'removed';
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
