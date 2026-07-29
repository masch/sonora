import { act, renderHook } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth-context';

jest.mock('@/services/admin-api-client', () => ({
  AdminApiClient: {
    checkSession: jest.fn(),
    loginSession: jest.fn(),
    logoutSession: jest.fn(),
  },
}));

import { AdminApiClient } from '@/services/admin-api-client';

const mockCheckSession = AdminApiClient.checkSession as unknown as jest.Mock;
const mockLoginSession = AdminApiClient.loginSession as unknown as jest.Mock;
const mockLogoutSession = AdminApiClient.logoutSession as unknown as jest.Mock;

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws error if useAuth is used outside AuthProvider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      'useAuth must be used within an AuthProvider',
    );
    consoleError.mockRestore();
  });

  it('checks session on mount, unmounts cleanly, and sets isAuthenticated true when session is valid', async () => {
    mockCheckSession.mockResolvedValueOnce(true);

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      unmount();
    });
  });

  it('sets isAuthenticated false when session is invalid', async () => {
    mockCheckSession.mockResolvedValueOnce(false);

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('handles login, logout and checkSession functions', async () => {
    mockCheckSession.mockResolvedValue(false);
    mockLoginSession.mockResolvedValue(true);
    mockLogoutSession.mockResolvedValue(true);

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    await act(async () => {
      const success = await result.current.login('secret');
      expect(success).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});
