import { renderHook, act } from '@testing-library/react-native';
import { useAudioRewind } from '@/hooks/use-audio-rewind';

const mockRewind = jest.fn();

jest.mock('@/store/audio-player-store', () => ({
  useAudioPlayerStore: (selector: (state: { rewind: typeof mockRewind }) => unknown) =>
    selector({
      rewind: mockRewind,
    }),
}));

jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (
    selector: (state: { config: { audio: { rewindOffsetMs: number } } }) => unknown,
  ) =>
    selector({
      config: {
        audio: {
          rewindOffsetMs: 15000,
        },
      },
    }),
}));

describe('useAudioRewind custom hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers store rewind action with the configured offset', async () => {
    const { result } = await renderHook(() => useAudioRewind());

    act(() => {
      result.current();
    });

    expect(mockRewind).toHaveBeenCalledWith(15000);
  });
});
