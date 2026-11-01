import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';

const STATE_KEY = 'hangmanGame';
const USED_KEY = 'hangmanUsedWords';
const RECORD_KEY = 'hangmanHighScores';
const MAX_WRONG = 6;
export const QUESTIONS_PER_ROUND = 5;

// Mature, adult-oriented vocabulary suited to the feature groups.
// Every entry has a definition clue, synonym clue and progressive hints.
export const WORDS = [
  {word:'intimacy',category:'Connection',hint:'A close personal or sexual connection between adults.',synonymHint:'Closeness, familiarity, or emotional/physical connection.',extraHints:['It can be emotional as well as physical.','Trust often makes it stronger.']},
  {word:'seduction',category:'Attraction',hint:'The art of attracting or enticing someone.',synonymHint:'Allurement, charm, or enticement.',extraHints:['It may involve confidence and flirtation.','It is often associated with romance.']},
  {word:'foreplay',category:'Intimacy',hint:'Activities that build arousal before sex.',synonymHint:'Pre-intimacy, warm-up, or erotic build-up.',extraHints:['Communication and consent matter.','It can include kissing and touching.']},
  {word:'chemistry',category:'Attraction',hint:'A strong mutual spark between two people.',synonymHint:'Compatibility, connection, or mutual attraction.',extraHints:['It can be felt without explanation.','People often say two people have it.']},
  {word:'lingerie',category:'Style',hint:'Elegant or intimate clothing, often worn beneath outerwear.',synonymHint:'Intimate apparel, underwear, or nightwear.',extraHints:['It can be made from lace or silk.','It is often chosen for comfort or allure.']},
  {word:'pleasure',category:'Intimacy',hint:'A feeling of enjoyment or satisfaction.',synonymHint:'Enjoyment, delight, gratification.',extraHints:['It can be physical or emotional.','It is the opposite of discomfort.']},
  {word:'fantasy',category:'Desire',hint:'An imagined scenario or private desire.',synonymHint:'Daydream, imagination, or erotic scenario.',extraHints:['It may remain private or be shared.','It is not necessarily something acted upon.']},
  {word:'passion',category:'Desire',hint:'A powerful feeling of desire or enthusiasm.',synonymHint:'Ardour, intensity, or fervour.',extraHints:['It can describe romance or ambition.','It is rarely described as lukewarm.']},
  {word:'consent',category:'Boundaries',hint:'A freely given agreement to participate.',synonymHint:'Permission, agreement, or willing approval.',extraHints:['It must be informed and voluntary.','It can be withdrawn at any time.']},
  {word:'seductive',category:'Attraction',hint:'Having the power to attract or tempt.',synonymHint:'Alluring, enticing, or captivating.',extraHints:['It can describe a look or a voice.','It shares its root with seduction.']},
  {word:'desire',category:'Attraction',hint:'A strong feeling of wanting someone or something.',synonymHint:'Longing, yearning, or craving.',extraHints:['It can be romantic or sexual.','It can be expressed or kept private.']},
  {word:'romance',category:'Relationships',hint:'A feeling or expression of love and affection.',synonymHint:'Courtship, amour, or love story.',extraHints:['It can involve dates and thoughtful gestures.','It is not limited to grand gestures.']},
  {word:'affection',category:'Relationships',hint:'A gentle feeling of fondness towards someone.',synonymHint:'Fondness, tenderness, or warmth.',extraHints:['It can be shown through words or touch.','It helps people feel valued.']},
  {word:'arousal',category:'Intimacy',hint:'A state of physical or mental sexual excitement.',synonymHint:'Excitement, stimulation, or heightened desire.',extraHints:['It can involve physical responses.','Communication helps partners understand it.']},
  {word:'climax',category:'Intimacy',hint:'The most intense point of sexual excitement.',synonymHint:'Orgasm, peak, or culmination.',extraHints:['It is often called the finish.','The word also describes a story’s high point.']},
  {word:'temptation',category:'Desire',hint:'A strong urge to do or experience something appealing.',synonymHint:'Allurement, lure, or enticement.',extraHints:['It can test self-control.','It is often described as hard to resist.']},
  {word:'sensuality',category:'Intimacy',hint:'Enjoyment or expression of the physical senses.',synonymHint:'Sensuousness, physical awareness, or eroticism.',extraHints:['It can involve touch, scent, sound and taste.','It is not identical to sexuality.']},
  {word:'seductress',category:'Attraction',hint:'A woman regarded as highly alluring or captivating.',synonymHint:'Enchantress, charmer, or femme fatale.',extraHints:['The word is traditionally gendered.','It shares a root with seduction.']},
  {word:'attraction',category:'Connection',hint:'A feeling of being drawn towards another person.',synonymHint:'Appeal, chemistry, or magnetism.',extraHints:['It can be physical, emotional or intellectual.','It may be immediate or develop over time.']},
  {word:'libido',category:'Intimacy',hint:'A person’s level of sexual desire.',synonymHint:'Sex drive, sexual appetite, or desire.',extraHints:['It can vary over time.','Stress and health can influence it.']},
  {word:'orgasm',category:'Intimacy',hint:'The peak of sexual pleasure.',synonymHint:'Climax, sexual peak, or release.',extraHints:['It is a physiological response.','Experiences differ from person to person.']},
  {word:'erotic',category:'Desire',hint:'Relating to sexual desire or excitement.',synonymHint:'Sensual, sexual, or amorous.',extraHints:['It can describe art or literature.','It is more specific than romantic.']},
  {word:'cuddling',category:'Affection',hint:'Holding someone close in an affectionate way.',synonymHint:'Snuggling, embracing, or nuzzling.',extraHints:['It can feel comforting and intimate.','It often involves a warm embrace.']},
  {word:'flirting',category:'Attraction',hint:'Behaving playfully to show romantic or sexual interest.',synonymHint:'Teasing, banter, or playful courtship.',extraHints:['It can be verbal or non-verbal.','A smile or compliment may be part of it.']},
  {word:'aftercare',category:'Intimacy',hint:'Supportive care and connection after an intense intimate experience.',synonymHint:'Reassurance, emotional support, or post-intimacy care.',extraHints:['It can include conversation and affection.','It helps partners check in with each other.']},
  {word:'boundaries',category:'Consent',hint:'Personal limits that define what feels acceptable.',synonymHint:'Limits, ground rules, or personal lines.',extraHints:['They should be communicated clearly.','Respecting them is essential.']},
  {word:'monogamy',category:'Relationships',hint:'A relationship structure involving one partner at a time.',synonymHint:'Exclusive partnership or pair-bonding.',extraHints:['It is one relationship model among several.','It is often contrasted with non-monogamy.']},
  {word:'polyamory',category:'Relationships',hint:'The practice of having multiple consensual romantic relationships.',synonymHint:'Consensual non-monogamy or multiple loving partnerships.',extraHints:['Honesty and communication are central.','It is different from cheating.']},
  {word:'intoxicate',category:'Desire',hint:'To excite or overwhelm someone, almost like a powerful influence.',synonymHint:'Enthrall, captivate, or exhilarate.',extraHints:['A scent or presence can be described this way.','It can also refer to alcohol or drugs.']},
  {word:'afterglow',category:'Intimacy',hint:'A warm, relaxed feeling after a pleasurable intimate experience.',synonymHint:'Contentment, lingering warmth, or post-intimacy calm.',extraHints:['It follows a satisfying experience.','It can be emotional as well as physical.']},
  {word:'rendezvous',category:'Romance',hint:'A planned meeting, often private or romantic.',synonymHint:'Meeting, date, or assignation.',extraHints:['It can sound secretive or exciting.','The word comes from French.']},
  {word:'seducer',category:'Attraction',hint:'A person who charms or entices another.',synonymHint:'Charmer, temptress, or allurer.',extraHints:['Confidence is often part of the image.','It shares a root with seduction.']},
  {word:'yearning',category:'Desire',hint:'A deep, persistent feeling of wanting someone or something.',synonymHint:'Longing, craving, or pining.',extraHints:['It can feel difficult to ignore.','It is stronger than a passing wish.']},
  {word:'erogenous',category:'Intimacy',hint:'Describing a body area that can produce sexual pleasure when stimulated.',synonymHint:'Sensitively responsive or pleasure-sensitive.',extraHints:['It is often paired with the word zone.','Different people have different ones.']},
  {word:'dominance',category:'Dynamics',hint:'The state of taking a leading or controlling role.',synonymHint:'Authority, control, or command.',extraHints:['It can be part of consensual dynamics.','It is contrasted with submission.']},
  {word:'submission',category:'Dynamics',hint:'The act of willingly yielding control within an agreed dynamic.',synonymHint:'Surrender, yielding, or deference.',extraHints:['It must be consensual.','It is contrasted with dominance.']},
  {word:'protection',category:'Safety',hint:'Measures taken to reduce sexual health risks.',synonymHint:'Prevention, safeguarding, or contraception barrier.',extraHints:['Condoms are one example.','It is part of safer sex.']},
  {word:'contraception',category:'Safety',hint:'Methods used to prevent pregnancy.',synonymHint:'Birth control or pregnancy prevention.',extraHints:['There are hormonal and barrier methods.','It should be chosen with accurate information.']},
  {word:'vulnerability',category:'Connection',hint:'The willingness to be emotionally open with another person.',synonymHint:'Openness, emotional exposure, or candidness.',extraHints:['It can build trust.','It requires a sense of safety.']},
  {word:'sensuous',category:'Intimacy',hint:'Appealing strongly to the senses, especially in a pleasurable way.',synonymHint:'Sensual, evocative, or richly tactile.',extraHints:['It can describe music, touch, or atmosphere.','It is related to sensuality.']},
];

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
const maskWord = (word, guessed) => [...word].map(char => guessed.includes(char) ? char : '_');
const pick = values => values[Math.floor(Math.random() * values.length)];
const getRecords = async chatId => (await store.getSetting(chatId, RECORD_KEY)) || {};
const saveRecords = (chatId, records) => store.saveSetting(chatId, RECORD_KEY, records);

