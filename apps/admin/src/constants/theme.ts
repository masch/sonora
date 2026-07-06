export const RuntimeColors = {
  light: {
    text: '#2b2826',
    background: '#f4ede2',
    backgroundElement: '#ebe4d8',
    backgroundSelected: '#dfd7c8',
    textSecondary: '#76706b',
    border: 'rgba(43, 40, 38, 0.15)',
    link: '#8a6e53',
    // Tab Bar design colors from user palette
    tabBarBg: 'rgba(255, 235, 240, 0.85)',
    tabBarSelectedBg: 'rgba(244, 192, 196, 0.9)',
    tabBarIconActive: '#240001',
    tabBarIconInactive: '#4c263a',
  },
  dark: {
    text: '#f4ede2',
    background: '#1a1817',
    backgroundElement: '#2b2826',
    backgroundSelected: '#3d3936',
    textSecondary: '#a59e99',
    border: 'rgba(244, 237, 226, 0.15)',
    link: '#c6b29c',
    // Tab Bar design colors (dark version)
    tabBarBg: 'rgba(36, 15, 22, 0.85)',
    tabBarSelectedBg: 'rgba(74, 40, 52, 0.9)',
    tabBarIconActive: '#FFEBF0',
    tabBarIconInactive: '#8F6576',
  },
} as const;
