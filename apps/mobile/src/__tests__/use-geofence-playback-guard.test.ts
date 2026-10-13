import { renderHook, act } from '@testing-library/react-native';

import { useGeofencePlaybackGuard } from '@/hooks/use-geofence-playback-guard';

let mockBypass = false;
jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (
    selector: (s: { config: { geofence: { bypassGeofence: boolean } } }) => unknown,
  ) =>
    selector({
      config: {
        geofence: {
          bypassGeofence: mockBypass,
        },
      },
    }),
}));

const mockConfirm = jest.fn();
jest.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
    component: null,
  }),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('useGeofencePlaybackGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBypass = false;
  });

  it('allows immediate action when user is near start', async () => {
    const { result } = await renderHook(() =>
      useGeofencePlaybackGuard({ isNearStart: true, isBypassable: false }),
    );

    expect(result.current.isPlaybackBlocked).toBe(false);

    const action = jest.fn();
    await act(async () => {
      await result.current.guardAction(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.showGeofenceBlockedAlert).toBe(false);
  });

  it('blocks playback and shows alert when not near start and not bypassable', async () => {
    const { result } = await renderHook(() =>
      useGeofencePlaybackGuard({ isNearStart: false, isBypassable: false }),
    );

    expect(result.current.isPlaybackBlocked).toBe(true);

    const action = jest.fn();
    await act(async () => {
      await result.current.guardAction(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.showGeofenceBlockedAlert).toBe(true);

    await act(async () => {
      result.current.setShowGeofenceBlockedAlert(false);
    });
    expect(result.current.showGeofenceBlockedAlert).toBe(false);
  });

  it('prompts confirmation when bypassable and executes action on confirm', async () => {
    mockConfirm.mockResolvedValueOnce(true);

    const { result } = await renderHook(() =>
      useGeofencePlaybackGuard({ isNearStart: false, isBypassable: true }),
    );

    expect(result.current.isPlaybackBlocked).toBe(false);

    const action = jest.fn();
    await act(async () => {
      await result.current.guardAction(action);
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('prompts confirmation when bypassable and does not execute action on cancel', async () => {
    mockConfirm.mockResolvedValueOnce(false);

    const { result } = await renderHook(() =>
      useGeofencePlaybackGuard({ isNearStart: false, isBypassable: true }),
    );

    const action = jest.fn();
    await act(async () => {
      await result.current.guardAction(action);
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it('allows action when remote bypass is enabled even if far away', async () => {
    mockBypass = true;

    const { result } = await renderHook(() =>
      useGeofencePlaybackGuard({ isNearStart: false, isBypassable: false }),
    );

    expect(result.current.isPlaybackBlocked).toBe(false);

    const action = jest.fn();
    await act(async () => {
      await result.current.guardAction(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.showGeofenceBlockedAlert).toBe(false);
  });
});
