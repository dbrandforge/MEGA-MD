/**
 * Continuity helper for solo .truth and .dare
 * When a user replies to a previous truth/dare message, send the next one.
 */

const TRUTH_MARKER = '🔥 *TRUTH* 🔥';
const DARE_MARKER = '🔥 *DARE* 🔥';

const truths = [
    "What is the most intense orgasm you have ever had, and describe exactly what made it so good in dirty detail.",
    "Have you ever fucked someone while someone else was in the next room or watching? Tell the full filthy story.",
    "What is the dirtiest thing you have ever done for money, a dare, or pure lust?",
    "Which part of your body gets the most attention when you are getting fucked, and how do you love it handled?",
    "Have you ever cum purely from being fingered or eaten out with zero dick involved? Describe how it felt.",
    "What is the biggest cock you have taken, and did it stretch you in the best or worst way?",
    "Have you ever licked cum off someone’s body, out of a condom, or straight from the source? How did it taste?",
    "What is your favorite position when you want to get completely destroyed?",
    "Have you ever recorded yourself getting fucked and watched it later while touching yourself?",
    "What is the most public place you have ever had sex or gotten someone off?",
    "Describe in detail the last time someone made you beg for it.",
    "Have you ever let someone finish inside you without protection just because it felt too good to stop?",
    "What is the nastiest thing someone has ever said to you during sex that made you even wetter/harder?",
    "Have you ever fucked or gotten fucked in front of a mirror just so you could watch?",
    "What is your favorite filthy fantasy that you still have not lived out yet?",
    "Describe how you like your hair pulled and your throat used.",
    "Have you ever woken someone up with your mouth on them? How did they react?",
    "What is the longest you have gone without cumming just to make the orgasm stronger later?",
    "Have you ever let someone use your body however they wanted for a whole night with no limits?",
    "Describe the exact way you like to be talked to when someone is deep inside you.",
    "Have you ever cum from dirty talk alone with no physical touch?",
    "What is the dirtiest roleplay you have ever done?",
    "Describe the best facial you have ever received or given.",
    "Have you ever edged yourself for hours until you were shaking and desperate?",
    "Describe exactly how you like your ass played with.",
    "Have you ever swallowed every drop and then asked for more?",
    "What is the nastiest thing you have ever said while you were close to cumming?",
    "Describe your favorite way to wake up — with someone’s mouth, fingers, or cock already on you.",
    "Have you ever let someone finish on your face and left it there for a while just because it felt dirty?",
    "Describe the perfect way someone should eat you out or suck you off.",
    "What is the filthiest thing you have ever done with food or liquid during sex?",
    "Describe how you want to be held down and used when you are in a really submissive mood.",
    "Have you ever cum so hard you cried or laughed uncontrollably afterward?",
    "If you could be used by anyone in this group right now with zero consequences, who would it be and what exactly would you want them to do to you?",
    "What’s the sluttiest outfit you’ve ever worn with the intention of getting fucked?",
    "Describe the most dominant you’ve ever been in bed and what you did to them.",
    "Have you ever let someone spit in your mouth or on your face during sex?",
    "What’s the most sensitive part of your body that people usually overlook?",
    "Describe the exact sound you make when you’re about to cum hard.",
    "Have you ever been choked during sex? Did you like it?",
    "What’s the dirtiest text you’ve ever sent, and did it work?",
    "Describe a time you got so desperate you begged out loud.",
    "What’s your favorite way to be degraded during sex?",
    "Describe how you like your nipples played with.",
    "What’s the most number of times you’ve cum in one night?",
    "Describe the best creampie you’ve ever given or received.",
    "What’s the filthiest fantasy you’ve masturbated to more than once?",
    "Describe how you want to be fucked when you’re feeling extra needy.",
    "Have you ever let someone use your throat until you were a mess?",
    "Describe the perfect amount of roughness you like."
];