async function readGame(chatId) {
  const game = await store.getSetting(chatId, STATE_KEY);
  if (!game || game.status !== 'active') return null;
  if (game.expiresAt && game.expiresAt <= Date.now()) {
    await store.saveSetting(chatId, STATE_KEY, {...game, status:'ended', endedAt:Date.now(), reason:'expired'});
    return null;
  }
  return game;
}
const writeGame = (chatId, game) => store.saveSetting(chatId, STATE_KEY, game);

async function selectRoundWords(chatId) {
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  let available = WORDS.filter(item => !used.includes(item.word));
  if (available.length < QUESTIONS_PER_ROUND) {
    used = [];
    available = [...WORDS];
  }
  const selected = [];
  while (selected.length < QUESTIONS_PER_ROUND && available.length) {
    const item = pick(available);
    selected.push(item);
    available = available.filter(entry => entry.word !== item.word);
    used.push(item.word);
  }
  await store.saveSetting(chatId, USED_KEY, used);
  return selected;
}

function renderBoard(game, intro = '') {
  const word = maskWord(game.word, game.guessed);
  const misses = game.wrong.length + (game.wrongWordGuesses || 0);
  const revealed = game.hintsRevealed || 0;
  const lines = [
    intro,
    `🧩 *FORGE GUARD — HANGMAN · QUESTION ${game.questionNumber}/${QUESTIONS_PER_ROUND}*`,
    `Category: *${game.category}*  |  Letters: *${game.word.length}*`,
    '',
    `*Word:*  ${word.join(' ')}`,
    `*Wrong guesses:* ${misses}/${MAX_WRONG}`,
    `*Used letters:* ${[...game.guessed, ...game.wrong].sort().join(', ') || 'None'}`,
    `💡 *Hint:* ${game.hint}`,
    `🔁 *Synonym clue:* ${game.synonymHint}`
  ];
  if (revealed > 0) lines.push(`🔎 *Extra hint ${revealed}:* ${game.extraHints[revealed - 1]}`);
  lines.push('', '_Use .guess <letter> or .guess <whole-word>_');
  if (misses >= MAX_WRONG) lines.push('', `💀 *Question over.* The word was *${game.word}*.`);
  else if (!word.includes('_')) lines.push('', `🎉 *Solved!* The word was *${game.word}*.`);
  else lines.push(`You have *${MAX_WRONG - misses}* wrong guesses left.`);
  lines.push('', `🏆 Round scores: ${Object.entries(game.scores || {}).map(([id,n]) => `@${id.split('@')[0]} ${n}`).join(' · ') || 'No points yet'}`);
  return lines.filter(Boolean).join('\n');
}

