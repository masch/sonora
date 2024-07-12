import SqliteStorage from 'expo-sqlite/kv-store';
import { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail } from '@/storage/app-storage';

const mockKv = SqliteStorage as jest.Mocked<typeof SqliteStorage>;

describe('app-storage (purchases)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: getItem returns null (no stored data)
    mockKv.getItem.mockResolvedValue(null);
    mockKv.setItem.mockResolvedValue(undefined);
  });

  describe('getPurchasedIds', () => {
    it('returns empty set when no stored data', async () => {
      const ids = await getPurchasedIds();
      expect(ids).toBeInstanceOf(Set);
      expect(ids.size).toBe(0);
    });

    it('parses stored JSON array', async () => {
      mockKv.getItem.mockResolvedValue(JSON.stringify(['id-1', 'id-2']));
      const ids = await getPurchasedIds();
      expect(ids.size).toBe(2);
      expect(ids.has('id-1')).toBe(true);
      expect(ids.has('id-2')).toBe(true);
    });

    it('handles malformed JSON gracefully', async () => {
      mockKv.getItem.mockResolvedValue('not-json');
      const ids = await getPurchasedIds();
      expect(ids.size).toBe(0);
    });
  });

  describe('addPurchasedId', () => {
    it('adds new ID to empty set and persists', async () => {
      mockKv.getItem.mockResolvedValue(null);
      await addPurchasedId('new-id');

      expect(mockKv.setItem).toHaveBeenCalledWith(
        'purchased_experiences',
        expect.stringContaining('new-id'),
      );
    });

    it('merges with existing IDs', async () => {
      mockKv.getItem.mockResolvedValue(JSON.stringify(['existing-id']));
      await addPurchasedId('new-id');

      expect(mockKv.setItem).toHaveBeenCalledWith(
        'purchased_experiences',
        expect.stringMatching(/existing-id/),
      );
    });

    it('does not duplicate IDs', async () => {
      mockKv.getItem.mockResolvedValue(JSON.stringify(['id-1']));
      await addPurchasedId('id-1');
      await addPurchasedId('id-1');

      // Second call should still have only one 'id-1'
      const setItemCalls = mockKv.setItem.mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      let stored: string[] = [];
      try {
        stored = JSON.parse(lastCall[1] as string);
      } catch {
        // ignore parse errors in test
      }
      expect(stored).toEqual(['id-1']);
    });

    it('handles storage errors gracefully', async () => {
      mockKv.getItem.mockImplementation(() => Promise.reject(new Error('storage error')));
      // Should not throw
      await expect(addPurchasedId('new-id')).resolves.toBeUndefined();
    });
  });

  describe('getUserEmail', () => {
    it('returns null when no email stored', async () => {
      const email = await getUserEmail();
      expect(email).toBeNull();
    });

    it('returns stored email', async () => {
      mockKv.getItem.mockResolvedValue('user@example.com');
      const email = await getUserEmail();
      expect(email).toBe('user@example.com');
    });

    it('handles errors gracefully', async () => {
      mockKv.getItem.mockImplementation(() => Promise.reject(new Error('error')));
      const email = await getUserEmail();
      expect(email).toBeNull();
    });
  });

  describe('setUserEmail', () => {
    it('persists email', async () => {
      await setUserEmail('user@example.com');
      expect(mockKv.setItem).toHaveBeenCalledWith('user_email', 'user@example.com');
    });

    it('handles errors gracefully', async () => {
      mockKv.setItem.mockImplementation(() => Promise.reject(new Error('error')));
      await expect(setUserEmail('user@example.com')).resolves.toBeUndefined();
    });
  });
});
