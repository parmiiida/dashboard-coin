'use server';

import qs from 'query-string';

const BASE_URL = process.env.COINGECKO_BASE_URL;
const API_KEY = process.env.COINGECKO_API_KEY;

if (!BASE_URL) throw new Error('Could not get base url');

export async function fetcher<T>(
  endpoint: string,
  params?: QueryParams,
  revalidate = 60,
): Promise<T> {
  const normalizedBaseUrl = BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  const isProApi = normalizedBaseUrl.includes('pro-api.coingecko.com');
  const authHeader = isProApi ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';

  const url = qs.stringifyUrl(
    {
      url: `${normalizedBaseUrl}/${normalizedEndpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true },
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers[authHeader] = API_KEY;
  }

  const response = await fetch(url, {
    headers,
    next: { revalidate },
  });

  if (!response.ok) {
    let errorBody: CoinGeckoErrorBody = {};
    let rawErrorText = '';
    try {
      rawErrorText = await response.text();
      errorBody = rawErrorText ? JSON.parse(rawErrorText) : {};
    } catch {
      errorBody = {};
    }

    const parsedError =
      typeof errorBody.error === 'string'
        ? errorBody.error
        : errorBody.error
          ? JSON.stringify(errorBody.error)
          : '';
    const errorMessage = parsedError || rawErrorText || response.statusText || 'Unknown error';
    const fullUrl = url;
    throw new Error(
      `CoinGecko API Error [${endpoint}]: ${response.status} ${response.statusText} - ${errorMessage}\nURL: ${fullUrl}`,
    );
  }

  return response.json();
}

export async function getPools(
  id: string,
  network?: string | null,
  contractAddress?: string | null,
): Promise<PoolData> {
  const fallback: PoolData = {
    id: '',
    address: '',
    name: '',
    network: '',
  };

  if (network && contractAddress) {
    try {
      const poolData = await fetcher<{ data: PoolData[] }>(
        `/onchain/networks/${network}/tokens/${contractAddress}/pools`,
      );

      return poolData.data?.[0] ?? fallback;
    } catch (error) {
      console.log(error);
      return fallback;
    }
  }

  try {
    const poolData = await fetcher<{ data: PoolData[] }>('/onchain/search/pools', { query: id });

    return poolData.data?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}
