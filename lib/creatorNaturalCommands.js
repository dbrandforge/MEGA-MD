const PREFIX = /^(?:hey\s+)?(?:forge\s+guard|forge|bot)[,:]?\s+/i;

function stripBotAddress(raw, addressedToBot) {
    const prefixed = raw.match(PREFIX);
    if (prefixed) return raw.slice(prefixed[0].length);
    if (!addressedToBot) return raw;
    return raw.replace(/^@[\w.-]+(?:\s+guard)?\s*/i, '')
        .replace(/^(?:forge\s+guard|forge|bot)[,:]?\s+/i, '')
        // Let creator natural routing disambiguate overloaded aliases such as
        // ".remove": member removal should resolve to kick, while ".remove 5"
        // remains the existing delete-message command.
        .replace(/^[.!#$%^&*~+-]+(?=\S)/, '');
}

function durationToMinutes(amount, unit) {
    const normalized = /^(?:a|an|one)$/i.test(String(amount)) ? 1 : Number(amount);
    const n = normalized;
    if (!Number.isSafeInteger(n) || n < 1) return null;
    const minutes = /^(?:d|days?)$/i.test(unit) ? n * 1440
        : /^(?:h|hr|hrs|hours?)$/i.test(unit) ? n * 60 : n;
    return Number.isSafeInteger(minutes) && minutes <= 10080 ? minutes : null;
}

const DURATION_NUMBERS = Object.freeze({
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60
});

export function parseHumanDuration(value) {
    const source = String(value || '').trim().toLowerCase();
    if (!source) return null;
    const token = /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/gi;
    let totalMinutes = 0;
    let cursor = 0;
    let matched = false;
    for (const match of source.matchAll(token)) {
        const gap = source.slice(cursor, match.index);
        if (gap && !/^[\s,and]+$/i.test(gap)) return null;
        const amountToken = match[1].toLowerCase();
        const amount = /^\d+$/.test(amountToken) ? Number(amountToken) : DURATION_NUMBERS[amountToken];
        if (!Number.isSafeInteger(amount) || amount < 1) return null;
        const unit = match[2].toLowerCase();
        const multiplier = /^(?:d|days?)$/.test(unit) ? 1440
            : /^(?:h|hrs?|hours?)$/.test(unit) ? 60 : 1;
        totalMinutes += amount * multiplier;
        if (!Number.isSafeInteger(totalMinutes) || totalMinutes > 10080) return null;
        cursor = match.index + match[0].length;
        matched = true;
    }
    const tail = source.slice(cursor);
    if (!matched || !/^[\s,]*(?:please)?[\s,.!?]*$/i.test(tail)) return null;
    return totalMinutes > 0 ? totalMinutes : null;
}

function minutesUntilLagosClock(hour, minute, meridiem, now = new Date()) {
    let targetHour = Number(hour);
    if (meridiem === 'pm' && targetHour < 12) targetHour += 12;
    if (meridiem === 'am' && targetHour === 12) targetHour = 0;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const currentHour = Number(parts.find(part => part.type === 'hour')?.value);
    const currentMinute = Number(parts.find(part => part.type === 'minute')?.value);
    if (!Number.isFinite(currentHour) || !Number.isFinite(currentMinute)) return null;
    const current = currentHour * 60 + currentMinute;
    let target = targetHour * 60 + Number(minute || 0);
    if (target <= current) target += 24 * 60;
    const duration = target - current;
    return Number.isSafeInteger(duration) && duration > 0 && duration <= 10080 ? duration : null;
}

const GAME_ALIASES = Object.freeze({
    'truth or dare': 'tod', tod: 'tod', truth: 'truth',
    trivia: 'trivia', quiz: 'trivia',
    maths: 'math', math: 'math', 'maths arena': 'math',
    'would you rather': 'wyr', wyr: 'wyr',
    'hot seat': 'hotseat', hotseat: 'hotseat',
    picksin: 'picksin', 'pick your sin': 'picksin', pickyoursin: 'picksin',
    hangman: 'hangman',
    'devils basket': 'basket', "devil's basket": 'basket', basket: 'basket',
    'tic tac toe': 'tictactoe', tictactoe: 'tictactoe'
});

export function parseCreatorNaturalCommand(input, { addressedToBot = false, now = new Date() } = {}) {
    const raw = String(input || '').trim();
    if (!PREFIX.test(raw) && !addressedToBot) return null;
    const intent = stripBotAddress(raw, addressedToBot)
        .trim()
        // Accept ordinary conversational framing without requiring a command verb
        // to be the first word. This is deliberately creator-only at the caller.
        .replace(/^(?:(?:hey\s+)?please[,]?\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|can\s+we\s+|could\s+we\s+|would\s+we\s+|i\s+need\s+(?:you|us)\s+to\s+|i\s+want\s+(?:you|us)\s+to\s+|i\s+would\s+like\s+you\s+to\s+|i['’]d\s+like\s+you\s+to\s+|i\s+was\s+hoping\s+you\s+could\s+|can\s+i\s+get\s+you\s+to\s+|do\s+me\s+a\s+favo[u]?r\s+and\s+|make\s+sure\s+you\s+|let['’]s\s+|we\s+need\s+to\s+|we\s+should\s+|i\s+think\s+we\s+should\s+|when\s+you\s+get\s+a\s+chance[,]?\s+|once\s+you['’]re\s+done[,]?\s+|also[,]?\s+)/i, '')
        .replace(/^(?:just\s+|kindly\s+)/i, '')
        .replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();
    if (!intent) return null;

    // Questions about how an action works belong to the chatbot, not the command
    // executor. Polite action requests such as "Can you lock the group?" remain
    // eligible for command routing.
    if (/^(?:how (?:do|can|would) i|how to|what happens if|what if|why should i|should (?:i|we)|do you think|what do you think|can you (?:explain|tell me how)|could you (?:explain|tell me how)|what is the command for|which command)\b/i.test(intent)) return null;

    if (/^(?:please\s+)?(?:send|show|get|share|list)\s+(?:me\s+)?(?:the\s+)?(?:(?:full|complete|entire|weekly)\s+)?(?:list\s+of\s+)?all\s+(?:the\s+)?(?:group\s+)?activities$/.test(intent)
        || /^(?:show|send|give|list)\s+(?:me\s+)?(?:the\s+)?(?:full|complete|entire|weekly)\s+(?:activity|activities)\s+(?:list|schedule)$/.test(intent)
        || /^(?:all|full|complete|entire|weekly)\s+(?:group\s+)?activities(?:\s+(?:list|schedule))?$/.test(intent)
        || /^(?:what are|show|send|give|list)\s+(?:me\s+)?(?:the\s+)?(?:full|complete|entire|weekly)\s+list\s+of\s+(?:all\s+)?(?:group\s+)?activities$/.test(intent)) {
        return { command: 'activities', args: [], action: 'all-activities' };
    }
    if (/^(?:please\s+)?(?:send|show|get|share)\s+(?:me\s+)?(?:the\s+)?(?:today'?s?\s+)?(?:group\s+)?(?:activities|activity)(?:\s+of\s+the\s+day)?$/.test(intent)
        || /^(?:today'?s?\s+activity|activities\s+of\s+the\s+day)$/.test(intent)) {
        return { command: 'activity', args: [], action: 'daily-activity' };
    }
    const genderTag = intent.match(/^(?:please\s+)?(?:tag|mention|ping)\s+(?:(?:all|all\s+the)\s+)?(ladies|lady|girls|women|females?|guys|guy|men|males?)$/);
    if (genderTag) {
        const gender = /^(?:ladies|lady|girls|women|females?)$/.test(genderTag[1]) ? 'ladies' : 'guys';
        return { command: 'tag', args: [gender], action: 'tag-gender', gender };
    }
    if (/^(?:please\s+)?(?:tag|mention|ping)\s+(?:everyone|everybody|all|all\s+members|@all)$/.test(intent)
        || /^(?:tagall|tag\s+all)$/.test(intent)) {
        return { command: 'tagall', args: [], action: 'tag-all' };
    }
    if (/^remove\s+\d+(?:\s+messages?)?$/.test(intent)) return null;
    if (/^(?:please\s+)?(?:kick|remove|kick\s+out|remove\s+from\s+(?:the\s+)?group)(?:\s+(?:the\s+)?(?:user|member|person))?(?:\s+.+)?$/.test(intent)) {
        return { command: 'kick', args: [], action: 'remove-member' };
    }

    const individualMute = intent.match(/^(?:please\s+)?(?:soft[- ]?)?mute(?:\s+(.+))?$/);
    if (individualMute && !/\bgroup\b/.test(individualMute[1] || '')) {
        const remainder = individualMute[1] || '';
        const compactDuration = remainder.match(/(?:^|\s)(\d+(?:[dhms]\d*)*)$/i)?.[1];
        const humanDuration = remainder.match(/(?:^|\s)(\d+|a|an|one)\s*(minutes?|mins?|m|hours?|hrs?|h)$/i);
        const durationMinutes = humanDuration ? durationToMinutes(humanDuration[1], humanDuration[2]) : null;
        const durationArg = compactDuration || (durationMinutes ? durationMinutes + 'm' : null);
        return { command: 'mute', args: durationArg ? [durationArg] : [], action: 'soft-mute-member' };
    }
    const individualUnmute = intent.match(/^(?:please\s+)?(?:unmute|unsilence)\s+(.+)$/);
    if (individualUnmute && !/\bgroup\b/.test(individualUnmute[1])) {
        return { command: 'unmute', args: [], action: 'soft-unmute-member' };
    }

    if (/^(?:please\s+)?(?:lock|disable)\s+(?:all\s+)?games$/.test(intent)) {
        return { command: 'gamelock', args: ['on'], action: 'lock-all-games' };
    }
    if (/^(?:please\s+)?(?:unlock|enable)\s+(?:all\s+)?games$/.test(intent)) {
        return { command: 'gamelock', args: ['off'], action: 'unlock-all-games' };
    }
    const gameLock = intent.match(/^(?:please\s+)?(lock|unlock|disable|enable)\s+(.+?)\s+game$/);
    if (gameLock) {
        const game = GAME_ALIASES[gameLock[2].replace(/\s+/g, ' ').trim()];
        if (game) return { command: 'gamelock', args: [game, ['lock', 'disable'].includes(gameLock[1]) ? 'on' : 'off'], action: 'game-lock' };
    }

    const bypass = intent.match(/^(?:please\s+)?(?:bypass|temporarily\s+unlock|unlock)\s+(.+?)(?:\s+game)?\s+for\s+(\d+|a|an|one)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
    if (bypass) {
        const game = GAME_ALIASES[bypass[1].replace(/\s+/g, ' ').trim()];
        const minutes = durationToMinutes(bypass[2], bypass[3]);
        if (game && minutes) return { command: 'bypass', args: [game === 'truth' ? 'tod' : game, minutes + 'm'], action: 'game-bypass', durationMinutes: minutes };
    }

    const lockUntilClock = intent.match(/^(?:please\s+)?(?:lock|mute)\s+(?:(?:the|this|our)\s+)?group\s+(?:until|till|up to)\s+(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)$/);
    if (lockUntilClock) {
        const minutes = minutesUntilLagosClock(lockUntilClock[1], lockUntilClock[2], lockUntilClock[3], now);
        if (minutes) return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes, untilClock: true };
    }

    const scheduledTimedLock = intent.match(/^(?:please\s+)?schedule\s+(?:(?:the|this|our)\s+)?group\s+lock\s+for\s+(.+)$/);
    if (scheduledTimedLock) {
        const minutes = parseHumanDuration(scheduledTimedLock[1]);
        if (minutes) return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    const timedLock = intent.match(/^(?:please\s+)?(?:lock|mute)\s+(?:(?:the|this|our)\s+)?group\s+for\s+(.+)$/);
    if (timedLock) {
        const minutes = parseHumanDuration(timedLock[1]);
        if (minutes) return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    if (/^(?:please\s+)?(?:lock|mute)(?:\s+(?:(?:the|this|our)\s+)?group)?$/.test(intent)) {
        return { command: 'grouplock', args: ['lock'], action: 'lock' };
    }
    if (/^(?:please\s+)?(?:unlock|unmute)(?:\s+(?:(?:the|this|our)\s+)?group)?$/.test(intent)) {
        return { command: 'grouplock', args: ['unlock'], action: 'unlock' };
    }

    if (/^(?:please\s+)?(?:enable|turn\s+on|activate)\s+(?:the\s+)?voice\s*mode$/.test(intent)) {
        return { command: 'voicemode', args: ['on'], action: 'voice-mode-on' };
    }
    if (/^(?:please\s+)?(?:disable|turn\s+off|deactivate)\s+(?:the\s+)?voice\s*mode$/.test(intent)) {
        return { command: 'voicemode', args: ['off'], action: 'voice-mode-off' };
    }

    const triviaMath = intent.match(/^(?:please\s+)?(?:start|starts|begin|launch|play)\s+(?:(?:the\s+)?(?:trivia|quiz)\s+)?(?:game\s+)?(?:maths?|mathematics)(?:\s+game)?(?:\s+(easy|normal|medium|hard|expert))?$/)
        || intent.match(/^(?:please\s+)?(?:start|starts|begin|launch|play)\s+(?:trivia|quiz)\s+(?:game\s+)?maths?(?:\s+game)?(?:\s+(easy|normal|medium|hard|expert))?$/);
    if (triviaMath) return { command: 'math', args: [triviaMath[1] === 'medium' ? 'normal' : triviaMath[1]].filter(Boolean), action: 'start-game', game: 'math' };

    if (/^(?:please\s+)?(?:open|open up)\s+(?:the\s+)?(?:picksin|pick\s+your\s+sin|pickyoursin)(?:\s+game)?$/.test(intent)) {
        return { command: 'picksin', args: ['open'], action: 'open-game', game: 'picksin' };
    }

    const startGame = intent.match(/^(?:please\s+)?(?:start|starts|begin|launch|play)\s+(?:a\s+)?(.+?)(?:\s+game)?$/);
    if (startGame) {
        const game = GAME_ALIASES[startGame[1].replace(/\s+/g, ' ').trim()];
        if (game) return { command: game, args: game === 'trivia' ? ['mixed'] : game === 'picksin' ? ['start'] : [], action: 'start-game', game };
    }
    if (/^(?:please\s+)?(?:show|list)\s+(?:me\s+)?(?:the\s+)?games$/.test(intent) || intent === 'games') {
        return { command: 'games', args: [], action: 'list-games' };
    }

    if (/^(?:please\s+)?(?:end|stop)\s+(?:the\s+)?truth\s+or\s+dare(?:\s+game|\s+session)?$/.test(intent)) {
        return { command: 'endtod', args: [], action: 'end-game', game: 'truth' };
    }
    if (/^(?:please\s+)?(?:end|stop)\s+(?:the\s+)?basket(?:\s+game|\s+session)?$/.test(intent)) {
        return { command: 'endbasket', args: [], action: 'end-game', game: 'basket' };
    }
    if (/^(?:please\s+)?(?:end|stop)\s+(?:the\s+)?hot\s*seat(?:\s+game|\s+session)?$/.test(intent)) {
        return { command: 'endhotseat', args: [], action: 'end-game', game: 'hotseat' };
    }
    if (/^(?:please\s+)?(?:end|stop)\s+(?:the\s+)?game$/.test(intent)) {
        return {
            command: '',
            args: [],
            action: 'clarify',
            clarification: 'Which game should I end — Trivia, Maths, Truth or Dare, Hot Seat, Would You Rather, Hangman or Devil’s Basket?'
        };
    }
    const schedule = intent.match(/^(?:please\s+)?(?:schedule|remind me to|remind the group to)\s+(.+)$/);
    if (schedule) {
        const relative = schedule[1].trim().match(/^(?:in\s+)?(\d+|a|an|one)\s*(minutes?|mins?|m|hours?|hrs?|h)\s+(?:send|post|say|message)\s+(.+)$/);
        if (relative) {
            const minutes = durationToMinutes(relative[1], relative[2]);
            if (minutes) return { command: 'schedule', args: [minutes + 'm', relative[3]], action: 'schedule-message', durationMinutes: minutes };
        }
    }
    return null;
}
