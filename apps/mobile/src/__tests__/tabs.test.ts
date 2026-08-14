import { ENTITY_NAMES } from '@/constants/entities';
import { TABS } from '@/constants/tabs';

describe('Tab definitions', () => {
  it('has exactly 6 entries', () => {
    expect(TABS).toHaveLength(6);
  });

  it('has correct first entry (index)', () => {
    const tab = TABS[0];
    expect(tab.name).toBe('index');
    expect(tab.symbolViewName.ios).toBe('house');
    expect(tab.symbolViewName.android).toBe('home');
    expect(tab.symbolViewName.web).toBe('home');
  });

  it('has correct second entry (derivas)', () => {
    const tab = TABS[1];
    expect(tab.name).toBe(ENTITY_NAMES.DERIVAS);
    expect(tab.symbolViewName.ios).toBe('map');
    expect(tab.symbolViewName.android).toBe('map');
    expect(tab.symbolViewName.web).toBe('map');
  });

  it('has correct third entry (poetics)', () => {
    const tab = TABS[2];
    expect(tab.name).toBe(ENTITY_NAMES.POETICS);
    expect(tab.symbolViewName.ios).toBe('music.note.list');
    expect(tab.symbolViewName.android).toBe('library_music');
    expect(tab.symbolViewName.web).toBe('library_music');
  });

  it('has correct fourth entry (explore)', () => {
    const tab = TABS[3];
    expect(tab.name).toBe('explore');
    expect(tab.symbolViewName.ios).toBe('compass.drawing');
    expect(tab.symbolViewName.android).toBe('explore');
    expect(tab.symbolViewName.web).toBe('explore');
  });

  it('has correct fifth entry (settings)', () => {
    const tab = TABS[4];
    expect(tab.name).toBe('settings');
    expect(tab.symbolViewName.ios).toBe('gear');
    expect(tab.symbolViewName.android).toBe('settings');
    expect(tab.symbolViewName.web).toBe('settings');
  });

  it('all tab names are unique', () => {
    const names = TABS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('shows explore tab when isProduction is false', () => {
    let tabsModule: typeof import('@/constants/tabs');
    jest.isolateModules(() => {
      jest.mock('@/config/app-config', () => ({
        APP_CONFIG: { isProduction: false },
      }));
      tabsModule = jest.requireActual<typeof import('@/constants/tabs')>('@/constants/tabs');
    });
    const exploreTab = tabsModule!.TABS.find((t: { name: string }) => t.name === 'explore');
    expect(exploreTab?.hidden).toBe(false);
  });

  it('hides explore tab when isProduction is true', () => {
    let tabsModule: typeof import('@/constants/tabs');
    jest.isolateModules(() => {
      jest.mock('@/config/app-config', () => ({
        APP_CONFIG: { isProduction: true },
      }));
      tabsModule = jest.requireActual<typeof import('@/constants/tabs')>('@/constants/tabs');
    });
    const exploreTab = tabsModule!.TABS.find((t: { name: string }) => t.name === 'explore');
    expect(exploreTab?.hidden).toBe(true);
  });
});
