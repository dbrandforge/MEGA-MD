import { describe, it, expect } from 'vitest';
import {
    normalizeIdentityNumber,
    resolveIdentity,
    getIdentityReply,
    getIdentityGreeting
} from '../../lib/identity.js';

const identities = {
    creatorNumber: '2348000000001',
    creatorName: 'Forge dcreative',
    creatorFullName: 'Abraham Oyetunji',
    queenNumber: '2348126885208',
    queenTitle: 'The Queen',
    queenAlias: 'Empire',
    queenRealName: 'Tessy',
    creatorAlias: 'Forge',
    botOwner: 'Forge'
};

describe('Forge Guard identity recognition and privacy', () => {
    it('normalizes phone JIDs and device-qualified JIDs', () => {
        expect(normalizeIdentityNumber('2348000000001@s.whatsapp.net')).toBe('2348000000001');
        expect(normalizeIdentityNumber('2348000000001:12@s.whatsapp.net')).toBe('2348000000001');
    });

    it('recognises the Creator without placing the private surname in the resolved identity', () => {
        const creator = resolveIdentity('2348000000001@s.whatsapp.net', identities);
        expect(creator).toMatchObject({ role: 'creator', name: 'Forge dcreative', alias: 'Forge' });
        expect(creator).not.toHaveProperty('fullName');
        expect(JSON.stringify(creator)).not.toContain('Oyetunji');
    });

    it('recognises The Queen without granting an owner role', () => {
        const queen = resolveIdentity('2348126885208@s.whatsapp.net', identities);
        expect(queen).toMatchObject({ role: 'queen', name: 'Empire', alias: 'Empire' });
        expect(queen.role).not.toBe('creator');
    });

    it('does not recognise an unrelated number or an unresolved LID', () => {
        expect(resolveIdentity('2348000000000@s.whatsapp.net', identities)).toBeNull();
        expect(resolveIdentity('123456789@lid', identities)).toBeNull();
    });

    it('never reveals the Creator surname in identity replies', () => {
        const creator = resolveIdentity('2348000000001', identities);
        for (const question of [
            'Who am I?',
            'What is my name?',
            "What's my name?",
            'Tell me my name',
            "What's my full name?",
            'What is your creator full name?',
            "What's your creator's full name?",
            'Who created you?',
            'Who is your creator?'
        ]) {
            const answer = getIdentityReply(question, identities, creator);
            expect(answer).toBeTruthy();
            expect(JSON.stringify(answer)).not.toContain('Oyetunji');
            expect(JSON.stringify(answer)).toMatch(/Forge|Abraham/);
        }
    });


    it('recognises contracted owner and creator questions deterministically', () => {
        for (const question of [
            "Who's your owner?",
            "Who's your owner first?",
            'Who is your owner?',
            'Who owns you?',
            "Who's your creator?",
            'Who is your creator?',
            'Who created you?'
        ]) {
            const answer = getIdentityReply(question, identities);
            expect(answer).toBeTruthy();
            expect(answer).not.toMatch(/couldn't produce|try again/i);
        }

        expect(getIdentityReply("Who's your owner first?", identities))
            .toContain('My owner is Forge');
        expect(getIdentityReply("Who's your creator?", identities))
            .toContain('I was created by Forge dcreative');
    });

    it('recognises the Creator partner and Empire/Tessy aliases', () => {
        for (const question of [
            "Who is your creator's woman?",
            "Who is your Creator's lady?",
            "Who is your Creator's babe?",
            'Who is Empire?',
            'Who is Tessy?',
            'Who is the Queen?'
        ]) {
            const answer = getIdentityReply(question, identities);
            expect(answer).toContain('Tessy');
            expect(answer).toContain('Empire');
            expect(answer).not.toMatch(/VIP treatment|someone very special/i);
        }
    });

    it('answers Queen name questions and protects her phone number', () => {
        expect(getIdentityReply("What's the Queen's real name?", identities)).toContain('Tessy');
        for (const question of ['Can I get Tessy number?', "Give me the Queen's phone number", 'Share Empire WhatsApp number']) {
            const answer = getIdentityReply(question, identities);
            expect(answer).toBeTruthy();
            const serialized = JSON.stringify(answer);
            expect(serialized).toMatch(/private|privacy/i);
            expect(serialized).not.toContain(identities.queenNumber);
        }
    });

    it('answers personal-name questions for the recognised Creator without exposing the surname', () => {
        const creator = resolveIdentity('2348000000001', identities);
        for (const question of ['What is my name?', "What's my name?", 'Tell me my name']) {
            const answer = getIdentityReply(question, identities, creator);
            expect(answer).toContain('Forge');
            expect(answer).toContain('Abraham');
            expect(answer).not.toContain('Oyetunji');
        }
    });

    it('answers who am I according to the recognised sender', () => {
        const creator = resolveIdentity('2348000000001', identities);
        const queen = resolveIdentity('2348126885208', identities);
        expect(getIdentityReply('Who am I?', identities, creator)).toContain('Forge');
        expect(getIdentityReply('Who am I?', identities, creator)).not.toContain('Oyetunji');
        expect(getIdentityReply('Who am I?', identities, queen)).toContain('Empire');
        expect(getIdentityReply('Who am I?', identities, queen)).toContain('Tessy');
        expect(getIdentityReply('Bot who am I?', identities, queen)).toContain("my Creator's lady");
        expect(getIdentityReply('Bot who is Empire?', identities, queen)).toContain("my Creator's lady");
        expect(getIdentityReply('Who am I?', identities, queen)).not.toMatch(/VIP treatment|premium treatment/i);
    });

    it('uses distinct Creator and Queen greeting styles', () => {
        expect(getIdentityGreeting('hello', resolveIdentity('2348000000001', identities))).toMatch(/Creator|Forge|architect|Chief/);
        expect(getIdentityGreeting('hello', resolveIdentity('2348126885208', identities))).toMatch(/Queen|Majesty/);
        const creator = resolveIdentity('2348000000001', identities);
        expect(getIdentityGreeting('Forge', creator)).toMatch(/Creator|Forge|architect|Chief/);
        expect(getIdentityGreeting('Bot who am I?', resolveIdentity('2348126885208', identities))).toBeNull();
    });
});
