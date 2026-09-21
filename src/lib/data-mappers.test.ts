import { describe, it, expect } from 'vitest';
import {
  mapPlayerFromApi,
  mapPlayerToApi,
  mapSessionFromApi,
  mapSessionToApi,
  mapBasicFromApi,
  mapPrincipleFromApi,
  mapTacticFromApi,
  mapTacticToApi,
  mapExerciseFromApi,
  mapExerciseToApi,
  mapMatchFromApi,
  mapMatchDetailsFromApi,
  mapMatchDetailsToApi,
  mapMatchEventFromApi,
  mapEventFromApi,
  mapEventToApi,
  mapSelectorItemFromApi,
  mapAdminFeedbackFromApi,
  mapAdminUserFromApi,
  mapAdminStatsFromApi,
  mapGoogleStatusFromApi,
  mapGoogleSyncResultFromApi,
} from './data-mappers';
import type { Player, TrainingSession, Exercise, Tactic, MatchDetails, CalendarEvent } from '../types/models';

describe('mapPlayerFromApi', () => {
  it('translates every snake_case field to its camelCase counterpart', () => {
    const player = mapPlayerFromApi({
      id: 'p1',
      first_name: 'Lena',
      last_name: 'Bauer',
      date_of_birth: '2010-04-02',
      position: 'Midfielder',
      jersey_number: 8,
      status: 'Active',
      player_phone: '0170',
      height: 152,
      weight: 41.5,
      clothing_size: 'M',
      strong_foot: 'Left',
      mother_name: 'Anna',
      mother_phone: '0171',
      father_name: 'Tom',
      father_phone: '0172',
      image_url: '/static/uploads/x.png',
      attendance: 92,
      performance: 4,
      is_trial: true,
      home_club: 'FC Nord',
      trial_rating: 3,
      trial_notes: 'Good first touch',
      teams: [{ id: 't1', name: 'U15', formation: '4-4-2' }],
    });

    expect(player).toEqual({
      id: 'p1',
      firstName: 'Lena',
      lastName: 'Bauer',
      dateOfBirth: '2010-04-02',
      position: 'Midfielder',
      jerseyNumber: 8,
      status: 'Active',
      playerPhone: '0170',
      height: 152,
      weight: 41.5,
      clothingSize: 'M',
      strongFoot: 'Left',
      motherName: 'Anna',
      motherPhone: '0171',
      fatherName: 'Tom',
      fatherPhone: '0172',
      imageUrl: '/static/uploads/x.png',
      attendance: 92,
      performance: 4,
      isTrial: true,
      homeClub: 'FC Nord',
      trialRating: 3,
      trialNotes: 'Good first touch',
      teams: [{ id: 't1', name: 'U15', formation: '4-4-2' }],
    });
  });

  it('fills defaults for a sparse payload rather than leaving fields undefined', () => {
    const player = mapPlayerFromApi({ id: 'p2' });

    expect(player.firstName).toBe('');
    expect(player.position).toBe('Unknown');
    expect(player.status).toBe('Unknown');
    expect(player.jerseyNumber).toBe(0);
    expect(player.teams).toEqual([]);
  });

  it('coerces is_trial to a real boolean', () => {
    expect(mapPlayerFromApi({ id: 'p3', is_trial: null }).isTrial).toBe(false);
    expect(mapPlayerFromApi({ id: 'p4', is_trial: 1 }).isTrial).toBe(true);
  });

  it('renders unranked trial players as 0 stars, not undefined', () => {
    const player = mapPlayerFromApi({ id: 'p5', is_trial: true, trial_rating: null });
    expect(player.trialRating).toBe(0);
    expect(player.homeClub).toBe('');
    expect(player.trialNotes).toBe('');
  });
});

