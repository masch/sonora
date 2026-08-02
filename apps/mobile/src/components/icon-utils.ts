// Shared icon data and types. Kept in a non-component module so the Icon
// component file only exports components (Fast Refresh friendly).

// Unified project icon definitions mapping name key to platform icons
export const ICON_MAP = {
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  download: { ios: 'arrow.down.circle.fill', android: 'downloading', web: 'downloading' },
  reset: { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' },
  rewind: { ios: 'gobackward.10', android: 'replay_10', web: 'replay_10' },
  map: { ios: 'map', android: 'map', web: 'map' },
  music: { ios: 'music.note.list', android: 'library_music', web: 'library_music' },
  chat: { ios: 'bubble.left', android: 'forum', web: 'forum' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
} as const;

export type GenericIconName = keyof typeof ICON_MAP;
