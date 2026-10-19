import { describe, it, expect } from 'vitest';
import { attendanceRates, attendedPlayerIds, indexAttendance, isRecorded } from './attendance';
import type { TrainingAttendance, TrainingSession } from '../types/models';

const session = (id: string, players: string): TrainingSession => ({
  id, date: '2026-09-01', startTime: '17:00', endTime: '18:30', focus: 'X', intensity: 'Medium', selectedPlayers: players, selectedExercises: '',
});
const rec = (sessionId: string, playerId: string, status: TrainingAttendance['status']): TrainingAttendance =>
  ({ sessionId, playerId, status, reason: status === 'absent' ? 'illness' : null });

describe('attendance', () => {
  it('uses who was recorded present once attendance is taken', () => {
    const index = indexAttendance([rec('s1', 'a', 'present'), rec('s1', 'b', 'absent'), rec('s1', 'c', 'present')]);
    expect(attendedPlayerIds(session('s1', 'a,b'), index)).toEqual(['a', 'c']);
    expect(isRecorded(session('s1', ''), index)).toBe(true);
  });

  it('falls back to the planned squad, without duplicates, when nothing was recorded', () => {
    const index = indexAttendance([]);
    expect(attendedPlayerIds(session('s2', 'a, b,a'), index)).toEqual(['a', 'b']);
    expect(isRecorded(session('s2', 'a'), index)).toBe(false);
  });

  it('treats a recorded session where everyone was absent as nobody attending', () => {
    const index = indexAttendance([rec('s1', 'a', 'absent')]);
    expect(attendedPlayerIds(session('s1', 'a'), index)).toEqual([]);
  });

  it('computes each player\'s share of the sessions', () => {
    const sessions = [session('s1', 'a,b'), session('s2', 'a,b'), session('s3', 'a'), session('s4', 'a')];
    const index = indexAttendance([rec('s2', 'a', 'present'), rec('s2', 'b', 'absent')]);
    expect(attendanceRates(sessions, index)).toEqual({ a: 100, b: 25 });
    expect(attendanceRates([], index)).toEqual({});
  });
});
