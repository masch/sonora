import { ApiClient } from '@/services/api-client';
import type { LeadPostBody, LeadResponse } from '@sonora/shared';

export const LeadClient = {
  async submitLead(payload: LeadPostBody): Promise<LeadResponse> {
    return ApiClient.post<LeadResponse>('/leads', payload);
  },
};