describe('mapPlayerToApi', () => {
  const player: Player = {
    id: 'p1',
    firstName: 'Lena',
    lastName: 'Bauer',
    dateOfBirth: '2010-04-02',
    position: 'Midfielder',
    jerseyNumber: 8,
    status: 'Active',
    playerPhone: '0170',
    height: 152,
    weight: 41.5,
    clothingSize: 'M',
    strongFoot: 'Left',
    motherName: 'Anna',
    motherPhone: '0171',
    fatherName: 'Tom',
    fatherPhone: '0172',
    imageUrl: '/x.png',
    attendance: 92,
    performance: 4,
    isTrial: true,
    homeClub: 'FC Nord',
    trialRating: 3,
    trialNotes: 'notes',
  };

  it('emits the snake_case payload the backend expects', () => {
    expect(mapPlayerToApi(player)).toEqual({
      first_name: 'Lena',
      last_name: 'Bauer',
      date_of_birth: '2010-04-02',
      position: 'Midfielder',
      jersey_number: 8,
      status: 'Active',
      player_phone: '0170',
      height: 152,
      weight: 41.5,
      clothing_size: 'M',
      strong_foot: 'Left',
      mother_name: 'Anna',
      mother_phone: '0171',
      father_name: 'Tom',
      father_phone: '0172',
      image_url: '/x.png',
      attendance: 92,
      is_trial: true,
      home_club: 'FC Nord',
      trial_rating: 3,
      trial_notes: 'notes',
    });
  });

  it('does not send id or performance — the backend owns both', () => {
    const payload = mapPlayerToApi(player) as Record<string, unknown>;
    // `update_player` used to run a generic setattr loop; an `id` in the body
    // nulled the primary key. The mapper must never put it there.
    expect(payload).not.toHaveProperty('id');
    // Performance is per-team and goes through /players/{id}/performance.
    expect(payload).not.toHaveProperty('performance');
  });

  it('round-trips through the API mapper without losing a field', () => {
    const roundTripped = mapPlayerFromApi({ ...mapPlayerToApi(player), id: player.id });
    expect(roundTripped).toEqual({ ...player, performance: 0, teams: [] });
  });
});

describe('mapSessionFromApi / mapSessionToApi', () => {
  it('maps series metadata and defaults intensity to Medium', () => {
    const session = mapSessionFromApi({ id: 's1', series_id: 'ser1', is_modified: 1 });
    expect(session.intensity).toBe('Medium');
    expect(session.seriesId).toBe('ser1');
    expect(session.isModified).toBe(true);
  });

  it('uses null — not undefined — for a one-off session with no series', () => {
    expect(mapSessionFromApi({ id: 's2' }).seriesId).toBeNull();
    expect(mapSessionFromApi({ id: 's2' }).isModified).toBe(false);
  });

  it('omits series fields on the way out, since scope is a query param', () => {
    const session: TrainingSession = {
      id: 's1',
      date: '2026-01-05',
      startTime: '18:00',
      endTime: '19:30',
      focus: 'Passing',
      intensity: 'High',
      selectedPlayers: 'p1,p2',
      selectedExercises: 'e1',
      seriesId: 'ser1',
      isModified: true,
    };
    expect(mapSessionToApi(session)).toEqual({
      date: '2026-01-05',
      start_time: '18:00',
      end_time: '19:30',
      focus: 'Passing',
      intensity: 'High',
      selected_players: 'p1,p2',
      selected_exercises: 'e1',
    });
  });
});

describe('library mappers', () => {
  it('treats a missing is_custom as custom, but honours an explicit false', () => {
    expect(mapBasicFromApi({ id: 'b1' }).isCustom).toBe(true);
    expect(mapBasicFromApi({ id: 'b1', is_custom: false }).isCustom).toBe(false);
    expect(mapPrincipleFromApi({ id: 'pr1' }).isCustom).toBe(true);
    expect(mapPrincipleFromApi({ id: 'pr1', is_custom: false }).isCustom).toBe(false);
    expect(mapTacticFromApi({ id: 't1' }).isCustom).toBe(true);
    expect(mapTacticFromApi({ id: 't1', is_custom: false }).isCustom).toBe(false);
  });

  it('maps principle coaching fields', () => {
    const principle = mapPrincipleFromApi({
      id: 'pr1',
      name: 'Press high',
      game_phase: 'Out of possession',
      coaching_notes: 'Trigger on back pass',
      implementation_tips: 'Start 5v5',
      media_url: '/m.mp4',
    });
    expect(principle.gamePhase).toBe('Out of possession');
    expect(principle.coachingNotes).toBe('Trigger on back pass');
    expect(principle.implementationTips).toBe('Start 5v5');
    expect(principle.mediaUrl).toBe('/m.mp4');
  });
});

describe('mapTacticToApi', () => {
  const tactic: Tactic = {
    id: '',
    name: 'Gegenpress',
    formation: '4-3-3',
    description: 'Win it back in 6s',
    suggestedDrills: 'Rondo',
    isCustom: true,
  };

  it('forwards a client-minted id so optimistic inserts keep their key', () => {
    expect(mapTacticToApi({ ...tactic, id: 'client-uuid' })).toMatchObject({ id: 'client-uuid' });
  });

  it('omits id entirely when the client has not minted one', () => {
    expect(mapTacticToApi(tactic)).not.toHaveProperty('id');
  });
});

