import { describe, it, expect } from 'vitest';
import {
    normalizeIdentityNumber,
    resolveIdentity,
    getIdentityReply,
    getIdentityGreeting
} from '../../lib/identity.js';

const identities = {
    creatorNumber: '2349034451454',
    creatorName: 'Forge dcreative',
    creatorFullName: 'Abraham Oyetunji',
    queenNumber: '2348126885208',
    queenTitle: 'The Queen',
    queenAlias: 'Empire',
    queenRealName: 'Tessy',
    creatorAlias: 'Forge'
};

describe('Forge Guard identity recognition', () => {
    it('normalizes phone JIDs and device-qualified JIDs', () => {
        expect(normalizeIdentityNumber('2349034451454@s.whatsapp.net')).toBe('2349034451454');
        expect(normalizeIdentityNumber('2349034451454:12@s.whatsapp.net')).toBe('2349034451454');
    });

    it('recognises the Creator by phone identity', () => {
        expect(resolveIdentity('2349034451454@s.whatsapp.net', identities)).toMatchObject({
            role: 'creator',
            name: 'Forge dcreative',
            fullName: 'Abraham Oyetunji'
        });
    });

    it('recognises The Queen without granting an owner role', () => {
        expect(resolveIdentity('2348126885208@s.whatsapp.net', identities)).toMatchObject({
            role: 'queen',
            name: 'Empire',
            alias: 'Empire',
            fullName: 'Tessy'
        });
        expect(resolveIdentity('2348126885208@s.whatsapp.net', identities)?.role).not.toBe('creator');
    });

    it('does not recognise an unrelated number or an unresolved LID', () => {
        expect(resolveIdentity('2348000000000@s.whatsapp.net', identities)).toBeNull();
        expect(resolveIdentity('123456789@lid', identities)).toBeNull();
    });

    it('identifies Forge dcreative and the government name when asked', () => {
        const answer = getIdentityReply('Who created this bot? What is your creator full name?', identities);
        expect(answer).toContain('Forge dcreative');
        expect(answer).toContain('Abraham Oyetunji');
    });

    it('matches natural-language creator full-name variants', () => {
        for (const question of [
            "What is your creators full name",
            "What's your creator's full name?",
            "What is your creator's full name?",
            "Tell me your creator's full name"
        ]) {
            expect(getIdentityReply(question, identities)).toContain('Abraham Oyetunji');
        }
    });

    it('answers who am I using the recognised sender identity', () => {
        const creator = resolveIdentity('2349034451454', identities);
        const queen = resolveIdentity('2348126885208', identities);
        expect(getIdentityReply('Who am I?', identities, creator)).toContain('Forge');
        expect(getIdentityReply('Who am I?', identities, creator)).toContain('Abraham Oyetunji');
        expect(getIdentityReply('Who am I?', identities, queen)).toContain('Empire');
        expect(getIdentityReply('Who am I?', identities, queen)).toContain('Tessy');
    });

    it('answers who the Queen is without disclosing her phone number', () => {
        const answer = getIdentityReply('Who is the Queen?', identities);
        expect(answer).toContain('special to my Creator');
        expect(answer).not.toContain(identities.queenNumber);
    });

    it('recognises Empire and answers her real-name question', () => {
        expect(getIdentityReply('Who is Empire?', identities)).toContain('Tessy');
        expect(getIdentityReply("What is the Queen's real name?", identities)).toContain('Tessy');
    });

    it('uses distinct Creator and Queen greeting styles', () => {
        expect(getIdentityGreeting('hello', resolveIdentity('2349034451454', identities))).toMatch(/Creator|Forge|architect|Chief/);
        expect(getIdentityGreeting('hello', resolveIdentity('2348126885208', identities))).toMatch(/Queen|Majesty/);
    });
});
