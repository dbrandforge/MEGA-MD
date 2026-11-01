import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';

const STATE_KEY = 'hangmanGame';
const MAX_WRONG = 6;

// Curated clue bank. Longer words receive progressive clues after every two misses.
const WORDS = [
  { word: 'javascript', category: 'Technology', hint: 'A programming language used on the web.', extraHints: ['It runs in browsers.', 'Its name contains “script”.'] },
  { word: 'algorithm', category: 'Technology', hint: 'A sequence of steps for solving a problem.', extraHints: ['It is central to computing.', 'It can be written in pseudocode.'] },
  { word: 'architecture', category: 'Design', hint: 'The art and practice of designing buildings.', extraHints: ['It shapes how spaces look and work.', 'It often involves floor plans.'] },
  { word: 'entrepreneur', category: 'Business', hint: 'A person who builds and runs a business.', extraHints: ['They take business risks.', 'They often start with an idea.'] },
  { word: 'photography', category: 'Creative', hint: 'The art of making images with a camera.', extraHints: ['It involves light and composition.', 'Portraits and landscapes are examples.'] },
  { word: 'leadership', category: 'Business', hint: 'The ability to guide people towards a goal.', extraHints: ['It involves influence and responsibility.', 'Teams need it to move in one direction.'] },
  { word: 'creativity', category: 'Creative', hint: 'The ability to produce original ideas.', extraHints: ['It helps solve problems in new ways.', 'Designers use it every day.'] },
  { word: 'innovation', category: 'Business', hint: 'A new idea, method or useful improvement.', extraHints: ['It can change an industry.', 'It is more than simply having an idea.'] },
  { word: 'communication', category: 'General', hint: 'The exchange of information between people.', extraHints: ['It can be verbal or non-verbal.', 'Listening is part of it.'] },
  { word: 'consistency', category: 'General', hint: 'Doing something reliably over time.', extraHints: ['It builds trust.', 'It is the opposite of being erratic.'] },
  { word: 'brand', category: 'Business', hint: 'The meaning and impression people associate with a business.', extraHints: [] },
  { word: 'whatsapp', category: 'Technology', hint: 'A popular messaging application.', extraHints: [] },
  { word: 'lagos', category: 'Nigeria', hint: 'Nigeria’s busy commercial megacity.', extraHints: [] },
  { word: 'jollof', category: 'Food', hint: 'A famous West African rice dish.', extraHints: [] },
  { word: 'nollywood', category: 'Entertainment', hint: 'Nigeria’s film industry.', extraHints: ['It is one of the world’s major film industries.', 'Its name combines Nigeria and Hollywood.'] },
  { word: 'afrobeats', category: 'Music', hint: 'A globally popular music sound from West Africa.', extraHints: ['It has major Nigerian stars.', 'It is heard on dance floors worldwide.'] },
  { word: 'saxophone', category: 'Music', hint: 'A wind instrument often made of brass.', extraHints: ['It uses a reed.', 'Jazz musicians often play it.'] },
  { word: 'basketball', category: 'Sports', hint: 'A team sport played with a ball and a hoop.', extraHints: ['Players dribble the ball.', 'The NBA is a major league.'] },
  { word: 'champion', category: 'Sports', hint: 'A winner of a competition.', extraHints: [] },
  { word: 'volcano', category: 'Science', hint: 'An opening in the Earth that can release lava.', extraHints: [] },
  { word: 'galaxy', category: 'Science', hint: 'A huge system of stars, gas and dust.', extraHints: [] },
  { word: 'microscope', category: 'Science', hint: 'An instrument used to view very small things.', extraHints: ['Scientists use it in laboratories.', 'It makes tiny objects appear larger.'] },
  { word: 'butterfly', category: 'Nature', hint: 'An insect with large colourful wings.', extraHints: [] },
  { word: 'crocodile', category: 'Nature', hint: 'A large reptile that lives in and around water.', extraHints: ['It has powerful jaws.', 'It is not an alligator.'] },
  { word: 'pineapple', category: 'Food', hint: 'A tropical fruit with a spiky skin.', extraHints: ['It has a crown of leaves.', 'It is sweet and tangy.'] },
  { word: 'watermelon', category: 'Food', hint: 'A large fruit with a green rind and juicy flesh.', extraHints: ['It is mostly water.', 'Its flesh is often red or pink.'] },
  { word: 'chocolate', category: 'Food', hint: 'A sweet food made from cocoa.', extraHints: [] },
  { word: 'university', category: 'Education', hint: 'An institution for higher education.', extraHints: ['Students may earn degrees there.', 'It can have many faculties.'] },
  { word: 'dictionary', category: 'Education', hint: 'A reference book of words and meanings.', extraHints: ['It is often arranged alphabetically.', 'It helps explain spelling and definitions.'] },
  { word: 'friendship', category: 'Relationships', hint: 'A close and trusting relationship between people.', extraHints: ['It needs care and mutual respect.', 'Loyalty is often part of it.'] },
  { word: 'adventure', category: 'General', hint: 'An exciting or unusual experience.', extraHints: [] },
  { word: 'mystery', category: 'Entertainment', hint: 'Something difficult to explain or understand.', extraHints: [] },
  { word: 'helicopter', category: 'Transport', hint: 'An aircraft that can hover using rotating blades.', extraHints: ['It does not need a runway to take off.', 'Its main rotor spins above it.'] },
  { word: 'submarine', category: 'Transport', hint: 'A vessel designed to travel underwater.', extraHints: ['Navies use it.', 'It can remain beneath the sea surface.'] },
  { word: 'astronaut', category: 'Science', hint: 'A person trained to travel in space.', extraHints: ['They may work aboard a space station.', 'They wear a spacesuit.'] },
  { word: 'democracy', category: 'Civics', hint: 'A system of government involving the people.', extraHints: ['Elections are important to it.', 'Citizens have a role in choosing leaders.'] },
  { word: 'renaissance', category: 'History', hint: 'A European period of renewed art and learning.', extraHints: ['It followed the Middle Ages.', 'Leonardo da Vinci is associated with it.'] },
  { word: 'revolution', category: 'History', hint: 'A major and often sudden change in society or government.', extraHints: ['It can overturn an existing order.', 'It can also describe a major technological shift.'] },
  { word: 'persistence', category: 'General', hint: 'Continuing despite difficulty or delay.', extraHints: ['It means not giving up.', 'It is closely related to perseverance.'] },
  { word: 'opportunity', category: 'Business', hint: 'A favourable chance to do something.', extraHints: ['You can seize it.', 'It may open a new door.'] },
  { word: 'professional', category: 'Business', hint: 'Someone who is skilled and works in a field.', extraHints: ['It can describe conduct at work.', 'It is the opposite of amateur.'] },
  { word: 'collaboration', category: 'Business', hint: 'Working together to achieve something.', extraHints: ['It involves shared effort.', 'Teams rely on it.'] },
  { word: 'inspiration', category: 'Creative', hint: 'A feeling that motivates someone to create or act.', extraHints: ['It can spark an idea.', 'Artists often seek it.'] },
  { word: 'typography', category: 'Design', hint: 'The art and arrangement of written type.', extraHints: ['It concerns fonts and letterforms.', 'It is essential to graphic design.'] },
  { word: 'minimalism', category: 'Design', hint: 'An approach that uses only what is essential.', extraHints: ['It values simplicity.', 'It often removes visual clutter.'] },
  { word: 'cinematography', category: 'Film', hint: 'The art of photographing a film.', extraHints: ['It involves camera and lighting choices.', 'It shapes a film’s visual language.'] },
  { word: 'orchestra', category: 'Music', hint: 'A large group of musicians playing together.', extraHints: ['It often includes strings, brass and percussion.', 'A conductor may lead it.'] },
  { word: 'kaleidoscope', category: 'General', hint: 'A tube that creates changing patterns from reflected pieces.', extraHints: ['It produces colourful symmetrical designs.', 'It uses mirrors.'] },
  { word: 'encyclopedia', category: 'Education', hint: 'A reference work containing information on many subjects.', extraHints: ['It may have many volumes.', 'It is organised by topics or alphabetically.'] },
  { word: 'responsibility', category: 'General', hint: 'A duty or obligation to take care of something.', extraHints: ['It comes with accountability.', 'It is expected of reliable people.'] }
];

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
const maskWord = (word, guessed) => [...word].map(char => guessed.includes(char) ? char : '_');
const chooseWord = (previousWord = '') => {
  const pool = WORDS.filter(item => item.word !== previousWord);
  return pool[Math.floor(Math.random() * pool.length)] || WORDS[0];
};

