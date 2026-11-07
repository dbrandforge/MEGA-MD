import store from '../lib/lightweight_store.js';
import { PRIMARY_FEATURE_GROUP, registerFeatureGroup, isFeatureGroup, loadFeatureGroups } from '../lib/featureGroups.js';
import { trackGroup, startSchedulerEngine } from './schedule.js';
import { loadUserGroupData } from './chatbot.js';
import {
  copyGroupUserData,
  copyGroupSettings,
  copyAntispamGroupConfig
} from '../lib/groupFeatureProfile.js';

const PROFILE_NAME = 'matured-minded';
const ENABLED_FEATURES = [
  'Three-message welcome pack and introduction tracking',
  'Member departure and return messages',
  'Group chatbot',
  'Anti-link protection',
  'Anti-spam protection',
  'Anonymous Night',
  'Game commands enabled; Mature Minded day-lock schedule retained',
  'Daily group lock/unlock and activity announcements',
  'Scheduled group maintenance'
];

export default {
  command: 'groupforge',
  aliases: ['groupregister', 'groupsetup', 'forgegroup'],
  category: 'owner',
  description: 'Register this group with the Mature Minded Forge Guard feature profile.',
  usage: '.groupforge setup | .groupforge status',
  groupOnly: true,
  strictOwnerOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const action = String(args?.[0] || 'setup').toLowerCase();
    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'Run this command inside the group you want to register.' }, { quoted: message });
    }

    if (action === 'status') {
      await loadFeatureGroups();
      const profile = await store.getSetting(chatId, 'forgeGuardGroupProfile');
      const isRegistered = isFeatureGroup(chatId);
      return sock.sendMessage(chatId, {
        text: `🛠️ *FORGE GUARD GROUP PROFILE*\n\nRegistration: ${isRegistered ? '🟢 ACTIVE' : '🔴 NOT REGISTERED'}\nProfile: ${profile?.name || 'Not applied'}\nSource: ${profile?.source || '—'}\nLast applied: ${profile?.appliedAt ? new Date(profile.appliedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) : '—'}`
      }, { quoted: message });
    }

    if (!['setup', 'apply', 'on'].includes(action)) {
      return sock.sendMessage(chatId, {
        text: 'Usage: .groupforge setup | .groupforge status'
      }, { quoted: message });
    }

    if (chatId === PRIMARY_FEATURE_GROUP) {
      return sock.sendMessage(chatId, { text: 'Mature Minded is the source profile group; its configuration does not need to be cloned into itself.' }, { quoted: message });
    }

    try {
      const [userData, sourceSettings, antispam] = await Promise.all([
        loadUserGroupData(),
        store.getAllSettings(PRIMARY_FEATURE_GROUP),
        store.getSetting('global', 'antispam')
      ]);

      const nextUserData = copyGroupUserData(userData, PRIMARY_FEATURE_GROUP, chatId);
      const nextAntispam = copyAntispamGroupConfig(antispam || {}, PRIMARY_FEATURE_GROUP, chatId);
      const nextGroupSettings = copyGroupSettings(sourceSettings || {});

      if (!await store.saveSettingVerified('global', 'userGroupData', nextUserData)) {
        throw new Error('Could not save the group feature switches.');
      }
      if (!await store.saveSettingVerified('global', 'antispam', nextAntispam)) {
        throw new Error('Could not save the AntiSpam group profile.');
      }

      for (const [key, value] of Object.entries(nextGroupSettings)) {
        if (!await store.saveSettingVerified(chatId, key, value)) {
          throw new Error(`Could not save group setting: ${key}`);
        }
      }

      await registerFeatureGroup(chatId);
      if (!await trackGroup(chatId)) {
        throw new Error('Group feature profile was saved, but scheduler registration could not be verified.');
      }
      startSchedulerEngine(sock);

      const profile = {
        name: PROFILE_NAME,
        source: PRIMARY_FEATURE_GROUP,
        appliedAt: Date.now(),
        features: ENABLED_FEATURES
      };
      if (!await store.saveSettingVerified(chatId, 'forgeGuardGroupProfile', profile)) {
        throw new Error('Features were applied, but profile metadata could not be saved. Run .groupforge setup again to verify.');
      }

      return sock.sendMessage(chatId, {
        text: `✅ *FORGE GUARD GROUP SETUP COMPLETE*\n\nThis group is now registered with the Mature Minded feature profile.\n\n*Enabled/configured:*\n${ENABLED_FEATURES.map(item => `• ${item}`).join('\n')}\n\n*Copied safely from Mature Minded:* welcome/chatbot settings, moderation switches, Anonymous Night and game-lock configuration.\n\nLive game sessions, scores, member histories, pending introductions, conversation memory and lock timers were not copied.\n\nThe bot still needs WhatsApp admin rights for actions such as locking the group or removing members.`
      }, { quoted: message });
    } catch (error) {
      console.error('[GROUPFORGE] Profile setup failed:', error);
      return sock.sendMessage(chatId, {
        text: `⚠️ *GROUP SETUP INCOMPLETE*\n\n${error.message}\n\nNo live game history or member records were copied. You can safely run *.groupforge setup* again to complete the configuration.`
      }, { quoted: message });
    }
  }
};
