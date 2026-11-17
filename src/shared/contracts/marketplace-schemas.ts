/**
 * Template marketplace IPC schemas.
 * Install is not part of this contract.
 */

import { z } from 'zod';

export const MARKETPLACE_LIST_CHANNEL = 'marketplace:list';

export const MarketplaceTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  author: z.string(),
  category: z.string(),
  previewUrl: z.string(),
  downloadUrl: z.string(),
  version: z.string(),
  downloads: z.number(),
});

export const MarketplaceListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(MarketplaceTemplateSchema).optional(),
  error: z.string().optional(),
});

export type MarketplaceListResponse = z.infer<typeof MarketplaceListResponseSchema>;