async function readGame(chatId) {
  const game = await store.getSetting(chatId, STATE_KEY);
  if (!game || game.status !== 'active') return null;
  if (game.expiresAt && game.expiresAt <= Date.now()) {
    await store.saveSetting(chatId, STATE_KEY, { status: 'ended', endedAt: Date.now(), reason: 'expired' });
    return null;
  }
  return game;
}
async function writeGame(chatId, game) {
  await store.saveSetting(chatId, STATE_KEY, game);
}
function renderBoard(game, intro = '') {
  const word = maskWord(game.word, game.guessed);
  const misses = game.wrong.length + (game.wrongWordGuesses || 0);
  const revealed = game.hintsRevealed || 0;
  const lines = [
    intro,
    `🧩 *HANGMAN — ${game.difficulty.toUpperCase()}*`,
    `Category: *${game.category}*  |  Letters: *${game.word.length}*`,
    '',
    `*Word:*  ${word.join(' ')}`,
    `*Wrong guesses:* ${misses}/${MAX_WRONG}`,
    `*Used letters:* ${[...game.guessed, ...game.wrong].sort().join(', ') || 'None'}`,
    `💡 *Hint:* ${game.hint}`
  ];
  if (revealed > 0) lines.push(`🔎 *Extra hint ${revealed}:* ${game.extraHints[revealed - 1]}`);
  lines.push('', '_Use .guess <letter> or .guess <whole-word>_');
  if (misses >= MAX_WRONG) lines.push('', `💀 *Game over.* The word was *${game.word}*.`);
  else if (!word.includes('_')) lines.push('', `🎉 *Solved!* The word was *${game.word}*.`);
  else lines.push(`You have *${MAX_WRONG - misses}* wrong guesses left.`);
  return lines.filter(Boolean).join('\n');
}

