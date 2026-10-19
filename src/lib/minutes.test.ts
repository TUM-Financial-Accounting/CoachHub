import { describe, it, expect } from 'vitest';
import { minutesPlayed } from './minutes';
import type { MatchSubstitution } from '../types/models';

const sub = (playerInId: string, playerOutId: string | null, minute: number): MatchSubstitution =>
  ({ id: `${playerInId}-${minute}`, matchId: 'm1', playerInId, playerOutId, minute });
const asObject = (m: Map<string, number>) => Object.fromEntries(m);

describe('minutesPlayed', () => {
  it('gives every starter the full match without substitutions', () => {
    expect(asObject(minutesPlayed(['a', 'b'], []))).toEqual({ a: 90, b: 90 });
  });

  it('splits the match between the player going off and the one coming on', () => {
    expect(asObject(minutesPlayed(['a', 'b'], [sub('c', 'a', 60)]))).toEqual({ a: 60, b: 90, c: 30 });
  });

  it('counts an extra player who replaced nobody', () => {
    expect(asObject(minutesPlayed(['a'], [sub('c', null, 80)]))).toEqual({ a: 90, c: 10 });
  });

  it('adds up two spells for a player taken off and brought back', () => {
    const subs = [sub('c', 'a', 30), sub('a', 'c', 50)];
    expect(asObject(minutesPlayed(['a'], subs))).toEqual({ a: 70, c: 20 });
  });

  it('processes substitutions in minute order whatever order they come in', () => {
    const subs = [sub('d', 'c', 75), sub('c', 'a', 45)];
    expect(asObject(minutesPlayed(['a'], subs))).toEqual({ a: 45, c: 30, d: 15 });
  });

  it('uses the match length and clamps minutes past it', () => {
    expect(asObject(minutesPlayed(['a'], [sub('c', 'a', 95)], 70))).toEqual({ a: 70, c: 0 });
    expect(asObject(minutesPlayed(['a'], [sub('c', 'a', 50)], 70))).toEqual({ a: 50, c: 20 });
  });

  it('ignores taking off a player who is not on the pitch', () => {
    expect(asObject(minutesPlayed(['a'], [sub('c', 'zz', 40)]))).toEqual({ a: 90, c: 50 });
  });
});
