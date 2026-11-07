import store from '../lib/lightweight_store.js';
import { PRIMARY_FEATURE_GROUP, registerFeatureGroup, unregisterFeatureGroup, isFeatureGroup, loadFeatureGroups } from '../lib/featureGroups.js';
import { trackGroup, startSchedulerEngine } from './schedule.js';
import { loadUserGroupData } from './chatbot.js';
import { invalidateGroupFeatureAccessCache } from '../lib/groupFeatureAccess.js';
import {
  MATURED_MIND_EXCLUSIVE_MAPS,
  GENERAL_GROUP_MAPS,
  GENERAL_GROUP_SETTINGS,
  MATURED_MIND_EXCLUSIVE_FEATURES,
  GENERAL_GROUP_FEATURES,
  copyGroupUserData,
  copyGroupSettings,
  copyAntispamGroupConfig
} from '../lib/groupFeatureProfile.js';

const PROFILE_NAME = 'matured-minded';

function enabledFeatureLines(featureSets = {}) {
  return [
    ...(featureSets.maturedMinded ? MATURED_MIND_EXCLUSIVE_FEATURES : []),
    ...(featureSets.general ? GENERAL_GROUP_FEATURES : [])
  ];
}

function profileStatusText(profile, registered) {
  const sets = profile?.featureSets || { maturedMinded: registered, general: false };
  return [
    '🛠️ *FORGE GUARD GROUP PROFILE*',
    '',
    `Registration: ${registered ? '🟢 ACTIVE' : '🔴 NOT REGISTERED'}`,
    `Profile: ${profile?.name || 'Not applied'}`,
    `Matured Minded-exclusive package: ${sets.maturedMinded ? '🟢 ON' : '🔴 OFF'}`,
    `General group package: ${sets.general ? '🟢 ON' : '🔴 OFF'}`,
    `Source: ${profile?.source || '—'}`,
    `Last applied: ${profile?.appliedAt ? new Date(profile.appliedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) : '—'}`,
    '',
    '*Matured Minded-exclusive features*',
    ...(MATURED_MIND_EXCLUSIVE_FEATURES.map(item => `• ${item}`)),
    '',
    '*General Forge Guard features*',
    ...(GENERAL_GROUP_FEATURES.map(item => `• ${item}`)),
  ].join('\n');
}