async function finishRound(sock, chatId, message, game, channelInfo) {
  game.status = 'ended';
  game.endedAt = Date.now();
  const ranked = Object.entries(game.scores || {}).sort((a,b) => b[1]-a[1]);
  const records = await getRecords(chatId);
  for (const [jid, score] of ranked) {
    const previous = records[jid] || {highestScore:0, rounds:0};
    previous.rounds += 1;
    if (score > previous.highestScore) previous.highestScore = score;
    previous.lastScore = score;
    previous.lastPlayedAt = Date.now();
    records[jid] = previous;
  }
  const leader = ranked[0];
  if (leader) {
    const previousBest = records[leader[0]].highestScore;
    if (previousBest > (records.groupRecord || 0)) {
      records.groupRecord = previousBest;
      records.groupRecordHolder = leader[0];
    }
  }
  await saveRecords(chatId, records);
  await writeGame(chatId, game);
  const board = ranked.slice(0,5).map(([jid,n],i)=>`${i+1}. @${jid.split('@')[0]} — ${n}/${QUESTIONS_PER_ROUND}`).join('\n') || 'No points recorded.';
  await sock.sendMessage(chatId, {
    text: `🏁 *HANGMAN ROUND COMPLETE*\n\n*Final scores*\n${board}\n\n${leader ? `👑 Round winner: @${leader[0].split('@')[0]}\n` : ''}🏆 Group high score: *${records.groupRecord || 0}/${QUESTIONS_PER_ROUND}*\n\nStart another five-question round with *.hangman*.`,
    mentions: ranked.map(([jid])=>jid),
    ...channelInfo
  }, {quoted:message});
}

