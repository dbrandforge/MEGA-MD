import { describe, expect, it } from 'vitest';
import { isEarlyManualUnlockUpdate } from '../../plugins/grouplock.js';

describe('early manual group unlock detection', () => {
  it('recognizes a group opening before scheduled unlock', () => {
    expect(isEarlyManualUnlockUpdate({ announce: false }, { locked: true }, 300, 360)).toBe(true);
  });
  it('ignores scheduled-time or late unlocks', () => {
    expect(isEarlyManualUnlockUpdate({ announce: false }, { locked: true }, 360, 360)).toBe(false);
    expect(isEarlyManualUnlockUpdate({ announce: false }, { locked: true }, 420, 360)).toBe(false);
  });
  it('ignores locked-state false and updates that do not open the group', () => {
    expect(isEarlyManualUnlockUpdate({ announce: true }, { locked: true }, 300, 360)).toBe(false);
    expect(isEarlyManualUnlockUpdate({ announce: false }, { locked: false }, 300, 360)).toBe(false);
  });
});
