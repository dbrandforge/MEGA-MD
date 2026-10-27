// Daily Group Activities

export const dailyActivities = {
  monday: {
    title: "Business Advert + Health/Hard Talk",
    day: "Business advertising is open during the day.",
    night: "Hard Talk / Health discussion starts at night.",
    full: "*Today is Monday*\n\n*Daytime:* Business Advert\nMembers can promote their businesses.\n\n*Night:* Hard Talk / Health Talk"
  },
  tuesday: {
    title: "Social Discussions + Devil's Basket",
    full: "*Today is Tuesday*\n\n*Social Discussions* are open.\n\n*Devil's Basket* is active!\nType *.basket* or send a number to play.\nGuys: 1-50 | Ladies: 51-100\nUnused numbers only."
  },
  wednesday: {
    title: "Women Crush Wednesday",
    full: "*Today is Women Crush Wednesday* \ud83d\udc96\n\nLadies: Send your picture + name + location.\n\nGuys: You have 5 minutes to shoot your shot under a lady's post.\n\nAfter shooting your shot, the lady has 3 options:\n1. Accept\n2. Offer the other option (Relationship \u2194 Sneaky link)\n3. Reject\n\nRejection = View Once instruction from the bot."
  },
  thursday: {
    title: "Throwback Thursday",
    full: "*Today is Throwback Thursday* \ud83d\udcf8\n\nPost a throwback picture + tell us your throwback music.\n\nYou can ask the bot to download the music for you.\n\nFailure to participate may attract consequences."
  },
  friday: {
    title: "Hot Seat + Freaky Friday",
    full: "*Today is Freaky Friday* \ud83d\udd25\n\nHot Seat is active.\nThe bot will randomly select 2-3 active members for the Hot Seat.\nGet ready for deep and freaky questions."
  },
  saturday: {
    title: "Anonymous Night",
    full: "*Today is Anonymous Night* \ud83d\udd75\n\nSend your confessions, fantasies and secrets anonymously.\n(Link system coming soon)"
  },
  sunday: {
    title: "Truth or Dare",
    full: "*Today is Sunday - Truth or Dare Day* \ud83c\udfb2\n\nPlay Solo or Paired.\n\nPaired mode uses forced pattern: Truth \u2192 Truth \u2192 Dare\n\nType *.tod* to start."
  }
};

export const lockSchedule = {
  // Default for Mon-Sat
  default: {
    lock: "01:00",   // 1 AM
    unlock: "06:00"  // 6 AM
  },
  sunday: {
    lock: "01:00",   // 1 AM
    unlock: "12:00"  // 12 PM
  }
};

export default { dailyActivities, lockSchedule };
