import { describe, expect, it } from 'vitest';
import { createGroupInFlightGuard } from '../../plugins/grouplock.js';

describe('GroupLock in-flight guards', () => {
  it('skips overlapping work for the same group while allowing other groups', async () => {
    const runOnce = createGroupInFlightGuard();
    let releaseFirst;
    const first = runOnce('group-a', () => new Promise(resolve => {
      releaseFirst = resolve;
    }));

    await Promise.resolve();
    const duplicate = await runOnce('group-a', async () => 'duplicate');
    const otherGroup = await runOnce('group-b', async () => 'independent');

    expect(duplicate).toBe(false);
    expect(otherGroup).toBe('independent');

    releaseFirst('completed');
    await expect(first).resolves.toBe('completed');
  });

  it('releases the group guard after an operation rejects', async () => {
    const runOnce = createGroupInFlightGuard();
    await expect(runOnce('group-a', async () => {
      throw new Error('expected failure');
    })).rejects.toThrow('expected failure');

    await expect(runOnce('group-a', async () => 'retry')).resolves.toBe('retry');
  });
});
