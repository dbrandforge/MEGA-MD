const PREFIX = /^(?:hey\s+)?(?:forge\s+guard|forge|bot)[,:]?\s+/i;

function stripBotAddress(raw, addressedToBot) {
    const prefixed = raw.match(PREFIX);
    if (prefixed) return raw.slice(prefixed[0].length);
    if (!addressedToBot) return raw;
    return raw.replace(/^@[\w.-]+(?:\s+guard)?\s*/i, '')
        .replace(/^(?:forge\s+guard|forge|bot)[,:]?\s+/i, '');
}

function durationToMinutes(amount, unit) {
    const normalized = /^(?:a|an|one)$/i.test(String(amount)) ? 1 : Number(amount);
    const n = normalized;
    if (!Number.isSafeInteger(n) || n < 1) return null;
    const minutes = /^(?:h|hr|hrs|hours?)$/i.test(unit) ? n * 60 : n;
    return Number.isSafeInteger(minutes) && minutes <= 10080 ? minutes : null;
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
    hangman: 'hangman',
    'devils basket': 'basket', "devil's basket": 'basket', basket: 'basket',
    'tic tac toe': 'tictactoe', tictactoe: 'tictactoe'
});

export function parseCreatorNaturalCommand(input, { addressedToBot = false, now = new Date() } = {}) {
    const raw = String(input || '').trim();
    if (!PREFIX.test(raw) && !addressedToBot) return null;
    const intent = stripBotAddress(raw, addressedToBot)
        .trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();
    if (!intent) return null;

    if (/^(?:please\s+)?(?:send|show|get|share)\s+(?:me\s+)?(?:the\s+)?(?:today'?s?\s+)?(?:group\s+)?(?:activities|activity)(?:\s+of\s+the\s+day)?$/.test(intent)
        || /^(?:today'?s?\s+activity|activities\s+of\s+the\s+day)$/.test(intent)) {
        return { command: 'activity', args: [], action: 'daily-activity' };
    }
    if (/^(?:please\s+)?(?:tag|mention|ping)\s+(?:everyone|everybody|all|all\s+members|@all)$/.test(intent)
        || /^(?:tagall|tag\s+all)$/.test(intent)) {
        return { command: 'tagall', args: [], action: 'tag-all' };
    }
    if (/^(?:please\s+)?(?:kick|remove|kick\s+out|remove\s+from\s+(?:the\s+)?group)(?:\s+(?:the\s+)?(?:user|member|person))?(?:\s+.+)?$/.test(intent)) {
        return { command: 'kick', args: [], action: 'remove-member' };
    }

    const individualMute = intent.match(/^(?:please\s+)?(?:soft[- ]?)?mute\s+(.+)$/);
    if (individualMute && !/\bgroup\b/.test(individualMute[1])) {
        return { command: 'mute', args: [], action: 'soft-mute-member' };
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

    const scheduledTimedLock = intent.match(/^(?:please\s+)?schedule\s+(?:(?:the|this|our)\s+)?group\s+lock\s+for\s+(\d+|a|an|one)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
    if (scheduledTimedLock) {
        const minutes = durationToMinutes(scheduledTimedLock[1], scheduledTimedLock[2]);
        if (minutes) return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    const timedLock = intent.match(/^(?:please\s+)?(?:lock|mute)\s+(?:(?:the|this|our)\s+)?group\s+for\s+(\d+|a|an|one)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
    if (timedLock) {
        const minutes = durationToMinutes(timedLock[1], timedLock[2]);
        if (minutes) return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    if (/^(?:please\s+)?(?:lock|mute)(?:\s+(?:(?:the|this|our)\s+)?group)?$/.test(intent)) {
        return { command: 'grouplock', args: ['lock'], action: 'lock' };
    }
    if (/^(?:please\s+)?(?:unlock|unmute)(?:\s+(?:(?:the|this|our)\s+)?group)?$/.test(intent)) {
        return { command: 'grouplock', args: ['unlock'], action: 'unlock' };
    }

    const triviaMath = intent.match(/^(?:please\s+)?(?:start|begin|launch|play)\s+(?:the\s+)?(?:trivia|quiz)\s+game\s+(?:maths?|mathematics)$/);
    if (triviaMath) return { command: 'math', args: [], action: 'start-game', game: 'math' };

    const startGame = intent.match(/^(?:please\s+)?(?:start|begin|launch|play)\s+(?:a\s+)?(.+?)(?:\s+game)?$/);
    if (startGame) {
        const game = GAME_ALIASES[startGame[1].replace(/\s+/g, ' ').trim()];
        if (game) return { command: game, args: [], action: 'start-game', game };
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

    if (/^(?:please\\s+)?(?:end|stop)\\s+(?:the\\s+)?game$/.test(intent)) {
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
