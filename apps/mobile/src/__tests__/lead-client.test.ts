import { LeadClient } from '@/services/lead-client';

const mockPost = jest.fn();

jest.mock('@/services/api-client', () => ({
  ApiClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('LeadClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitLead', () => {
    it('posts to /leads with lead payload and returns response', async () => {
      mockPost.mockResolvedValue({
        status: 'ok',
      });

      const payload = {
        email: 'test@example.com',
        experienceId: '123e4567-e89b-12d3-a456-426614174000',
        source: 'track_detail' as const,
      };

      const result = await LeadClient.submitLead(payload);

      expect(mockPost).toHaveBeenCalledWith('/leads', payload);
      expect(result).toEqual({ status: 'ok' });
    });

    it('propagates errors when ApiClient fails', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        LeadClient.submitLead({
          email: 'test@example.com',
          source: 'trip_detail',
        }),
      ).rejects.toThrow('Network error');
    });
  });
});
