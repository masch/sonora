import { z } from 'zod';

export const AudioUploadBodySchema = z.object({
  file: z.instanceof(File, { message: 'file must be a File' }),
  key: z.string().min(1, 'key is required'),
});