describe('exercise mappers', () => {
  it('splits comma-separated multi-value columns into arrays', () => {
    const exercise = mapExerciseFromApi({
      id: 'e1',
      equipment: 'cones,balls,bibs',
      linked_basics: 'b1,b2',
      linked_principles: 'pr1',
      linked_tactics: 't1,t2',
    });
    expect(exercise.equipment).toEqual(['cones', 'balls', 'bibs']);
    expect(exercise.linkedBasics).toEqual(['b1', 'b2']);
    expect(exercise.linkedPrinciples).toEqual(['pr1']);
    expect(exercise.linkedTactics).toEqual(['t1', 't2']);
  });

  it('produces empty arrays — never [""] — for empty multi-value columns', () => {
    const exercise = mapExerciseFromApi({ id: 'e1', equipment: '', linked_basics: null });
    expect(exercise.equipment).toEqual([]);
    expect(exercise.linkedBasics).toEqual([]);
  });

  it('trims items and drops blanks in multi-value columns', () => {
    const exercise = mapExerciseFromApi({ id: 'e1', equipment: 'a, b,', linked_tactics: ' 4-4-2 ,,' });
    expect(exercise.equipment).toEqual(['a', 'b']);
    expect(exercise.linkedTactics).toEqual(['4-4-2']);
  });

  it('joins arrays back into comma-separated strings', () => {
    const exercise: Exercise = {
      id: 'e1',
      name: 'Rondo',
      category: 'technique',
      intensity: 'High',
      description: '5v2',
      setup: '10x10',
      variations: 'one touch',
      coachingPoints: 'body shape',
      goalkeepers: 0,
      equipment: ['cones', 'balls'],
      linkedBasics: ['b1'],
      linkedPrinciples: [],
      linkedTactics: ['t1', 't2'],
      mediaUrl: '',
      isCustom: true,
    };
    const payload = mapExerciseToApi(exercise);
    expect(payload.equipment).toBe('cones,balls');
    expect(payload.linked_basics).toBe('b1');
    expect(payload.linked_principles).toBe('');
    expect(payload.linked_tactics).toBe('t1,t2');
    expect(payload.coaching_points).toBe('body shape');
    expect(payload.drawing).toBeNull();
  });

  it('round-trips the drawing JSON untouched', () => {
    const json = '{"version":1,"background":"blank","elements":[{"id":"a","kind":"cone","x":10,"y":10,"color":"blue"}]}';
    const exercise = mapExerciseFromApi({ id: 'e1', drawing: json });
    expect(exercise.drawing).toBe(json);
    expect(mapExerciseToApi(exercise).drawing).toBe(json);
    expect(mapExerciseFromApi({ id: 'e2', drawing: null }).drawing).toBe('');
  });
});

describe('match mappers', () => {
  it('defaults a match with no stored formation to 4-4-2', () => {
    expect(mapMatchFromApi({ id: 'm1' }).formation).toBe('4-4-2');
  });

  it('keeps an unrecorded score undefined instead of coercing it to 0', () => {
    // Coercing to 0 made every unplayed fixture look like a 0-0 draw in the
    // season statistics.
    const details = mapMatchDetailsFromApi({ id: 'm1', goals_for: null, goals_against: null });
    expect(details.goalsFor).toBeUndefined();
    expect(details.goalsAgainst).toBeUndefined();
  });

  it('preserves a genuine 0-0 result', () => {
    const details = mapMatchDetailsFromApi({ id: 'm1', goals_for: 0, goals_against: 0 });
    expect(details.goalsFor).toBe(0);
    expect(details.goalsAgainst).toBe(0);
  });

  it('sends scores back unchanged, including undefined', () => {
    const details: MatchDetails = {
      id: 'm1',
      opponent: 'SV Süd',
      date: '2026-03-01',
      time: '11:00',
      location: 'Home',
      formation: '4-3-3',
      lineup: '{"slots":[]}',
      goalsFor: undefined,
      goalsAgainst: undefined,
      notes: '',
    };
    const payload = mapMatchDetailsToApi(details);
    expect(payload.goals_for).toBeUndefined();
    expect(payload.goals_against).toBeUndefined();
    expect(payload.lineup).toBe('{"slots":[]}');
  });

  it('maps a match event', () => {
    expect(mapMatchEventFromApi({ id: 'ev1', match_id: 'm1', player_id: 'p1', event_type: 'Goal', minute: 34 }))
      .toEqual({ id: 'ev1', matchId: 'm1', playerId: 'p1', eventType: 'Goal', minute: 34 });
  });
});

