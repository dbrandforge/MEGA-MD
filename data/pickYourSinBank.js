import { baseGuyTruths, baseLadyTruths } from './todBase.js';

const COLORS = ['red', 'green', 'yellow', 'orange'];

const guyThemes = {
  red: ['a risky attraction you never admitted', 'the moment desire changed your judgement', 'a secret you protected in a relationship', 'the boldest move you made to get someone’s attention', 'a time jealousy revealed something about you', 'an unexpected romantic encounter', 'a boundary you had to learn to respect', 'a private fantasy and what it represents', 'a relationship decision you would make differently', 'the difference between confidence and pressure'],
  green: ['earning trust after a difficult experience', 'a connection that grew from friendship', 'how you handle emotional vulnerability', 'a time you had to apologise sincerely', 'what loyalty means when things get complicated', 'a boundary that improved a relationship', 'how you recognise genuine interest', 'a time patience changed the outcome', 'what makes you feel emotionally secure', 'how you rebuild a connection after disappointment'],
  yellow: ['an awkward but unforgettable romantic moment', 'a message you rewrote many times before sending', 'a date that surprised you', 'a compliment you still remember', 'a misunderstanding that became a funny story', 'a time you misread someone’s signals', 'a bold confession that took courage', 'a moment when humour created chemistry', 'a harmless secret you find difficult to admit', 'a first impression that turned out to be wrong'],
  orange: ['a fantasy you would discuss only with someone you trust', 'how you communicate desire respectfully', 'a time you surprised yourself with confidence', 'what makes chemistry feel mutual', 'a romantic risk you considered but declined', 'how you balance excitement with personal boundaries', 'a private preference you learned to express', 'what makes an intimate moment meaningful', 'how you would plan an adventurous consensual date', 'a lesson you learned about attraction and self-control']
};

const ladyThemes = {
  red: ['a bold attraction you kept to yourself', 'the moment desire challenged your judgement', 'a secret you protected in a relationship', 'the most daring way you expressed interest', 'a time jealousy taught you something', 'an unexpected romantic encounter', 'a boundary you learned to defend', 'a private fantasy and what it means to you', 'a relationship choice you would reconsider', 'the difference between confidence and pressure'],
  green: ['earning trust after a difficult experience', 'a connection that grew from friendship', 'how you handle emotional vulnerability', 'a time you had to apologise sincerely', 'what loyalty means when things get complicated', 'a boundary that improved a relationship', 'how you recognise genuine interest', 'a time patience changed the outcome', 'what makes you feel emotionally secure', 'how you rebuild a connection after disappointment'],
  yellow: ['an awkward but unforgettable romantic moment', 'a message you rewrote many times before sending', 'a date that surprised you', 'a compliment you still remember', 'a misunderstanding that became a funny story', 'a time you misread someone’s signals', 'a bold confession that took courage', 'a moment when humour created chemistry', 'a harmless secret you find difficult to admit', 'a first impression that turned out to be wrong'],
  orange: ['a fantasy you would discuss only with someone you trust', 'how you communicate desire respectfully', 'a time you surprised yourself with confidence', 'what makes chemistry feel mutual', 'a romantic risk you considered but declined', 'how you balance excitement with personal boundaries', 'a private preference you learned to express', 'what makes an intimate moment meaningful', 'how you would plan an adventurous consensual date', 'a lesson you learned about attraction and self-respect']
};

const truthFrames = [
  topic => `Tell the full story of ${topic}. What led up to it, what happened, and what did you learn?`,
  topic => `Walk us through your most memorable experience involving ${topic}, from the first moment to the aftermath.`,
  topic => `What is the most complicated part of ${topic} for you, and how did you arrive at that view?`,
  topic => `Describe a moment involving ${topic} that changed how you think about attraction, trust, or intimacy.`,
  topic => `How has ${topic} shaped the way you approach relationships, and which experiences influenced that?`,
  topic => `What would your closest friend say about your approach to ${topic}, and what story proves it?`,
  topic => `Explain the boldest decision you have made around ${topic}, including your reasoning and the outcome.`,
  topic => `What do you wish people understood about your experience with ${topic}, and why?`,
  topic => `Compare how you thought about ${topic} in the past with how you see it now. What changed?`,
  topic => `If you had to tell one honest story that captures your feelings about ${topic}, which story would you choose and why?`
];

