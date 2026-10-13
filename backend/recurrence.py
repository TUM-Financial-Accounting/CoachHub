from datetime import date, timedelta

import constants

FREQUENCIES = constants.SERIES_FREQUENCIES
MAX_OCCURRENCES = constants.MAX_SERIES_OCCURRENCES


def expand(start: date, end: date, frequency: str, weekdays: list) -> list:
    """Dates between start and end (inclusive) matching the pattern.

    weekdays use Python's convention (0 = Monday). "biweekly" counts weeks
    from the Monday of the start week. "monthly" keeps the start date's week
    of the month (2nd Tuesday -> 2nd <weekday> of every month); months where
    that week doesn't exist for a weekday are skipped.
    """
    days = sorted(set(weekdays))
    out = []
    if frequency == "monthly":
        nth = (start.day - 1) // 7
        year, month = start.year, start.month
        while date(year, month, 1) <= end:
            first = date(year, month, 1)
            for wd in days:
                d = first + timedelta(days=(wd - first.weekday()) % 7 + 7 * nth)
                if d.month == month and start <= d <= end:
                    out.append(d)
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        return sorted(out)[:MAX_OCCURRENCES]

    step = 2 if frequency == "biweekly" else 1
    week0 = start - timedelta(days=start.weekday())
    d = start
    while d <= end and len(out) < MAX_OCCURRENCES:
        if d.weekday() in days and ((d - week0).days // 7) % step == 0:
            out.append(d)
        d += timedelta(days=1)
    return out
