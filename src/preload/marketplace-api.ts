/**
 * Template marketplace preload API.
 * Only catalog listing is exposed. Install stays unavailable.
 */

import {
  MARKETPLACE_LIST_CHANNEL,
  MarketplaceListResponseSchema,
  type MarketplaceListResponse,
} from '@shared/contracts/marketplace-schemas';
import { validatedInvoke } from './validated-invoke';

export interface MarketplaceApi {
  list(): Promise<MarketplaceListResponse>;
}

export const marketplaceApi: MarketplaceApi = {
  list: () =>
    validatedInvoke(MARKETPLACE_LIST_CHANNEL, null, MarketplaceListResponseSchema, undefined),
};
