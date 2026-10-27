# Sin City Integration Notes

## Already Working (after redeploy)
- `.tod solo` and `.tod paired @user`
- `.endtod`
- `.basket` (Devil's Basket)
- `.wcw` system
- `.warn` → 10 hour mute
- AI knows year 2026
- Group lock/unlock commands (`.grouplock lock/unlock/status`)
- Daily activity data ready

## Still needs wiring in main files

### 1. TOD Reply Handler (for when users type "solo" or "paired @user" as plain text)

In `lib/messageHandler.js`, after `const userMessage = messageText.toLowerCase();` and after `startSchedulerEngine(sock);`, add:

```js
// --- Sin City: Truth or Dare reply handling ---
try {
    if (isGroup && !message.key.fromMe) {
        const { processTodMessage } = await import('../plugins/tod-handler.js');
        const handled = await processTodMessage(sock, chatId, senderId, messageText, message);
        if (handled) return;
    }
} catch (e) {
    console.error('TOD reply error:', e.message);
}
```

### 2. Welcome System (new members)

In the main socket setup (usually `index.js` or where other `sock.ev.on` are), add:

```js
sock.ev.on('group-participants.update', async (update) => {
    try {
        const { processGroupParticipantsUpdate } = await import('./plugins/welcome-handler.js');
        await processGroupParticipantsUpdate(sock, update);
    } catch (e) {
        console.error('Welcome error:', e.message);
    }
});
```

### 3. Group tracking for automatic lock

Any time a message is received in a group, call:
```js
import { trackGroup } from '../plugins/schedule.js';
trackGroup(chatId);
```

This is already partially done inside the TOD and schedule plugins.

## Manual test commands
- `.tod solo`
- `.tod paired @someone`
- `.endtod`
- `.basket 5`
- `.wcw shot @lady`
- `.wcw reject`
- `.grouplock status`
- `.testwelcome`
