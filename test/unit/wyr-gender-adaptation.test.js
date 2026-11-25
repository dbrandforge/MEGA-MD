import { describe, expect, it } from 'vitest';
import { personalizeWyrOptions } from '../../plugins/wyr.js';

describe('WYR gender adaptation', () => {
  it('uses female partner references for members registered as guys', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner', 'Be told you are a good girl'], 'guy'))
      .toEqual(['A female partner who listens', 'Tell your female partner', 'Be told you are a good boy']);
  });

  it('uses male partner references for members registered as ladies', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner', 'Be told you are a good boy'], 'lady'))
      .toEqual(['A male partner who listens', 'Tell your male partner', 'Be told you are a good girl']);
  });
});
