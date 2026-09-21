// Multi-value columns (selected_players, equipment, linked_*) are stored as comma-joined strings.
export const splitCsv = (value?: string | null): string[] =>
  (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

export const joinCsv = (items: readonly string[]): string =>
  items.map(item => item.trim()).filter(Boolean).join(',');
