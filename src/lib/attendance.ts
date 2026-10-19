import type { TrainingAttendance, TrainingSession } from '../types/models';
import { splitCsv } from './csv';

export const ABSENCE_REASONS = ['injury', 'illness', 'school', 'excused', 'unexcused'] as const;

export type AttendanceIndex = Map<string, TrainingAttendance[]>;

export function indexAttendance(records: TrainingAttendance[]): AttendanceIndex {
  const index: AttendanceIndex = new Map();
  for (const r of records) {
    const list = index.get(r.sessionId);
    if (list) list.push(r);
    else index.set(r.sessionId, [r]);
  }
  return index;
}

// Recorded sessions count who actually came; unrecorded ones fall back to the planned squad.
export function attendedPlayerIds(session: TrainingSession, index: AttendanceIndex): string[] {
  const recorded = index.get(session.id);
  if (recorded) return recorded.filter(r => r.status === 'present').map(r => r.playerId);
  return [...new Set(splitCsv(session.selectedPlayers))];
}

export const isRecorded = (session: TrainingSession, index: AttendanceIndex) => index.has(session.id);

export function attendanceRates(sessions: TrainingSession[], index: AttendanceIndex): Record<string, number> {
  if (!sessions.length) return {};
  const counts: Record<string, number> = {};
  for (const s of sessions) for (const id of attendedPlayerIds(s, index)) counts[id] = (counts[id] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, Math.round((n / sessions.length) * 100)]));
}
