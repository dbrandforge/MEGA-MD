import { describe, expect, it } from 'vitest';
import { detectMessageLanguage, getLanguageInstruction, getLocalizedAnswerPrefix, getLocalizedFailureReply, getLocalizedSourceSummaryFailure } from '../../lib/chatbotLanguage.js';

describe('Forge Guard language matching', () => {
  it.each([
    ['What is criminology?', 'english'],
    ['Omo, what is criminology?', 'english'],
    ['Abeg, what is the current VC of FUOYE?', 'english'],
    ['My girlfriend no wan cook, she say make I drink garri', 'pidgin'],
    ['Abeg explain this matter, wetin e mean?', 'pidgin'],
    ['Omo', 'pidgin'],
    ['Ebi n pa mi', 'pidgin'],
    ['I dey hungry', 'pidgin'],
    ['Ẹ jọ̀ọ́, kí ni ìwà ọ̀daràn?', 'yoruba'],
    ['Mo fẹ́ mọ̀ nípa ilé-ẹ̀kọ́ náà', 'yoruba'],
    ['Báwo ni? Ṣé o wà dáadáa?', 'yoruba'],
    ['E jowo, se o wa daadaa?', 'yoruba']
  ])('detects %s as %s', (message, expected) => {
    expect(detectMessageLanguage(message)).toBe(expected);
  });

  it('recognises common unaccented Yoruba expressions used in casual chat', () => {
    expect(detectMessageLanguage('O ti sun mi')).toBe('yoruba');
    expect(detectMessageLanguage('Ori e ti yi')).toBe('yoruba');
    expect(detectMessageLanguage('Toor')).toBe('yoruba');
    expect(detectMessageLanguage('Oloshi')).toBe('yoruba');
  });

  it('inherits the last clear language for short contextual replies', () => {
    expect(detectMessageLanguage('ẹ ṣe', [{ name: 'User', text: 'Ẹ jọ̀ọ́, ṣàlàyé rẹ̀ fún mi' }])).toBe('yoruba');
    expect(detectMessageLanguage('na so?', [{ name: 'User', text: 'Abeg explain wetin happen' }])).toBe('pidgin');
  });

  it('inherits the most recent clear language, not an older language', () => {
    expect(detectMessageLanguage('Okay', [
      { name: 'User', text: 'Abeg explain wetin happen' },
      { name: 'Forge Bot', text: 'I can explain that.' },
      { name: 'User', text: 'That makes sense' }
    ])).toBe('english');
    expect(detectMessageLanguage('Okay', [
      { name: 'User', text: 'That makes sense' },
      { name: 'Forge Bot', text: 'No wahala.' },
      { name: 'User', text: 'Na so' }
    ])).toBe('pidgin');
  });

  it('returns strict response-language instructions', () => {
    expect(getLanguageInstruction('pidgin')).toContain('Nigerian Pidgin');
    expect(getLanguageInstruction('yoruba')).toContain('Yoruba');
    expect(getLanguageInstruction('english')).toContain('English');
    expect(getLocalizedAnswerPrefix('pidgin')).toBe('Answer na');
    expect(getLocalizedAnswerPrefix('yoruba')).toBe('Ìdáhùn ni');
    expect(getLocalizedFailureReply('pidgin')).toContain('I no fit');
    expect(getLocalizedFailureReply('yoruba')).toContain('Mi ò lè');
    expect(getLocalizedSourceSummaryFailure('yoruba')).toContain('Mo ti rí');
  });
});
