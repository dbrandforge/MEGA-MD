import { describe, expect, it } from 'vitest';
import { personalizeWyrOptions } from '../../plugins/wyr.js';

describe('WYR gender adaptation', () => {
  it('uses female partner references for members registered as guys', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner'], 'guy'))
      .toEqual(['A woman who listens', 'Tell your woman']);
  });

  it('uses male partner references for members registered as ladies', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner'], 'lady'))
      .toEqual(['A man who listens', 'Tell your man']);
  });
});
