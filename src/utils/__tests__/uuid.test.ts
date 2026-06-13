import { generateUUID } from '../uuid';

describe('uuid utility', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    // Restore original global crypto
    if (originalCrypto) {
      globalThis.crypto = originalCrypto;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).crypto;
    }
  });

  it('generates a string', () => {
    const uuid = generateUUID();
    expect(typeof uuid).toBe('string');
    expect(uuid.length).toBeGreaterThan(0);
  });

  it('generates distinct IDs on consecutive calls', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
  });

  it('uses crypto.randomUUID when available', () => {
    const mockUUID = '1234abcd-1234-abcd-1234-abcd1234abcd';
    const mockRandomUUID = jest.fn().mockReturnValue(mockUUID);

    // Mock global crypto
    globalThis.crypto = {
      randomUUID: mockRandomUUID,
    } as unknown as Crypto;

    const result = generateUUID();
    expect(result).toBe(mockUUID);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to timestamp and random suffix when crypto is undefined', () => {
    // Temporarily delete crypto from globals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).crypto;

    const result = generateUUID();
    expect(result).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('falls back to timestamp and random suffix when crypto.randomUUID is undefined', () => {
    // Mock global crypto without randomUUID
    globalThis.crypto = {} as unknown as Crypto;

    const result = generateUUID();
    expect(result).toMatch(/^\d+-[a-z0-9]+$/);
  });
});
