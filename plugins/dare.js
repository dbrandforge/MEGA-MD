export default {
    command: 'dare',
    aliases: ['truthordare', 'challenge'],
    category: 'games',
    description: 'Get a very explicit, naughty dare.',
    usage: '.dare',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

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
            "End with this dare: Type the name of the person in this group you would most want to ruin you, and one sentence about how."
        ];

        try {
            const dareMessage = dares[Math.floor(Math.random() * dares.length)];
            await sock.sendMessage(chatId, {
                text: `🔥 *DARE* 🔥\n\n${dareMessage}`
            }, { quoted: message });
        } catch (error) {
            console.error('Error in dare command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to get dare. Please try again later!'
            }, { quoted: message });
        }
    }
};