describe('calendar event mappers', () => {
  it('round-trips a calendar event', () => {
    const event: CalendarEvent = {
      id: 'ev1',
      title: 'Team meeting',
      description: 'Season kickoff',
      location: 'Clubhouse',
      date: '2026-01-05',
      startTime: '18:00',
      endTime: '19:00',
    };
    expect(mapEventFromApi({ ...mapEventToApi(event), id: 'ev1' })).toEqual(event);
  });
});

describe('mapSelectorItemFromApi', () => {
  it('defaults a missing name to an empty string', () => {
    expect(mapSelectorItemFromApi({ id: 'x' })).toEqual({ id: 'x', name: '' });
  });
});

describe('admin mappers', () => {
  it('maps an admin feedback row including the author identity', () => {
    expect(mapAdminFeedbackFromApi({
      id: 'fb1',
      type: 'bug',
      title: 'Broken chart',
      description: 'Bars overflow',
      screenshot_urls: ['/static/uploads/a.png'],
      status: 'in_progress',
      created_at: '2026-08-01T10:00:00',
      coach_email: 'coach@club.de',
      coach_name: 'Coach A',
    })).toEqual({
      id: 'fb1',
      type: 'bug',
      title: 'Broken chart',
      description: 'Bars overflow',
      screenshotUrls: ['/static/uploads/a.png'],
      status: 'in_progress',
      createdAt: '2026-08-01T10:00:00',
      coachEmail: 'coach@club.de',
      coachName: 'Coach A',
    });
  });

  it('defaults missing admin feedback fields', () => {
    const mapped = mapAdminFeedbackFromApi({ id: 'fb2' });
    expect(mapped.screenshotUrls).toEqual([]);
    expect(mapped.status).toBe('new');
    expect(mapped.coachName).toBe('');
  });

  it('maps an admin user row with counts and role fallback', () => {
    expect(mapAdminUserFromApi({
      id: 'u1',
      email: 'coach@club.de',
      full_name: 'Coach A',
      is_verified: true,
      created_at: '2026-07-01',
      team_count: 2,
      feedback_count: 5,
    })).toEqual({
      id: 'u1',
      email: 'coach@club.de',
      fullName: 'Coach A',
      role: 'coach',
      isVerified: true,
      createdAt: '2026-07-01',
      teamCount: 2,
      feedbackCount: 5,
    });
  });

  it('maps admin stats and defaults missing counts to zero', () => {
    const mapped = mapAdminStatsFromApi({ users: 3, training_sessions: 7, feedback_new: 1 });
    expect(mapped.users).toBe(3);
    expect(mapped.trainingSessions).toBe(7);
    expect(mapped.feedbackNew).toBe(1);
    expect(mapped.teams).toBe(0);
    expect(mapped.feedbackResolved).toBe(0);
  });
});

describe('google calendar mappers', () => {
  it('maps a connected account', () => {
    const mapped = mapGoogleStatusFromApi({
      configured: true,
      connected: true,
      google_email: 'coach@gmail.com',
      calendar_id: 'abc@group.calendar.google.com',
      time_zone: 'Europe/Berlin',
      push_enabled: true,
      last_synced_at: '2026-09-09T10:00:00',
      last_error: null,
    });
    expect(mapped).toEqual({
      configured: true,
      connected: true,
      googleEmail: 'coach@gmail.com',
      calendarId: 'abc@group.calendar.google.com',
      timeZone: 'Europe/Berlin',
      pushEnabled: true,
      lastSyncedAt: '2026-09-09T10:00:00',
      lastError: '',
    });
  });

  it('never leaves a field undefined when the server sends nothing', () => {
    const mapped = mapGoogleStatusFromApi({ configured: false, connected: false });
    expect(mapped.googleEmail).toBe('');
    expect(mapped.lastSyncedAt).toBe('');
    expect(mapped.pushEnabled).toBe(false);
  });

  it('defaults sync counts to zero', () => {
    expect(mapGoogleSyncResultFromApi({ pushed: 4 })).toEqual({ pulled: 0, pushed: 4, removed: 0 });
  });
});
