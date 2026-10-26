export default {
    command: 'truth',
    aliases: ['truthdare'],
    category: 'games',
    description: 'Get a very explicit, naughty truth question.',
    usage: '.truth',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

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
            "Have you ever tasted your own cum or juices? Be honest.",
            "Describe how you like your hair pulled and your throat used.",
            "Have you ever woken someone up with your mouth on them? How did they react?",
            "What is the longest you have gone without cumming just to make the orgasm stronger later?",
            "Have you ever let someone use your body however they wanted for a whole night with no limits?",
            "What is the most embarrassing (but hot) place you have ever gotten wet or hard?",
            "Have you ever sent nudes to a stranger just for the thrill?",
            "Describe the exact way you like to be talked to when someone is deep inside you.",
            "Have you ever cum from dirty talk alone with no physical touch?",
            "What is the dirtiest roleplay you have ever done, and did you stay in character the whole time?",
            "Have you ever fucked in a car, and how risky did it feel?",
            "What is your favorite thing to do with a cock or pussy right after it has been used?",
            "Have you ever let someone film a close-up of you getting fucked and then watched it together?",
            "Describe the best facial you have ever received or given.",
            "Have you ever edged yourself for hours until you were shaking and desperate?",
            "What is the most number of people you have been sexual with in one night or one session?",
            "Have you ever used a toy on yourself while on a video call with someone?",
            "Describe exactly how you like your ass played with.",
            "Have you ever swallowed every drop and then asked for more?",
            "What is the nastiest thing you have ever said while you were close to cumming?",
            "Have you ever fucked someone so hard they could not walk properly the next day?",
            "Describe your favorite way to wake up — with someone’s mouth, fingers, or cock already on you.",
            "Have you ever let someone finish on your face and left it there for a while just because it felt dirty?",
            "What is the most intense squirting or hands-free orgasm you have ever experienced?",
            "Have you ever been so turned on that you fucked or masturbated in a bathroom while people were nearby?",
            "Describe the perfect way someone should eat you out or suck you off.",
            "Have you ever had sex while someone was on the phone or on a call in the same room?",
            "What is the filthiest thing you have ever done with food or liquid during sex?",
            "Have you ever worn a plug or toy in public just to feel dirty all day?",
            "Describe how you want to be held down and used when you are in a really submissive mood.",
            "Have you ever cum so hard you cried or laughed uncontrollably afterward?",
            "What is the most romantic yet completely filthy thing someone has ever done to you in bed?",
            "Have you ever let someone choose exactly how, when, and where they wanted to use you for a full day?",
            "Describe the last time you got completely ruined and loved every second of it.",
            "If you could be used by anyone in this group right now with zero consequences, who would it be and what exactly would you want them to do to you?"
        ];

        try {
            const truthMessage = truths[Math.floor(Math.random() * truths.length)];
            await sock.sendMessage(chatId, {
                text: `🔥 *TRUTH* 🔥\n\n${truthMessage}`
            }, { quoted: message });
        } catch (error) {
            console.error('Error in truth command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to get truth. Please try again later!'
            }, { quoted: message });
        }
    }
};
