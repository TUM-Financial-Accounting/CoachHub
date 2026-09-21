import { describe, it, expect } from 'vitest';
import { snapStartMinutes, itemDuration } from './WeekCalendar';
import type { CalendarItem } from './WeekCalendar';

const item = (startTime: string, endTime: string): CalendarItem => ({
  id: 'x', kind: 'event', title: 'X', date: '2026-08-17', startTime, endTime,
});

describe('itemDuration', () => {
  it('measures a normal block', () => {
    expect(itemDuration(item('17:00', '18:30'))).toBe(90);
  });

  it('treats an end at or before the start as running past midnight', () => {
    expect(itemDuration(item('23:00', '00:00'))).toBe(60);
    expect(itemDuration(item('22:30', '01:00'))).toBe(150);
  });

  it('falls back to an hour for a zero-length or unparseable block', () => {
    expect(itemDuration(item('17:00', '17:00'))).toBe(60);
    expect(itemDuration(item('17:00', ''))).toBe(60);
    expect(itemDuration(item('', ''))).toBe(60);
  });
});

describe('snapStartMinutes', () => {
  const base = { rowHeight: 60, effStart: 7, effEnd: 22, duration: 60 };

  it('snaps the pointer position to the nearest quarter hour', () => {
    // 60px per hour, so 70px below the top of a 07:00 grid = 08:10 → 08:15.
    expect(snapStartMinutes({ ...base, offsetY: 70 })).toBe(8 * 60 + 15);
    expect(snapStartMinutes({ ...base, offsetY: 65 })).toBe(8 * 60);
  });

  it('never starts before the first visible hour', () => {
    expect(snapStartMinutes({ ...base, offsetY: -500 })).toBe(7 * 60);
  });

  it('keeps the whole block inside the visible window', () => {
    // Last hour is 22:00; a 60-minute block can start no later than 21:00.
    expect(snapStartMinutes({ ...base, offsetY: 100000 })).toBe(21 * 60);
    expect(snapStartMinutes({ ...base, offsetY: 100000, duration: 120 })).toBe(20 * 60);
  });

  it('stays a real time of day when the item is longer than the window', () => {
    // A 20-hour block collapses onto the window start instead of a negative time.
    const start = snapStartMinutes({ ...base, offsetY: 500, duration: 20 * 60 });
    expect(start).toBe(7 * 60);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it('never lets a block spill past midnight even if the window claims to', () => {
    expect(snapStartMinutes({ ...base, offsetY: 100000, effEnd: 26, duration: 90 }))
      .toBe(24 * 60 - 90);
  });

  it('degrades safely when the grid has not been measured yet', () => {
    expect(snapStartMinutes({ ...base, offsetY: 200, rowHeight: 0 })).toBe(7 * 60);
  });
});
