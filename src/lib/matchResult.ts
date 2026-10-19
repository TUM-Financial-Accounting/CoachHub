import type { MatchDetails } from '../types/models';
import { isPast } from './dates';

// U = the match date has passed but no score was entered.
export type MatchOutcome = 'W' | 'D' | 'L' | 'U';

type Scored = Pick<MatchDetails, 'date' | 'goalsFor' | 'goalsAgainst'>;

export const hasResult = (m: Pick<MatchDetails, 'goalsFor' | 'goalsAgainst'>): boolean =>
  m.goalsFor !== undefined && m.goalsAgainst !== undefined;

export const isUnrecorded = (m: Scored): boolean => !hasResult(m) && isPast(m.date);

// null for an upcoming match without a result.
export const matchOutcome = (m: Scored): MatchOutcome | null => {
  const { goalsFor: gf, goalsAgainst: ga } = m;
  if (gf !== undefined && ga !== undefined) return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  return isPast(m.date) ? 'U' : null;
};
