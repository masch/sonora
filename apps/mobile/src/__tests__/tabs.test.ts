import { TABS } from '@/constants/tabs';

describe('Tab definitions', () => {
  it('has exactly 4 entries', () => {
    expect(TABS).toHaveLength(4);
  });

  it('has correct first entry (index)', () => {
    const tab = TABS[0];
    expect(tab.name).toBe('index');
    expect(tab.ioniconsName).toBe('home-outline');
    expect(tab.symbolViewName.ios).toBe('house');
    expect(tab.symbolViewName.android).toBe('home');
    expect(tab.symbolViewName.web).toBe('home');
  });

  it('has correct second entry (tracks)', () => {
    const tab = TABS[1];
    expect(tab.name).toBe('tracks');
    expect(tab.ioniconsName).toBe('musical-notes-outline');
    expect(tab.symbolViewName.ios).toBe('music.note.list');
    expect(tab.symbolViewName.android).toBe('library_music');
    expect(tab.symbolViewName.web).toBe('library_music');
  });

  it('has correct third entry (explore)', () => {
    const tab = TABS[2];
    expect(tab.name).toBe('explore');
    expect(tab.ioniconsName).toBe('compass-outline');
    expect(tab.symbolViewName.ios).toBe('compass.drawing');
    expect(tab.symbolViewName.android).toBe('explore');
    expect(tab.symbolViewName.web).toBe('explore');
  });

  it('has correct fourth entry (settings)', () => {
    const tab = TABS[3];
    expect(tab.name).toBe('settings');
    expect(tab.ioniconsName).toBe('settings-outline');
    expect(tab.symbolViewName.ios).toBe('gear');
    expect(tab.symbolViewName.android).toBe('settings');
    expect(tab.symbolViewName.web).toBe('settings');
  });

  it('all tab names are unique', () => {
    const names = TABS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
