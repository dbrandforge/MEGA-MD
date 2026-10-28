export default {
    command: 'truth',
    aliases: ['truthdare'],
    category: 'games',
    description: 'Get a very explicit, naughty truth question. Reply to continue.',
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

        try {
            const truthMessage = truths[Math.floor(Math.random() * truths.length)];
            await sock.sendMessage(chatId, {
                text: `🔥 *TRUTH* 🔥\n\n${truthMessage}\n\n_Reply to this message to get another one. Type *stop* to end._`
            }, { quoted: message });
        } catch (error) {
            console.error('Error in truth command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to get truth. Please try again later!'
            }, { quoted: message });
        }
    }
};
