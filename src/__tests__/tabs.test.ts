import { TABS } from '@/constants/tabs';

describe('Tab definitions', () => {
  it('has exactly 3 entries', () => {
    expect(TABS).toHaveLength(3);
  });

  it('has correct first entry (index/Home)', () => {
    const tab = TABS[0];
    expect(tab.name).toBe('index');
    expect(tab.label).toBe('Home');
    expect(tab.ioniconsName).toBe('home-outline');
    expect(tab.symbolViewName.ios).toBe('house');
    expect(tab.symbolViewName.android).toBe('home');
    expect(tab.symbolViewName.web).toBe('home');
  });

  it('has correct second entry (explore/Explore)', () => {
    const tab = TABS[1];
    expect(tab.name).toBe('explore');
    expect(tab.label).toBe('Explore');
    expect(tab.ioniconsName).toBe('compass-outline');
    expect(tab.symbolViewName.ios).toBe('compass.drawing');
    expect(tab.symbolViewName.android).toBe('explore');
    expect(tab.symbolViewName.web).toBe('explore');
  });

  it('has correct third entry (settings/Settings)', () => {
    const tab = TABS[2];
    expect(tab.name).toBe('settings');
    expect(tab.label).toBe('Settings');
    expect(tab.ioniconsName).toBe('settings-outline');
    expect(tab.symbolViewName.ios).toBe('gear');
    expect(tab.symbolViewName.android).toBe('settings');
    expect(tab.symbolViewName.web).toBe('settings');
  });
});
