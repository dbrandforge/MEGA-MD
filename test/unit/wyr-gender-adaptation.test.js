import { describe, expect, it } from 'vitest';
import { personalizeWyrOptions } from '../../plugins/wyr.js';

describe('WYR gender adaptation', () => {
  it('uses female partner references for members registered as guys', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner'], 'guy'))
      .toEqual(['A female partner who listens', 'Tell your female partner']);
  });

  it('uses male partner references for members registered as ladies', () => {
    expect(personalizeWyrOptions(['A partner who listens', 'Tell your partner'], 'lady'))
      .toEqual(['A male partner who listens', 'Tell your male partner']);
  });
});