const actionDares = [
  'Record a 20-second voice note delivering your most confident, respectful flirt line. Post it in the group.',
  'Perform a 15-second slow dance to a song of your choice and send the video or voice note.',
  'Write a daring invitation to a fictional adult crush, then read it aloud in a voice note.',
  'Give a 30-second voice-note performance of a romantic confession without laughing.',
  'Send a voice note explaining three things that make chemistry feel mutual and respectful.',
  'Act out a dramatic movie-style first kiss scene without touching anyone; post the performance.',
  'Create a six-line flirt exchange and perform both characters in one voice note.',
  'Give the group a confident runway walk on video, using your boldest safe outfit.',
  'Read a romantic poem or original six-line message with full theatrical confidence.',
  'Record a voice note asking a fictional partner for consent before a new romantic experience.',
  'Do a 20-second dance that you would use to impress a consenting date and share it.',
  'Write a bold but respectful compliment for an imaginary partner and perform it as a voice note.',
  'Deliver a 30-second speech about your most attractive non-physical quality.',
  'Act out how you would approach someone you like at a party, from greeting to asking for a date.',
  'Record a playful voice note describing your ideal romantic evening in five vivid details.',
  'Perform a dramatic one-minute soap-opera confession of attraction.',
  'Create and read aloud a three-step plan for making a date feel exciting and comfortable.',
  'Send a voice note naming one boundary you would communicate before exploring a new experience.',
  'Do a 20-second confidence pose sequence and share the video.',
  'Write a flirty but respectful text you would send after an excellent first date; read it aloud.',
  'Perform a 15-second lip-sync to a romantic song and send the clip.',
  'Give a voice-note tutorial on how to make someone feel appreciated without pressuring them.',
  'Act out a playful rejection response that remains gracious and confident.',
  'Record a 30-second voice note describing the most adventurous date you would genuinely agree to.',
  'Write a short scene where two adults negotiate a daring idea and clearly agree on boundaries.',
  'Perform your best dramatic eyebrow raise and confident smile on video.',
  'Send a voice note giving three thoughtful ways to build anticipation without crossing boundaries.',
  'Create a fictional dating profile headline and explain the story behind it in a voice note.',
  'Deliver a 20-second toast to confidence, honesty, and mutual consent.',
  'Act out a respectful approach to asking someone for a private conversation, then perform the response.'
];

function normalizePrompt(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function convertLegacyTruth(prompt, gender, index) {
  const clean = String(prompt || '').trim().replace(/[?!.]+$/, '');
  return {
    id: `legacy-${gender}-${String(index + 1).padStart(3, '0')}`,
    text: `Explain the story behind this honestly: “${clean}”. What led to it, how did it unfold, and what would you want the group to understand?`
  };
}

function buildGenderColorBank(gender, legacy, themes) {
  const result = {};
  for (const color of COLORS) {
    const legacyCards = legacy.slice(0, 50).map((prompt, index) => convertLegacyTruth(prompt, gender, index));
    const generated = themes[color].flatMap((topic, topicIndex) =>
      truthFrames.map((frame, frameIndex) => ({
        id: `truth-${gender}-${color}-${String(topicIndex * 10 + frameIndex + 1).padStart(3, '0')}`,
        text: frame(topic)
      }))
    );
    const truths = [...legacyCards, ...generated].slice(0, 150);
    const dares = actionDares.map((text, index) => ({
      id: `dare-${gender}-${color}-${String(index + 1).padStart(3, '0')}`,
      text
    }));
    if (truths.length !== 150 || dares.length !== 30) {
      throw new Error(`Invalid PICK YOUR SIN bank size for ${gender}/${color}: ${truths.length} truths, ${dares.length} dares.`);
    }
    result[`${gender}:${color}`] = { truths, dares };
  }
  return result;
}

export function buildPickYourSinBank() {
  return {
    ...buildGenderColorBank('guy', baseGuyTruths, guyThemes),
    ...buildGenderColorBank('lady', baseLadyTruths, ladyThemes)
  };
}

export function normalizePickYourSinPrompt(value) {
  return normalizePrompt(value);
}

export const PICK_YOUR_SIN_BANK_COUNTS = Object.freeze({
  colors: 4,
  genders: 2,
  truthsPerGenderColor: 150,
  daresPerGenderColor: 30
});
