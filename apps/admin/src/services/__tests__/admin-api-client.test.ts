import { AdminApiClient } from '../admin-api-client';

function mockFetchOk(data: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
  });
}

function mockFetchFail(status: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: jest.fn().mockResolvedValue('Request failed'),
  });
}

describe('AdminApiClient', () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
    };
  })();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  /* ─── Authentication Keys Management ─── */

  it('manages auth key correctly in localStorage', () => {
    expect(AdminApiClient.getAuthKey()).toBeNull();

    AdminApiClient.setAuthKey('test-key-123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('admin_key', 'test-key-123');
    expect(AdminApiClient.getAuthKey()).toBe('test-key-123');

    AdminApiClient.clearAuthKey();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('admin_key');
    expect(AdminApiClient.getAuthKey()).toBeNull();
  });

  /* ─── API Requests ─── */

  it('sends Authorization header when key is present', async () => {
    mockFetchOk({ success: true });
    AdminApiClient.setAuthKey('secret-key');

    await AdminApiClient.request('/endpoint');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/endpoint'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
        }),
      }),
    );
  });

  it('throws error when response is not ok', async () => {
    mockFetchFail(401);
    AdminApiClient.setAuthKey('wrong-key');

    await expect(AdminApiClient.request('/endpoint')).rejects.toThrow('Request failed');
  });

  /* ─── Translations API Methods ─── */

  it('gets translations for specific language', async () => {
    const mockData = { 'common.title': 'Sonora App' };
    mockFetchOk(mockData);

    const result = await AdminApiClient.getTranslations('en');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations/en'),
      expect.any(Object),
    );
    expect(result).toEqual(mockData);
  });

  it('bulk updates translations', async () => {
    mockFetchOk({ updated: 3 });
    const payload = [{ lang: 'es', key: 'title', value: 'Titulo' }];

    const result = await AdminApiClient.setTranslations(payload);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );
    expect(result).toEqual({ updated: 3 });
  });
});
