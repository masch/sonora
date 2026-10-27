import { Platform } from 'react-native';

import { canKeepMapArchive } from '../map-archive-support';

const platform = Platform as unknown as { OS: string };
const original = platform.OS;

describe('canKeepMapArchive', () => {
  afterEach(() => {
    platform.OS = original;
  });

  it('keeps an archive on the device platforms', () => {
    platform.OS = 'ios';
    expect(canKeepMapArchive()).toBe(true);

    platform.OS = 'android';
    expect(canKeepMapArchive()).toBe(true);
  });

  it('refuses on the web, where there is no device file system', () => {
    // `expo-file-system` answers as an unsupported stub in a browser, and calling
    // into it throws from inside a render: this is the question that keeps the
    // archive path from ever being entered there.
    platform.OS = 'web';
    expect(canKeepMapArchive()).toBe(false);
  });
});
