from datetime import date

import recurrence

MON, TUE, WED = 0, 1, 2


def test_weekly_includes_start_and_end():
    dates = recurrence.expand(date(2026, 9, 7), date(2026, 9, 21), "weekly", [MON])
    assert dates == [date(2026, 9, 7), date(2026, 9, 14), date(2026, 9, 21)]


def test_weekly_with_several_weekdays_starts_mid_week():
    dates = recurrence.expand(date(2026, 9, 9), date(2026, 9, 16), "weekly", [MON, WED])
    assert dates == [date(2026, 9, 9), date(2026, 9, 14), date(2026, 9, 16)]


def test_biweekly_counts_weeks_from_the_start_week_monday():
    dates = recurrence.expand(date(2026, 9, 9), date(2026, 10, 7), "biweekly", [MON, WED])
    # Week of 7 Sep is week 0: its Monday is before the start, so only Wednesday counts.
    assert dates == [date(2026, 9, 9), date(2026, 9, 21), date(2026, 9, 23), date(2026, 10, 5), date(2026, 10, 7)]


def test_monthly_keeps_the_week_of_the_month():
    # 8 Sep 2026 is the 2nd Tuesday.
    dates = recurrence.expand(date(2026, 9, 8), date(2026, 12, 31), "monthly", [TUE])
    assert dates == [date(2026, 9, 8), date(2026, 10, 13), date(2026, 11, 10), date(2026, 12, 8)]


def test_monthly_skips_months_without_a_fifth_weekday():
    # 29 Sep 2026 is the 5th Tuesday; October has none, December does.
    dates = recurrence.expand(date(2026, 9, 29), date(2026, 12, 31), "monthly", [TUE])
    assert dates == [date(2026, 9, 29), date(2026, 12, 29)]


def test_caps_at_max_occurrences():
    dates = recurrence.expand(date(2026, 1, 1), date(2035, 1, 1), "weekly", [0, 1, 2, 3, 4, 5, 6])
    assert len(dates) == recurrence.MAX_OCCURRENCES
