import { z } from 'zod';

export const audioTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  src: z.string(),
  duration: z.string().optional(),
});

export type AudioTrack = z.infer<typeof audioTrackSchema>;
