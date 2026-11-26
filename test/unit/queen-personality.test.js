import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickPersonalityReply } from '../../data/forgeBotPersonalityBank.js';

describe('Empire/Tessy personality fallback', () => {
    afterEach(() => vi.restoreAllMocks());

    it('uses affectionate language for the verified Queen while leaving standard replies unchanged', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const queenReply = pickPersonalityReply('I feel sad today', {
            chatId: 'queen-profile-test',
            identityRole: 'queen'
        });
        const standardReply = pickPersonalityReply('I feel sad today', {
            chatId: 'standard-profile-test'
        });

        expect(queenReply).toMatch(/my Queen|sweetheart|darling|love/i);
        expect(standardReply).not.toMatch(/my Queen|sweetheart|darling/i);
    });
});
