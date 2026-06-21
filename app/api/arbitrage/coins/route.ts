import { NextResponse } from 'next/server';
import { CoinMarket } from '@/lib/coingecko';

const BASE = 'https://api.coingecko.com/api/v3';

// In-memory cache shared across warm serverless invocations
let cache: { data: CoinMarket[]; ts: number } | null = null;
const TTL = 10 * 60 * 1000; // 10 min

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // Fetch top 200 in two pages of 100
    const [page1, page2] = await Promise.all([
      fetch(`${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`, {
        next: { revalidate: 600 },
      }),
      fetch(`${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=2&sparkline=false`, {
        next: { revalidate: 600 },
      }),
    ]);

    if (!page1.ok || !page2.ok) {
      throw new Error(`CoinGecko ${page1.status}/${page2.status}`);
    }

    const [coins1, coins2]: [CoinMarket[], CoinMarket[]] = await Promise.all([
      page1.json(),
      page2.json(),
    ]);

    const coins = [...coins1, ...coins2];
    cache = { data: coins, ts: Date.now() };

    return NextResponse.json(coins, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=600' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