const dares = [
    "Send a voice note describing in filthy detail exactly how you like to be fucked — pace, positions, dirty talk, everything.",
    "Take a photo of your current underwear (or the fact that you are not wearing any) and send it to the group.",
    "Write a short but extremely dirty paragraph about what you would do to the last person who sent a message in this group.",
    "Record a 15-second voice note saying the filthiest thing you have ever wanted to say to someone in this chat.",
    "Send a close-up photo of your thighs, chest, neck, or ass with a caption about how you want it used.",
    "Describe in extreme detail the last time you masturbated — what you were thinking about and how you finished.",
    "Tag someone in the group and tell them exactly how you would suck them off or ride them until they begged.",
    "Send a voice note moaning as if you are being fucked right this second.",
    "Post a photo of yourself biting your lip or looking completely fucked-out with the caption “Use me.”",
    "Write a full fantasy about getting gangbanged by three people from this group and send it here.",
    "Send a voice note of you saying “Please fuck me harder” in the most desperate tone you can manage.",
    "Describe in detail what you would do if the person you are most attracted to in this group walked into your room right now naked.",
    "Take a mirror selfie showing as much skin as you are comfortable with and caption it with one filthy wish.",
    "Write out the dirtiest text you would send if you were trying to make someone cum from words alone.",
    "Send a voice note describing how your body reacts when you are about to orgasm.",
    "Tag two people and create a short filthy scenario involving the three of you.",
    "Describe exactly how you would edge someone for an hour without letting them cum.",
    "Send a photo of your hand or fingers with a caption about what you wish they were doing right now.",
    "Write a confession of the most recent time you got turned on by something someone said in this group.",
    "Record yourself saying “I want to be ruined tonight” and send the voice note.",
    "Describe your ideal way to wake someone up with your mouth.",
    "Send a flirty but extremely explicit message to the group as if you are already halfway to orgasm.",
    "Write a short scene where you are being held down and used exactly how you like it.",
    "Tell the group the most sensitive spot on your body and how you want it treated.",
    "Send a voice note of you breathing heavily and whispering something filthy.",
    "Describe what you would do if someone from this group suddenly pinned you against a wall.",
    "Write the caption you would put under a very explicit photo of yourself if you posted it right now.",
    "Tag someone and dare them to tell you their favorite way to make you moan.",
    "Describe in detail how you like to be kissed when things are already getting sexual.",
    "Send a message that starts with “Right now I am imagining…” and make it as filthy as possible.",
    "Write out the exact dirty talk you want to hear while someone is inside you.",
    "Describe the perfect aftercare you want after being completely used.",
    "Send a voice note saying the name of someone in the group followed by something very naughty.",
    "Write a short fantasy about being watched while you get fucked.",
    "Tell the group one thing you have never admitted out loud about what turns you on.",
    "Describe how you want your hair pulled and your body positioned when someone is taking control.",
    "Send a flirty challenge to the whole group: “Who here would actually fuck me the way I need it?”",
    "Write a detailed description of the last orgasm you had and what triggered it.",
    "Imagine someone from this group is under your desk right now. Describe what they are doing.",
    "Send a message that ends with “and I would not stop until you came.” Make the whole thing filthy.",
    "Describe the most submissive or dominant you have ever felt during sex.",
    "Write a short but intense scene where you are being edged and denied.",
    "Tell the group exactly where on your body you want someone to leave marks.",
    "Send a voice note of you softly saying “Please don’t stop” like you mean it.",
    "Describe what you would do if you had one free night with no rules and someone from this group.",
    "Write the filthiest compliment you can give to someone in this chat.",
    "Imagine the group chat suddenly becomes a private room. What do you do first?",
    "Describe how you want to be looked at while someone is going down on you.",
    "Send a message that makes it clear you are currently turned on and why.",
    "Type the name of the person in this group you would most want to ruin you, and one sentence about how."
];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Call this from messageHandler when a message is a reply.
 * Returns true if it handled the message.
 */
export async function handleTruthDareContinue(sock, chatId, message, userMessage) {
    try {
        const lower = (userMessage || '').trim().toLowerCase();

        // User wants to stop
        if (lower === 'stop' || lower === 'end' || lower === '.stop') {
            const quoted = message.message?.extendedTextMessage?.contextInfo;
            if (quoted?.quotedMessage) {
                const quotedText = quoted.quotedMessage.conversation ||
                    quoted.quotedMessage.extendedTextMessage?.text || '';
                if (quotedText.includes(TRUTH_MARKER) || quotedText.includes(DARE_MARKER)) {
                    await sock.sendMessage(chatId, {
                        text: '✅ Stopped. Use *.truth* or *.dare* anytime to start again.'
                    }, { quoted: message });
                    return true;
                }
            }
            return false;
        }

        // Check if this is a reply to a truth/dare message
        const contextInfo = message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo;

        if (!contextInfo?.quotedMessage) return false;

        const quotedText = contextInfo.quotedMessage.conversation ||
            contextInfo.quotedMessage.extendedTextMessage?.text || '';

        const isTruth = quotedText.includes(TRUTH_MARKER);
        const isDare = quotedText.includes(DARE_MARKER);

        if (!isTruth && !isDare) return false;

        // Send the next one of the same type
        if (isTruth) {
            const next = getRandom(truths);
            await sock.sendMessage(chatId, {
                text: `🔥 *TRUTH* 🔥\n\n${next}\n\n_Reply to this message to get another one. Type *stop* to end._`
            }, { quoted: message });
            return true;
        }

        if (isDare) {
            const next = getRandom(dares);
            await sock.sendMessage(chatId, {
                text: `🔥 *DARE* 🔥\n\n${next}\n\n_Reply to this message to get another one. Type *stop* to end._`
            }, { quoted: message });
            return true;
        }

        return false;
    } catch (e) {
        console.error('Truth/Dare continue error:', e);
        return false;
    }
}

export default {
    command: 'truthcontinue',
    category: 'games',
    description: 'Internal continuity helper',
    // No public handler needed
    async handler() {}
};
