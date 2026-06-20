import { NextResponse } from 'next/server';
import { GeckoExchange } from '@/lib/coingecko';

const BASE = 'https://api.coingecko.com/api/v3';

let cache: { data: GeckoExchange[]; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1 hour — exchanges don't change often

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < TTL) {
      return NextResponse.json(cache.data, { headers: { 'X-Cache': 'HIT' } });
    }

    const res = await fetch(
      `${BASE}/exchanges?per_page=100&page=1`,
      { next: { revalidate: 3600 } },
    );

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

    const all: GeckoExchange[] = await res.json();

    // Keep top 50 by trust_score_rank, exclude exchanges with trading incentives
    const top50 = all
      .filter(e => e.trust_score >= 7 && !e.has_trading_incentive)
      .sort((a, b) => a.trust_score_rank - b.trust_score_rank)
      .slice(0, 50);

    cache = { data: top50, ts: Date.now() };

    return NextResponse.json(top50, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