async function applyGuess(sock, message, context, rawGuess) {
  const { chatId, senderId, channelInfo } = context;
  const access = await isGameAllowed(chatId, 'hangman');
  if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
  const game = await readGame(chatId);
  if (!game) {
    return sock.sendMessage(chatId, { text: 'There is no active Hangman round. Start one with *.hangman*.', ...channelInfo }, { quoted: message });
  }
  const guess = normalize(rawGuess);
  if (!guess || (guess.length !== 1 && guess.length !== game.word.length)) {
    return sock.sendMessage(chatId, { text: `Enter one letter or a complete ${game.word.length}-letter word. Example: *.guess a* or *.guess ${game.word}* (just an example format).`, ...channelInfo }, { quoted: message });
  }
  if (guess.length === 1 && (game.guessed.includes(guess) || game.wrong.includes(guess))) {
    return sock.sendMessage(chatId, { text: `That letter has already been tried. Choose another one.\n\n${renderBoard(game)}`, ...channelInfo }, { quoted: message });
  }
  if (guess.length > 1 && game.wordGuesses?.includes(guess)) {
    return sock.sendMessage(chatId, { text: 'That whole-word guess has already been tried.', ...channelInfo }, { quoted: message });
  }

  let feedback;
  if (guess.length === 1 && game.word.includes(guess)) {
    game.guessed.push(guess);
    feedback = '✅ Good catch. That letter is in the word.';
  } else if (guess === game.word) {
    game.guessed = [...new Set([...game.guessed, ...game.word])];
    feedback = '🎯 Exact hit. You solved it!';
  } else {
    if (guess.length === 1) game.wrong.push(guess);
    else {
      game.wordGuesses = game.wordGuesses || [];
      game.wordGuesses.push(guess);
      game.wrongWordGuesses = (game.wrongWordGuesses || 0) + 1;
    }
    feedback = '❌ Not this time. A wrong guess costs one life.';
  }

  // Progressive clues: first clue is always visible. For words >= 9 letters,
  // reveal another clue after every two wrong attempts, up to the available clues.
  if (game.word.length >= 9 && game.extraHints?.length) {
    const targetHints = Math.min(game.extraHints.length, Math.floor(game.wrong.length / 2));
    game.hintsRevealed = Math.max(game.hintsRevealed || 0, targetHints);
  }

  const solved = !maskWord(game.word, game.guessed).includes('_');
  const lost = game.wrong.length + (game.wrongWordGuesses || 0) >= MAX_WRONG;
  if (solved || lost) {
    game.status = 'ended';
    game.endedAt = Date.now();
    game.result = solved ? 'won' : 'lost';
    game.winner = solved ? senderId : null;
    await writeGame(chatId, game);
    const resultText = solved
      ? `🏆 *${message.pushName || 'A player'}* solved the word!\n\n${renderBoard(game, feedback)}`
      : renderBoard(game, feedback);
    return sock.sendMessage(chatId, { text: resultText, ...channelInfo }, { quoted: message });
  }

  game.lastMoveAt = Date.now();
  game.expiresAt = Date.now() + 30 * 60 * 1000;
  await writeGame(chatId, game);
  return sock.sendMessage(chatId, { text: renderBoard(game, feedback), ...channelInfo }, { quoted: message });
}