export default {
  command: 'groupforge',
  aliases: ['groupregister', 'groupsetup', 'forgegroup'],
  category: 'owner',
  description: 'Apply the Matured Minded-exclusive and/or general Forge Guard group feature package.',
  usage: '.groupforge setup [all|matured|general] | .groupforge status',
  groupOnly: true,
  strictOwnerOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const action = String(args?.[0] || 'setup').toLowerCase();
    const requestedSet = String(args?.[1] || 'all').toLowerCase();
    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'Run this command inside the group you want to configure.' }, { quoted: message });
    }

    if (action === 'status') {
      await loadFeatureGroups();
      const profile = await store.getSetting(chatId, 'forgeGuardGroupProfile');
      const registered = isFeatureGroup(chatId) || profile?.featureSets?.maturedMinded === true || chatId === PRIMARY_FEATURE_GROUP;
      return sock.sendMessage(chatId, {
        text: profileStatusText(profile, registered)
      }, { quoted: message });
    }

    if (!['setup', 'apply', 'on'].includes(action) || !['all', 'matured', 'general'].includes(requestedSet)) {
      return sock.sendMessage(chatId, {
        text: 'Usage: .groupforge setup [all|matured|general] | .groupforge status\n\n• all — both packages\n• matured — Matured Minded-exclusive lifecycle features\n• general — general Forge Guard group features'
      }, { quoted: message });
    }

    if (chatId === PRIMARY_FEATURE_GROUP) {
      return sock.sendMessage(chatId, { text: 'Matured Minded is the source group. Its feature packages are already configured here.' }, { quoted: message });
    }

    const applyMatured = requestedSet === 'all' || requestedSet === 'matured';
    const applyGeneral = requestedSet === 'all' || requestedSet === 'general';

    try {
      const [userData, sourceSettings, antispam, existingProfile] = await Promise.all([
        loadUserGroupData(),
        store.getAllSettings(PRIMARY_FEATURE_GROUP),
        store.getSetting('global', 'antispam'),
        store.getSetting(chatId, 'forgeGuardGroupProfile')
      ]);

      if (applyMatured) {
        const nextUserData = copyGroupUserData(userData, PRIMARY_FEATURE_GROUP, chatId, MATURED_MIND_EXCLUSIVE_MAPS);
        if (!await store.saveSettingVerified('global', 'userGroupData', nextUserData)) {
          throw new Error('Could not save the Matured Minded-exclusive welcome/lifecycle settings.');
        }
      }

      if (applyGeneral) {
        // Reload after the exclusive package write so the general-package save
        // cannot overwrite welcome/goodbye values with a stale pre-setup snapshot.
        const latestUserData = applyMatured ? await loadUserGroupData() : userData;
        const nextUserData = copyGroupUserData(latestUserData, PRIMARY_FEATURE_GROUP, chatId, GENERAL_GROUP_MAPS);
        if (!await store.saveSettingVerified('global', 'userGroupData', nextUserData)) {
          throw new Error('Could not save the general group feature switches.');
        }

        const nextAntispam = copyAntispamGroupConfig(antispam || {}, PRIMARY_FEATURE_GROUP, chatId);
        if (!await store.saveSettingVerified('global', 'antispam', nextAntispam)) {
          throw new Error('Could not save the AntiSpam group profile.');
        }

        const nextGroupSettings = copyGroupSettings(sourceSettings || {}, GENERAL_GROUP_SETTINGS);
        for (const [key, value] of Object.entries(nextGroupSettings)) {
          if (!await store.saveSettingVerified(chatId, key, value)) {
            throw new Error(`Could not save general group setting: ${key}`);
          }
        }
      }

      const featureSets = {
        maturedMinded: applyMatured || existingProfile?.featureSets?.maturedMinded === true || chatId === PRIMARY_FEATURE_GROUP,
        general: applyGeneral || existingProfile?.featureSets?.general === true || (!existingProfile && isFeatureGroup(chatId))
      };

      // Only the general package grants game/moderation feature-group access.
      // Matured Minded-only groups are tracked by the scheduler, but are not
      // added to the general game registry.
      if (featureSets.general) await registerFeatureGroup(chatId);
      else await unregisterFeatureGroup(chatId);

      if (applyMatured || applyGeneral) {
        if (!await trackGroup(chatId)) {
          throw new Error('Group features were saved, but scheduler registration could not be verified.');
        }
        startSchedulerEngine(sock);
      }

      const profile = {
        name: PROFILE_NAME,
        source: PRIMARY_FEATURE_GROUP,
        appliedAt: Date.now(),
        featureSets,
        features: enabledFeatureLines(featureSets)
      };
      if (!await store.saveSettingVerified(chatId, 'forgeGuardGroupProfile', profile)) {
        throw new Error('Features were applied, but profile metadata could not be saved. Run .groupforge setup again to verify.');
      }
      invalidateGroupFeatureAccessCache(chatId);

      const sections = [];
      if (applyMatured) sections.push(`*Matured Minded-exclusive package*\n${MATURED_MIND_EXCLUSIVE_FEATURES.map(item => `• ${item}`).join('\n')}`);
      if (applyGeneral) sections.push(`*General Forge Guard package*\n${GENERAL_GROUP_FEATURES.map(item => `• ${item}`).join('\n')}`);

      return sock.sendMessage(chatId, {
        text: `✅ *GROUP FEATURE SETUP COMPLETE*\n\n${sections.join('\n\n')}\n\nOnly the selected package(s) were applied. Existing settings in the other package were left untouched.\n\nLive game sessions, scores, member histories, pending introductions, conversation memory and lock timers were not copied.\n\nThe bot still needs WhatsApp admin rights for actions such as locking the group or removing members.`
      }, { quoted: message });
    } catch (error) {
      console.error('[GROUPFORGE] Profile setup failed:', error);
      return sock.sendMessage(chatId, {
        text: `⚠️ *GROUP SETUP INCOMPLETE*\n\n${error.message}\n\nNo live game history or member records were copied. You can safely rerun the selected *.groupforge setup* command to complete the configuration.`
      }, { quoted: message });
    }
  }
};