async function nextQuestion(sock, chatId, message, game, feedback, channelInfo) {
  if (game.questionNumber >= QUESTIONS_PER_ROUND) return finishRound(sock, chatId, message, game, channelInfo);
  game.questionNumber += 1;
  const next = game.roundWords[game.questionNumber - 1];
  Object.assign(game, {
    word:next.word, category:next.category, hint:next.hint, synonymHint:next.synonymHint,
    extraHints:next.extraHints || [], hintsRevealed:0, guessed:[], wrong:[],
    wrongWordGuesses:0, wordGuesses:[], expiresAt:Date.now()+30*60*1000
  });
  await writeGame(chatId, game);
  await sock.sendMessage(chatId, {text:renderBoard(game, feedback), ...channelInfo}, {quoted:message});
}

export async function applyGuess(sock, message, context, rawGuess) {
  const {chatId,senderId,channelInfo} = context;
  const access = await isGameAllowed(chatId,'hangman');
  if (!access.ok) return sock.sendMessage(chatId,{text:access.msg,...channelInfo},{quoted:message});
  const game = await readGame(chatId);
  if (!game) return sock.sendMessage(chatId,{text:'There is no active Hangman round. Start one with *.hangman*. ',...channelInfo},{quoted:message});
  const guess = normalize(rawGuess);
  if (!guess || (guess.length !== 1 && guess.length !== game.word.length))
    return sock.sendMessage(chatId,{text:`Enter one letter or a complete ${game.word.length}-letter word.`,...channelInfo},{quoted:message});
  if (guess.length === 1 && (game.guessed.includes(guess)||game.wrong.includes(guess)))
    return sock.sendMessage(chatId,{text:`That letter has already been tried.\n\n${renderBoard(game)}`,...channelInfo},{quoted:message});
  if (guess.length > 1 && game.wordGuesses?.includes(guess))
    return sock.sendMessage(chatId,{text:'That whole-word guess has already been tried.',...channelInfo},{quoted:message});
  game.attemptedBy = game.attemptedBy || {};
  game.attemptedBy[senderId] = (game.attemptedBy[senderId]||0)+1;
  let feedback;
  if (guess.length === 1 && game.word.includes(guess)) {
    game.guessed.push(guess); feedback='✅ Correct letter. Keep going.';
  } else if (guess === game.word) {
    game.guessed=[...new Set([...game.guessed,...game.word])]; feedback='🎯 Exact hit. You solved it!';
  } else {
    if (guess.length===1) game.wrong.push(guess);
    else {game.wordGuesses=game.wordGuesses||[];game.wordGuesses.push(guess);game.wrongWordGuesses=(game.wrongWordGuesses||0)+1;}
    feedback='❌ Wrong guess. One life gone.';
  }
  if (game.word.length>=8 && game.extraHints?.length)
    game.hintsRevealed=Math.max(game.hintsRevealed||0,Math.min(game.extraHints.length,Math.floor(game.wrong.length/2)));
  const solved=!maskWord(game.word,game.guessed).includes('_');
  const lost=game.wrong.length+(game.wrongWordGuesses||0)>=MAX_WRONG;
  if (solved) game.scores[senderId]=(game.scores[senderId]||0)+1;
  if (solved||lost) {
    await writeGame(chatId,game);
    return nextQuestion(sock,chatId,message,game,solved?`🏆 @${senderId.split('@')[0]} earned one point. ${feedback}`:feedback,channelInfo);
  }
  game.lastMoveAt=Date.now(); game.expiresAt=Date.now()+30*60*1000;
  await writeGame(chatId,game);
  return sock.sendMessage(chatId,{text:renderBoard(game,feedback),mentions:[senderId],...channelInfo},{quoted:message});
}

