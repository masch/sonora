// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PlayCoreUpdateProvider } from '../play-core-provider.ts';

describe('PlayCoreUpdateProvider (Web stub)', () => {
  it('instantiates and has name play-core', () => {
    const provider = new PlayCoreUpdateProvider();
    expect(provider.name).toBe('play-core');
  });

  it('isAvailable returns false on web', async () => {
    const provider = new PlayCoreUpdateProvider();
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('checkForUpdate returns false on web', async () => {
    const provider = new PlayCoreUpdateProvider();
    await expect(provider.checkForUpdate({ source: 'startup' })).resolves.toBe(false);
  });

  it('triggerUpdate resolves as no-op on web', async () => {
    const provider = new PlayCoreUpdateProvider();
    await expect(provider.triggerUpdate({ mode: 'flexible' })).resolves.toBeUndefined();
  });
});
