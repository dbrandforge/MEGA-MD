import { describe, expect, it } from 'vitest';
import {
  getPickYourSinMediaKind,
  getPickYourSinMessageContext,
  validatePickYourSinTruthAnswer
} from '../../plugins/pick-your-sin-response.js';

describe('PICK YOUR SIN response validation', () => {
  it('rejects empty, one-word, yes/no and low-detail truth answers', () => {
    for (const answer of ['', 'No', 'Done', 'I have', 'I have not', 'Yes, I did that once']) {
      expect(validatePickYourSinTruthAnswer(answer).accepted).toBe(false);
    }
  });

  it('accepts a sufficiently detailed personal truth response', () => {
    expect(validatePickYourSinTruthAnswer(
      'I remember that moment clearly because it happened after our first date and changed how I felt.'
    ).accepted).toBe(true);
  });

  it('distinguishes voice notes from ordinary audio and recognizes image/video proof', () => {
    expect(getPickYourSinMediaKind({ message: { audioMessage: { ptt: true } } })).toBe('voice');
    expect(getPickYourSinMediaKind({ message: { audioMessage: { ptt: false } } })).toBe('audio');
    expect(getPickYourSinMediaKind({ message: { imageMessage: {} } })).toBe('image');
    expect(getPickYourSinMediaKind({ message: { videoMessage: {} } })).toBe('video');
    expect(getPickYourSinMediaKind({ message: { conversation: 'done' } })).toBe('text');
  });

  it('unwraps WhatsApp ephemeral media and reads its reply context', () => {
    const message = {
      message: {
        ephemeralMessage: {
          message: {
            videoMessage: { contextInfo: { stanzaId: 'prompt-1' } }
          }
        }
      }
    };
    expect(getPickYourSinMediaKind(message)).toBe('video');
    expect(getPickYourSinMessageContext(message).stanzaId).toBe('prompt-1');
  });
});