export default {
  command:'hangman',aliases:['hang','hm'],category:'games',
  description:'Five-question mature Hangman round with synonym clues and a persistent high-score board.',
  usage:'.hangman | .guess <letter|word> | .hangman hint|status|score|stop',
  groupOnly:true,
  async handler(sock,message,args,context) {
    const {chatId,channelInfo,senderId}=context;
    if(!isFeatureGroup(chatId)) return sock.sendMessage(chatId,{text:'This game is available in the designated feature groups.',...channelInfo},{quoted:message});
    const action=(args[0]||'').toLowerCase();
    if(!['stop','end','status','hint','score'].includes(action)) {
      const access=await isGameAllowed(chatId,'hangman');
      if(!access.ok) return sock.sendMessage(chatId,{text:access.msg,...channelInfo},{quoted:message});
    }
    const current=await readGame(chatId);
    if(action==='score') {
      const records=await getRecords(chatId);
      const ranked=Object.entries(records).filter(([k])=>k!=='groupRecord'&&k!=='groupRecordHolder').sort((a,b)=>b[1].highestScore-a[1].highestScore).slice(0,10);
      return sock.sendMessage(chatId,{text:`🏆 *HANGMAN ALL-TIME RECORDS*\n\n${ranked.map(([jid,r],i)=>`${i+1}. @${jid.split('@')[0]} — best ${r.highestScore}/${QUESTIONS_PER_ROUND} · ${r.rounds} rounds`).join('\n')||'No records yet.'}\n\nGroup record: *${records.groupRecord||0}/${QUESTIONS_PER_ROUND}*`,mentions:ranked.map(([jid])=>jid),...channelInfo},{quoted:message});
    }
    if(action==='stop'||action==='end') {
      if(!current) return sock.sendMessage(chatId,{text:'There is no active Hangman round to stop.',...channelInfo},{quoted:message});
      let admin=!!(context.isSenderAdmin||context.senderIsOwnerOrSudo||context.isOwnerOrSudoCheck||message.key.fromMe);
      if(!admin){try{admin=!!(await isAdmin(sock,chatId,senderId)).isSenderAdmin;}catch{}}
      if(!admin&&!(current.attemptedBy?.[senderId]>0)) return sock.sendMessage(chatId,{text:'Only an admin can stop Hangman independently. Players must attempt at least one guess first.',...channelInfo},{quoted:message});
      current.status='ended';current.endedAt=Date.now();current.reason=admin?'admin-stopped':'player-stopped';
      await writeGame(chatId,current);
      return sock.sendMessage(chatId,{text:`🛑 Hangman round stopped at question ${current.questionNumber}/${QUESTIONS_PER_ROUND}. The word was *${current.word}*.`,...channelInfo},{quoted:message});
    }
    if(action==='status'||action==='hint') {
      if(!current) return sock.sendMessage(chatId,{text:'No active round. Start one with *.hangman*.',...channelInfo},{quoted:message});
      if(action==='hint'&&current.extraHints?.length&&current.hintsRevealed<current.extraHints.length){current.hintsRevealed+=1;await writeGame(chatId,current);}
      return sock.sendMessage(chatId,{text:renderBoard(current),...channelInfo},{quoted:message});
    }
    if(current) return sock.sendMessage(chatId,{text:'A Hangman round is already active. Use *.hangman status*, *.hangman hint*, *.hangman score* or *.hangman stop*.',...channelInfo},{quoted:message});
    const roundWords=await selectRoundWords(chatId);
    const first=roundWords[0];
    const game={status:'active',roundWords,questionNumber:1,word:first.word,category:first.category,hint:first.hint,synonymHint:first.synonymHint,extraHints:first.extraHints||[],hintsRevealed:0,difficulty:'mature',guessed:[],wrong:[],wrongWordGuesses:0,wordGuesses:[],scores:{},attemptedBy:{},startedAt:Date.now(),lastMoveAt:Date.now(),expiresAt:Date.now()+30*60*1000};
    await writeGame(chatId,game);
    return sock.sendMessage(chatId,{text:`🎮 *FORGE GUARD — HANGMAN CHALLENGE*\n\nFive questions. One shared board per question. Every solved word earns one point for its solver. No repeats until the group has exhausted the word pool.\n\n${renderBoard(game)}\n\n_Type *.guess <letter>* or *.guess <whole-word>* to play. Use *.hangman score* for the all-time record._`,...channelInfo},{quoted:message});
  }
};
