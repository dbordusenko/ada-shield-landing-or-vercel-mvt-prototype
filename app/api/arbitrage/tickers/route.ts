import { NextRequest, NextResponse } from 'next/server';
import { ExchangeTicker } from '@/lib/coingecko';

const BASE = 'https://api.coingecko.com/api/v3';

// Per-coin ticker cache
const cache = new Map<string, { data: ExchangeTicker[]; ts: number }>();
const TTL = 3 * 60 * 1000; // 3 min

async function fetchPage(coinId: string, page: number): Promise<ExchangeTicker[]> {
  const url = `${BASE}/coins/${coinId}/tickers?include_exchange_logo=false&depth=false&page=${page}`;
  const res = await fetch(url, { next: { revalidate: 180 } });
  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`CoinGecko ${res.status}`);
  }
  const body = await res.json();
  return body.tickers ?? [];
}

export async function GET(request: NextRequest) {
  const coinId = request.nextUrl.searchParams.get('coin');
  if (!coinId) return NextResponse.json({ error: 'coin param required' }, { status: 400 });

  const cached = cache.get(coinId);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    // Fetch up to 3 pages (300 tickers) — covers all major exchanges per coin
    const pages = await Promise.all([
      fetchPage(coinId, 1),
      fetchPage(coinId, 2),
      fetchPage(coinId, 3),
    ]);
    const tickers = pages.flat();
    cache.set(coinId, { data: tickers, ts: Date.now() });
    return NextResponse.json(tickers, {
      headers: { 'Cache-Control': 'public, s-maxage=180' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'Rate limited by CoinGecko. Slow down requests.' }, { status: 429 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
