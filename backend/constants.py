# TeamPlayer.season_id for assignments made without a season.
DEFAULT_SEASON_ID = "default-season"

# Same value as DEFAULT_FORMATION in src/lib/formations.ts.
DEFAULT_FORMATION = "4-4-2"

ROLE_COACH = "coach"

# Same values as MATCH_EVENT in src/lib/domain.ts.
EVENT_GOAL = "Goal"
EVENT_ASSIST = "Assist"

# Same values as FeedbackType / FeedbackStatus in src/types/models.ts.
FEEDBACK_TYPES = ("bug", "feature", "question")
FEEDBACK_STATUSES = ("new", "in_progress", "resolved")
FEEDBACK_STATUS_NEW = "new"

# MAX_SERIES_OCCURRENCES mirrors MAX_OCCURRENCES in src/lib/recurrence.ts.
SERIES_FREQUENCIES = ("weekly", "biweekly", "monthly")
MAX_SERIES_OCCURRENCES = 200

# Same values as AttendanceStatus / AbsenceReason in src/types/models.ts.
ATTENDANCE_STATUSES = ("present", "absent")
ABSENCE_REASONS = ("injury", "illness", "school", "excused", "unexcused")

DEFAULT_MATCH_MINUTES = 90
