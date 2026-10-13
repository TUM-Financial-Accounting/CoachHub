export const STORAGE_KEYS = {
  isAuthenticated: 'isAuthenticated',
  user: 'user',
  accessToken: 'access_token',
  activeSeasonId: 'activeSeasonId',
  activeTeamId: 'activeTeamId',
  // Bump the version when the cached shape changes, or old data is parsed as the new shape.
  seasonsCache: 'cache:seasons:v1',
  teamsCache: 'cache:teams:v2',
  sidebarCollapsed: 'sidebar-collapsed',
  navCollapsedGroups: 'nav-collapsed-groups',
  theme: 'theme',
} as const;

// Everything that belongs to the signed-in account; left behind, it leaks to the next login.
export const SESSION_KEYS = [
  STORAGE_KEYS.isAuthenticated,
  STORAGE_KEYS.user,
  STORAGE_KEYS.accessToken,
  STORAGE_KEYS.activeSeasonId,
  STORAGE_KEYS.activeTeamId,
  STORAGE_KEYS.seasonsCache,
  STORAGE_KEYS.teamsCache,
  'cache:teams:v1', // pre-seasonId team cache; still in browsers that last ran an older build
] as const;
