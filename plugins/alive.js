export default {
  command:'alive',
  aliases:['bot'],
  category:'general',
  description:'Forge Guard sarcastic liveness reply.',
  usage:'.alive',
  isPrefixless:true,
  async handler(sock,message,args,context) {
    const chatId=context.chatId||message.key.remoteJid;
    const replies=[
      "I'd be alive waiting you dey find? 😏\n\nI'm here. The group is not safe.",
      "Alive? I never die. Na una drama dey keep me operational. 😂",
      "Still breathing in code and minding everybody's business. What's next? 👀"
    ];
    const index=(Date.now()+String(message.key?.id||'').length)%replies.length;
    return sock.sendMessage(chatId,{text:replies[index]},{quoted:message});
  }
};
