import { z } from 'zod';

export const pullRequestSchema = z.object({
  id: z.number().int().positive(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean(),
});

export const pullRequestsSchema = z.array(pullRequestSchema);

export type PullRequest = z.infer<typeof pullRequestSchema>;