export default {
  command: 'hangman',
  aliases: ['hang', 'hm'],
  category: 'games',
  description: 'Play group Hangman with clues, progressive hints and six lives.',
  usage: '.hangman [easy|medium|hard] | .guess <letter|word> | .hangman hint|status|stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'This game is available in the designated feature groups.', ...channelInfo }, { quoted: message });
    }
    const action = (args[0] || '').toLowerCase();
    if (!['stop', 'end', 'status', 'hint'].includes(action)) {
      const access = await isGameAllowed(chatId, 'hangman');
      if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    }
    const current = await readGame(chatId);
    if (action === 'stop' || action === 'end') {
      if (!current) return sock.sendMessage(chatId, { text: 'There is no active Hangman round to stop.', ...channelInfo }, { quoted: message });
      await writeGame(chatId, { status: 'ended', endedAt: Date.now(), reason: 'stopped', word: current.word });
      return sock.sendMessage(chatId, { text: `🛑 Hangman stopped. The word was *${current.word}*.`, ...channelInfo }, { quoted: message });
    }
    if (action === 'status' || action === 'hint') {
      if (!current) return sock.sendMessage(chatId, { text: 'No active round. Start one with *.hangman*.', ...channelInfo }, { quoted: message });
      if (action === 'hint' && current.extraHints?.length && current.hintsRevealed < current.extraHints.length) {
        current.hintsRevealed += 1;
        await writeGame(chatId, current);
      }
      return sock.sendMessage(chatId, { text: renderBoard(current), ...channelInfo }, { quoted: message });
    }
    if (current) {
      return sock.sendMessage(chatId, { text: 'A Hangman round is already active in this group. Use *.hangman status*, *.hangman hint* or *.hangman stop*.', ...channelInfo }, { quoted: message });
    }
    const difficulty = ['easy', 'medium', 'hard'].includes(action) ? action : null;
    const eligible = WORDS.filter(item => {
      if (!difficulty) return true;
      if (difficulty === 'easy') return item.word.length <= 7;
      if (difficulty === 'medium') return item.word.length >= 8 && item.word.length <= 10;
      return item.word.length >= 11;
    });
    const selected = eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : chooseWord();
    const game = {
      status: 'active',
      word: selected.word,
      category: selected.category,
      hint: selected.hint,
      extraHints: selected.extraHints || [],
      hintsRevealed: 0,
      difficulty: difficulty || (selected.word.length <= 7 ? 'easy' : selected.word.length <= 10 ? 'medium' : 'hard'),
      guessed: [],
      wrong: [],
      wrongWordGuesses: 0,
      wordGuesses: [],
      startedAt: Date.now(),
      lastMoveAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000
    };
    await writeGame(chatId, game);
    return sock.sendMessage(chatId, {
      text: `🎮 *FORGE GUARD — HANGMAN CHALLENGE*\n\nA new word has entered the arena. Who's solving it first?\n\n${renderBoard(game)}\n\n*Rules:* Six incorrect guesses end the round. One shared board for the group; first correct solver wins.\n\n_Type *.guess <letter>* to play._`,
      ...channelInfo
    }, { quoted: message });
  }
};

export { applyGuess, WORDS };
