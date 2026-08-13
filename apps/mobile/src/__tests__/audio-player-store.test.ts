import { useAudioPlayerStore } from '@/store/audio-player-store';

function createMockPlayer() {
  return {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    replace: jest.fn(),
    remove: jest.fn(),
    setActiveForLockScreen: jest.fn(),
  };
}

describe('AudioPlayerStore', () => {
  beforeEach(() => {
    useAudioPlayerStore.setState({
      status: 'idle',
      positionMs: 0,
      durationMs: 0,
      errorMsg: null,
      currentUri: null,
      pendingPlayRequest: null,
      _player: null,
    });
  });

  it('has correct initial state', () => {
    const state = useAudioPlayerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(0);
    expect(state.errorMsg).toBeNull();
    expect(state.currentUri).toBeNull();
    expect(state.pendingPlayRequest).toBeNull();
  });

  it('play() when idle starts playback', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');

    const state = useAudioPlayerStore.getState();
    expect(state.currentUri).toBe('uri-1');
    expect(state.status).toBe('playing');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('play() with same uri resumes when paused', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    useAudioPlayerStore.getState().pause();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(useAudioPlayerStore.getState().status).toBe('paused');

    useAudioPlayerStore.getState().play('uri-1');
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    expect(useAudioPlayerStore.getState().status).toBe('playing');
  });

  it('play() with different uri sets pendingPlayRequest when playing', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');

    useAudioPlayerStore.getState().play('uri-2');

    const state = useAudioPlayerStore.getState();
    expect(state.pendingPlayRequest).toEqual({ uri: 'uri-2', resume: undefined });
    expect(state.currentUri).toBe('uri-1');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('confirmInterrupt() stops current, plays new, clears pending', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    useAudioPlayerStore.getState().play('uri-2');
    expect(useAudioPlayerStore.getState().pendingPlayRequest).toBeTruthy();

    useAudioPlayerStore.getState().confirmInterrupt();

    const state = useAudioPlayerStore.getState();
    expect(state.pendingPlayRequest).toBeNull();
    expect(state.currentUri).toBe('uri-2');
    expect(state.status).toBe('playing');
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('cancelInterrupt() clears pending request without changing playback', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    useAudioPlayerStore.getState().play('uri-2');
    expect(useAudioPlayerStore.getState().pendingPlayRequest).toBeTruthy();

    useAudioPlayerStore.getState().cancelInterrupt();

    const state = useAudioPlayerStore.getState();
    expect(state.pendingPlayRequest).toBeNull();
    expect(state.currentUri).toBe('uri-1');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('rapid play requests replace the pending slot', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    useAudioPlayerStore.getState().play('uri-2');
    useAudioPlayerStore.getState().play('uri-3');

    expect(useAudioPlayerStore.getState().pendingPlayRequest).toEqual({
      uri: 'uri-3',
      resume: undefined,
    });
  });

  it('pause() sets status to paused', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    useAudioPlayerStore.getState().pause();

    expect(useAudioPlayerStore.getState().status).toBe('paused');
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('stop() pauses and resets position', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().play('uri-1');
    useAudioPlayerStore.getState()._syncStatus({ positionMs: 45000 });
    useAudioPlayerStore.getState().stop();

    const state = useAudioPlayerStore.getState();
    expect(state.status).toBe('stopped');
    expect(state.positionMs).toBe(0);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('seekTo() sets position in milliseconds', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().seekTo(30000);

    expect(useAudioPlayerStore.getState().positionMs).toBe(30000);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(30);
  });

  it('_syncStatus updates store from player status', () => {
    useAudioPlayerStore.getState()._syncStatus({
      status: 'playing',
      positionMs: 15000,
      durationMs: 120000,
    });

    const state = useAudioPlayerStore.getState();
    expect(state.status).toBe('playing');
    expect(state.positionMs).toBe(15000);
    expect(state.durationMs).toBe(120000);
  });

  it('_syncStatus with error sets errorMsg', () => {
    useAudioPlayerStore.getState()._syncStatus({
      status: 'error',
      errorMsg: 'Playback failed',
    });

    const state = useAudioPlayerStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMsg).toBe('Playback failed');
  });

  // TODO [CLEANUP]: Remove debug test cases after verifying lockscreen session fix
  it('triggerUnsafeLockscreenCrash calls setActiveForLockScreen and creates conflicting second player', () => {
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().triggerUnsafeLockscreenCrash();

    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
  });

  it('triggerSafeLockscreenUpdate debounces/guards rapid lockscreen updates', () => {
    jest.useFakeTimers();
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    useAudioPlayerStore.getState().triggerSafeLockscreenUpdate({ title: 'Test 1' });
    useAudioPlayerStore.getState().triggerSafeLockscreenUpdate({ title: 'Test 2' });

    // Pending timer hasn't fired yet
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(150);

    // Only 1 debounced call with latest metadata executed
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      { title: 'Test 2' },
      expect.any(Object),
    );

    jest.useRealTimers();
  });

  it('prevents redundant lockscreen updates when metadata is identical and active', () => {
    jest.useFakeTimers();
    const mockPlayer = createMockPlayer();
    useAudioPlayerStore.getState()._setPlayer(mockPlayer as never);

    // Initial activation call
    useAudioPlayerStore.getState().triggerSafeLockscreenUpdate({ title: 'Same Track' });
    jest.advanceTimersByTime(150);
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);

    // Second call with identical metadata after active
    useAudioPlayerStore.getState().triggerSafeLockscreenUpdate({ title: 'Same Track' });
    jest.advanceTimersByTime(150);

    // Should NOT call setActiveForLockScreen again
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
