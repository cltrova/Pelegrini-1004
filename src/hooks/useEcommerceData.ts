import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  ecommerceService,
  type EcommerceService,
  type EcommerceServiceContext,
} from '@/modules/ecommerce/ecommerceService';
import type {
  EcommerceBranch,
  EcommerceConnectionResponse,
  EcommerceListingsResponse,
  EcommerceOrdersResponse,
  EcommerceOverviewResponse,
} from '@/modules/ecommerce/ecommerceTypes';

export const ecommerceQueryKeys = {
  connection: (companyCode: string | null | undefined, branch: EcommerceBranch) =>
    ['ecommerce', 'connection', companyCode ?? 'unknown', branch] as const,
  overview: (companyCode: string | null | undefined, branch: EcommerceBranch) =>
    ['ecommerce', 'overview', companyCode ?? 'unknown', branch] as const,
  listings: (companyCode: string | null | undefined, branch: EcommerceBranch) =>
    ['ecommerce', 'listings', companyCode ?? 'unknown', branch] as const,
  orders: (companyCode: string | null | undefined, branch: EcommerceBranch) =>
    ['ecommerce', 'orders', companyCode ?? 'unknown', branch] as const,
};

export interface UseEcommerceDataOptions {
  branch: EcommerceBranch | null | undefined;
  companyCode?: string | null;
  service?: EcommerceService;
}

export type EcommerceDataState = 'disabled' | 'loading' | 'error' | 'not_configured' | 'ready';

export interface EcommerceDataQueries {
  connection: UseQueryResult<EcommerceConnectionResponse>;
  overview: UseQueryResult<EcommerceOverviewResponse>;
  listings: UseQueryResult<EcommerceListingsResponse>;
  orders: UseQueryResult<EcommerceOrdersResponse>;
  startOAuth(): ReturnType<EcommerceService['startOAuth']>;
  queryKeys: {
    connection: readonly unknown[];
    overview: readonly unknown[];
    listings: readonly unknown[];
    orders: readonly unknown[];
  };
  state: EcommerceDataState;
}

function queryContext(options: UseEcommerceDataOptions): EcommerceServiceContext {
  return {
    branch: 'chevrolet',
    companyCode: options.companyCode,
  };
}

export function useEcommerceData(options: UseEcommerceDataOptions): EcommerceDataQueries {
  const service = options.service ?? ecommerceService;
  const isChevrolet = options.branch === 'chevrolet';
  const context = queryContext(options);
  const connectionKey = ecommerceQueryKeys.connection(options.companyCode, options.branch ?? 'transmissao');
  const overviewKey = ecommerceQueryKeys.overview(options.companyCode, options.branch ?? 'transmissao');
  const listingsKey = ecommerceQueryKeys.listings(options.companyCode, options.branch ?? 'transmissao');
  const ordersKey = ecommerceQueryKeys.orders(options.companyCode, options.branch ?? 'transmissao');

  const connection = useQuery({
    queryKey: connectionKey,
    queryFn: () => service.getConnectionStatus(context),
    enabled: isChevrolet,
  });
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: () => service.getOverview(context),
    enabled: isChevrolet,
  });
  const listings = useQuery({
    queryKey: listingsKey,
    queryFn: () => service.getListings(context),
    enabled: isChevrolet,
  });
  const orders = useQuery({
    queryKey: ordersKey,
    queryFn: () => service.getOrders(context),
    enabled: isChevrolet,
  });

  let state: EcommerceDataState = 'disabled';
  if (isChevrolet) {
    const queries = [connection, overview, listings, orders];
    if (queries.some((query) => query.isError)) state = 'error';
    else if (queries.some((query) => query.isPending)) state = 'loading';
    else if (
      connection.data?.state === 'not_configured' ||
      overview.data?.state === 'not_configured' ||
      listings.data?.state === 'not_configured' ||
      orders.data?.state === 'not_configured'
    ) state = 'not_configured';
    else state = 'ready';
  }

  return {
    connection,
    overview,
    listings,
    orders,
    startOAuth: () => service.startOAuth(context),
    queryKeys: {
      connection: connectionKey,
      overview: overviewKey,
      listings: listingsKey,
      orders: ordersKey,
    },
    state,
  };
}
