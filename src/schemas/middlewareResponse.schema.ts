import { z } from 'zod';

// Validate only the fields needed by the business rules and error messages.
export const middlewareResponseSchema = z.object({
  total_open_prs: z.number().int().nonnegative(),
  pull_requests: z.array(z.object({
    id: z.number().int().positive(),
    labels: z.array(z.string()),
    meta: z.object({
      is_draft: z.boolean(),
    }),
  })),
});

export type MiddlewareResponse = z.infer<typeof middlewareResponseSchema>;
