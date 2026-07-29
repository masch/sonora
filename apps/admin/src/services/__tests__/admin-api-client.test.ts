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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  /* ─── API Requests ─── */

  it('sends credentials: include on requests', async () => {
    mockFetchOk({ success: true });

    await AdminApiClient.request('/endpoint');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/endpoint'),
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('throws error when response is not ok', async () => {
    mockFetchFail(401);

    await expect(AdminApiClient.request('/endpoint')).rejects.toThrow('Request failed');
  });

  /* ─── Translations API Methods ─── */

  it('gets translations for specific language', async () => {
    const mockData = { 'common.title': 'Sonora App' };
    mockFetchOk(mockData);

    const result = await AdminApiClient.getTranslations('en');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations/en'),
      expect.objectContaining({
        credentials: 'include',
      }),
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
        credentials: 'include',
        body: JSON.stringify(payload),
      }),
    );
    expect(result).toEqual({ updated: 3 });
  });

  /* ─── Session Management ─── */

  it('creates session when loginSession returns 200', async () => {
    mockFetchOk({ valid: true });
    const result = await AdminApiClient.loginSession('valid-key');
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations/session'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ key: 'valid-key' }),
      }),
    );
  });

  it('clears session when logoutSession returns 200', async () => {
    mockFetchOk({ cleared: true });
    const result = await AdminApiClient.logoutSession();
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations/session'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }),
    );
  });

  it('returns false when loginSession returns non-200 status', async () => {
    mockFetchFail(401);
    const result = await AdminApiClient.loginSession('invalid-key');
    expect(result).toBe(false);
  });

  it('returns false when loginSession fetch fails entirely', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await AdminApiClient.loginSession('key');
    expect(result).toBe(false);
  });

  it('returns false when logoutSession returns non-200 status', async () => {
    mockFetchFail(500);
    const result = await AdminApiClient.logoutSession();
    expect(result).toBe(false);
  });

  it('returns false when logoutSession fetch fails entirely', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await AdminApiClient.logoutSession();
    expect(result).toBe(false);
  });

  it('delegates validateKey to loginSession', async () => {
    mockFetchOk({ valid: true });
    const result = await AdminApiClient.validateKey('valid-key');
    expect(result).toBe(true);
  });

  it('checkSession returns true when GET /api/translations/session responds { valid: true }', async () => {
    mockFetchOk({ valid: true });
    const result = await AdminApiClient.checkSession();
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translations/session'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('checkSession returns false when GET /api/translations/session responds { valid: false }', async () => {
    mockFetchOk({ valid: false });
    const result = await AdminApiClient.checkSession();
    expect(result).toBe(false);
  });

  it('checkSession returns false when GET /api/translations/session fails with 401 or network error', async () => {
    mockFetchFail(401);
    const result = await AdminApiClient.checkSession();
    expect(result).toBe(false);
  });
});
