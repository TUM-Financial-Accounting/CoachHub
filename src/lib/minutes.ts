import type { MatchSubstitution } from '../types/models';

// Same value as constants.DEFAULT_MATCH_MINUTES in the backend.
export const DEFAULT_MATCH_MINUTES = 90;

// Minutes on the pitch per player: starters from 0, substitutes from their minute,
// everyone until they are taken off or the match ends.
export function minutesPlayed(starterIds: string[], subs: MatchSubstitution[], duration = DEFAULT_MATCH_MINUTES): Map<string, number> {
  const clamp = (m: number) => Math.max(0, Math.min(duration, m));
  const onSince = new Map<string, number>(starterIds.map(id => [id, 0]));
  const minutes = new Map<string, number>(starterIds.map(id => [id, 0]));

  for (const sub of [...subs].sort((a, b) => a.minute - b.minute)) {
    const at = clamp(sub.minute);
    if (sub.playerOutId && onSince.has(sub.playerOutId)) {
      minutes.set(sub.playerOutId, (minutes.get(sub.playerOutId) ?? 0) + at - onSince.get(sub.playerOutId)!);
      onSince.delete(sub.playerOutId);
    }
    if (!onSince.has(sub.playerInId)) {
      onSince.set(sub.playerInId, at);
      if (!minutes.has(sub.playerInId)) minutes.set(sub.playerInId, 0);
    }
  }
  for (const [id, since] of onSince) minutes.set(id, (minutes.get(id) ?? 0) + duration - since);
  return minutes;
}
