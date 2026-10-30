import { describe, expect, it } from 'vitest';
import { guysBasket, ladiesBasket } from '../../data/devilsBasket.js';
import { getTruths, getDares, randomFrom } from '../../data/todLists.js';

describe('gender-specific game data', () => {
  it('keeps independent Devil’s Basket pools for guys and ladies', () => {
    expect(Object.keys(guysBasket).length).toBeGreaterThan(0);
    expect(Object.keys(ladiesBasket).length).toBeGreaterThan(0);
    expect(new Set(Object.values(guysBasket)).size).toBe(Object.values(guysBasket).length);
    expect(new Set(Object.values(ladiesBasket)).size).toBe(Object.values(ladiesBasket).length);
  });

  it('returns the matching Truth & Dare lists for each registered gender', () => {
    expect(getTruths('guy').length).toBeGreaterThan(0);
    expect(getTruths('lady').length).toBeGreaterThan(0);
    expect(getDares('guy').length).toBeGreaterThan(0);
    expect(getDares('lady').length).toBeGreaterThan(0);
    expect(getTruths('guy')).not.toBe(getTruths('lady'));
    expect(getDares('guy')).not.toBe(getDares('lady'));
  });

  it('selects an item from the supplied list', () => {
    const list = ['one', 'two', 'three'];
    expect(list).toContain(randomFrom(list));
  });
});
