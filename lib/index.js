import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import { dataFile } from './paths.js';
import store from './lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const dataPath = dataFile('userGroupData.json');

function cleanNumber(jid) {
    if (!jid) return '';
    return String(jid).split(':')[0].split('@')[0].replace(/\D/g, '');
}

async function loadUserGroupData() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'userGroupData');
            return data || {
                antibadword: {}, antilink: {}, welcome: {}, goodbye: {},
                chatbot: {}, warnings: {}, sudo: [], antitag: {}
            };
        } else {
            if (!fs.existsSync(dataPath)) {
                const defaultData = {
                    antibadword: {}, antilink: {}, welcome: {}, goodbye: {},
                    chatbot: {}, warnings: {}, sudo: [], antitag: {}
                };
                fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
                return defaultData;
            }
            return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading user group data:', error);
        return {
            antibadword: {}, antilink: {}, welcome: {}, goodbye: {},
            chatbot: {}, warnings: {}, sudo: [], antitag: {}
        };
    }
}

async function saveUserGroupData(data) {
    try {
        if (HAS_DB) {
            await store.saveSetting('global', 'userGroupData', data);
        } else {
            const dir = path.dirname(dataPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        }
        return true;
    } catch (error) {
        console.error('Error saving user group data:', error);
        return false;
    }
}

async function setAntilink(groupId, type, action) {
    try {
        const data = await loadUserGroupData();
        if (!data.antilink) data.antilink = {};
        data.antilink[groupId] = { enabled: type === 'on', action: action || 'delete' };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function getAntilink(groupId, type) {
    try {
        const data = await loadUserGroupData();
        if (!data.antilink || !data.antilink[groupId]) return null;
        return type === 'on' ? data.antilink[groupId] : null;
    } catch (error) {
        return null;
    }
}

async function removeAntilink(groupId, _type) {
    try {
        const data = await loadUserGroupData();
        if (data.antilink && data.antilink[groupId]) {
            delete data.antilink[groupId];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function setAntitag(groupId, type, action) {
    try {
        const data = await loadUserGroupData();
        if (!data.antitag) data.antitag = {};
        data.antitag[groupId] = { enabled: type === 'on', action: action || 'delete' };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function getAntitag(groupId, type) {
    try {
        const data = await loadUserGroupData();
        if (!data.antitag || !data.antitag[groupId]) return null;
        return type === 'on' ? data.antitag[groupId] : null;
    } catch (error) {
        return null;
    }
}

async function removeAntitag(groupId, _type) {
    try {
        const data = await loadUserGroupData();
        if (data.antitag && data.antitag[groupId]) {
            delete data.antitag[groupId];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function incrementWarningCount(groupId, userId) {
    try {
        const data = await loadUserGroupData();
        if (!data.warnings) data.warnings = {};
        if (!data.warnings[groupId]) data.warnings[groupId] = {};
        if (!data.warnings[groupId][userId]) data.warnings[groupId][userId] = 0;
        data.warnings[groupId][userId]++;
        await saveUserGroupData(data);
        return data.warnings[groupId][userId];
    } catch (error) {
        return 0;
    }
}

async function resetWarningCount(groupId, userId) {
    try {
        const data = await loadUserGroupData();
        if (data.warnings?.[groupId]?.[userId]) {
            data.warnings[groupId][userId] = 0;
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

/** Improved sudo check - matches by number even if LID vs JID differs */
async function isSudo(userId) {
    try {
        const data = await loadUserGroupData();
        if (!data.sudo || !Array.isArray(data.sudo)) return false;

        const userNum = cleanNumber(userId);
        if (!userNum) return false;

        // Exact match or number match
        return data.sudo.some(sudoJid => {
            if (sudoJid === userId) return true;
            return cleanNumber(sudoJid) === userNum;
        });
    } catch (error) {
        console.error('Error checking sudo:', error);
        return false;
    }
}

async function addSudo(userJid) {
    try {
        const data = await loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        if (!data.sudo.includes(userJid)) {
            data.sudo.push(userJid);
            // Also store clean number version for better matching
            const num = cleanNumber(userJid);
            if (num && !data.sudo.includes(num + '@s.whatsapp.net')) {
                data.sudo.push(num + '@s.whatsapp.net');
            }
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error adding sudo:', error);
        return false;
    }
}

async function removeSudo(userJid) {
    try {
        const data = await loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        const num = cleanNumber(userJid);
        data.sudo = data.sudo.filter(s => s !== userJid && cleanNumber(s) !== num);
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function getSudoList() {
    try {
        const data = await loadUserGroupData();
        return Array.isArray(data.sudo) ? data.sudo : [];
    } catch (error) {
        return [];
    }
}

async function addWelcome(jid, enabled, message) {
    try {
        const data = await loadUserGroupData();
        if (!data.welcome) data.welcome = {};
        data.welcome[jid] = {
            enabled,
            message: message || 'Welcome {user} to {group}!',
            channelId: ''
        };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function delWelcome(jid) {
    try {
        const data = await loadUserGroupData();
        if (data.welcome?.[jid]) {
            delete data.welcome[jid];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function isWelcomeOn(jid) {
    try {
        const data = await loadUserGroupData();
        return data.welcome?.[jid]?.enabled || false;
    } catch (error) {
        return false;
    }
}

async function addGoodbye(jid, enabled, message) {
    try {
        const data = await loadUserGroupData();
        if (!data.goodbye) data.goodbye = {};
        data.goodbye[jid] = { enabled, message: message || 'Goodbye {user}', channelId: '' };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function delGoodBye(jid) {
    try {
        const data = await loadUserGroupData();
        if (data.goodbye?.[jid]) {
            delete data.goodbye[jid];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function isGoodByeOn(jid) {
    try {
        const data = await loadUserGroupData();
        return data.goodbye?.[jid]?.enabled || false;
    } catch (error) {
        return false;
    }
}

async function getWelcome(jid) {
    try {
        const data = await loadUserGroupData();
        return data.welcome?.[jid]?.message || null;
    } catch (error) {
        return null;
    }
}

async function getGoodbye(jid) {
    try {
        const data = await loadUserGroupData();
        return data.goodbye?.[jid]?.message || null;
    } catch (error) {
        return null;
    }
}

async function setAntiBadword(groupId, type, action) {
    try {
        const data = await loadUserGroupData();
        if (!data.antibadword) data.antibadword = {};
        data.antibadword[groupId] = { enabled: type === 'on', action: action || 'delete' };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function getAntiBadword(groupId, type) {
    try {
        const data = await loadUserGroupData();
        if (!data.antibadword?.[groupId]) return null;
        return type === 'on' ? data.antibadword[groupId] : null;
    } catch (error) {
        return null;
    }
}

async function removeAntiBadword(groupId, _type) {
    try {
        const data = await loadUserGroupData();
        if (data.antibadword?.[groupId]) {
            delete data.antibadword[groupId];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function setChatbot(groupId, enabled) {
    try {
        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};
        data.chatbot[groupId] = { enabled };
        await saveUserGroupData(data);
        return true;
    } catch (error) {
        return false;
    }
}

async function getChatbot(groupId) {
    try {
        const data = await loadUserGroupData();
        return data.chatbot?.[groupId] || null;
    } catch (error) {
        return null;
    }
}

async function removeChatbot(groupId) {
    try {
        const data = await loadUserGroupData();
        if (data.chatbot?.[groupId]) {
            delete data.chatbot[groupId];
            await saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        return false;
    }
}

export {
    setAntilink, getAntilink, removeAntilink,
    setAntitag, getAntitag, removeAntitag,
    incrementWarningCount, resetWarningCount,
    isSudo, addSudo, removeSudo, getSudoList,
    addWelcome, delWelcome, isWelcomeOn, getWelcome,
    addGoodbye, delGoodBye, isGoodByeOn, getGoodbye,
    setAntiBadword, getAntiBadword, removeAntiBadword,
    setChatbot, getChatbot, removeChatbot,
    loadUserGroupData, saveUserGroupData
};
