// Canonical exercise categories ("Schwerpunkt" / training focus).
//
// The value is stored verbatim in the database — exactly like intensity's
// Low/Medium/High — and translated for display through the
// `exerciseCategories.<value>` i18n keys. Keep these keys in sync with the
// `exerciseCategories` block in src/locales/{en,de}.ts.
export const EXERCISE_CATEGORIES = [
  'Technique',   // Technikübung
  'Tactical',    // Taktikübung
  'Athletic',    // Athletische Übung
  'GameForm',    // Spielform
  'Passing',     // Passübung
  'Finishing',   // Torabschluss
  'SetPiece',    // Standardsituation
  'Warmup',      // Aufwärmen
] as const;

export type ExerciseCategory = typeof EXERCISE_CATEGORIES[number];

// Badge colour per category. Unknown / empty values (e.g. exercises created
// before this field existed) fall back to a neutral style so a badge never
// renders blank or crashes.
export const getCategoryStyles = (category?: string): string => {
  switch (category) {
    case 'Technique': return 'bg-sky-500/10 border-sky-500/20 text-sky-400';
    case 'Tactical':  return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
    case 'Athletic':  return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    case 'GameForm':  return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    case 'Passing':   return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
    case 'Finishing': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    case 'SetPiece':  return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    case 'Warmup':    return 'bg-lime-500/10 border-lime-500/20 text-lime-400';
    default:          return 'bg-surface-raised border-border text-muted';
  }
};
