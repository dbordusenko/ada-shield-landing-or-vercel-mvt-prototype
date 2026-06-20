'use client';

import { useState, useCallback, useRef } from 'react';
import { CoinMarket, GeckoExchange, ExchangeTicker, ArbitrageOpportunity, computeOpportunity } from '@/lib/coingecko';

type ScanStatus = 'idle' | 'loading' | 'scanning' | 'done' | 'error';

const SPREAD_COLORS: Record<string, string> = {
  hot: 'text-emerald-400',
  warm: 'text-yellow-400',
  cold: 'text-slate-400',
};

function spreadColor(pct: number) {
  if (pct >= 1.5) return SPREAD_COLORS.hot;
  if (pct >= 0.5) return SPREAD_COLORS.warm;
  return SPREAD_COLORS.cold;
}

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number) {
  if (n >= 10_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

const COIN_LIMITS = [
  { label: 'Top 50 coins', value: 50 },
  { label: 'Top 100 coins', value: 100 },
  { label: 'Top 200 coins', value: 200 },
];

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export default function ArbitrageScanner() {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [scanned, setScanned] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [error, setError] = useState('');
  const [minSpread, setMinSpread] = useState(0.3);
  const [minVolume, setMinVolume] = useState(50_000);
  const [coinLimit, setCoinLimit] = useState(50);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'spread' | 'volume' | 'rank'>('spread');
  const abortRef = useRef(false);

  const startScan = useCallback(async () => {
    abortRef.current = false;
    setStatus('loading');
    setOpportunities([]);
    setScanned(0);
    setError('');

    try {
      // 1. Load coins and exchanges in parallel
      const [coinsRes, exchangesRes] = await Promise.all([
        fetch('/api/arbitrage/coins'),
        fetch('/api/arbitrage/exchanges'),
      ]);

      if (!coinsRes.ok) throw new Error('Failed to load coins list');
      if (!exchangesRes.ok) throw new Error('Failed to load exchanges list');

      const allCoins: CoinMarket[] = await coinsRes.json();
      const exchanges: GeckoExchange[] = await exchangesRes.json();

      const reliableIds = new Set(exchanges.map(e => e.id));
      const coins = allCoins.slice(0, coinLimit);
      setTotalCoins(coins.length);
      setStatus('scanning');

      const found: ArbitrageOpportunity[] = [];

      for (let i = 0; i < coins.length; i++) {
        if (abortRef.current) break;
        const coin = coins[i];

        try {
          const tickersRes = await fetch(`/api/arbitrage/tickers?coin=${coin.id}`);
          if (tickersRes.status === 429) {
            // Back off 5s on rate limit
            await delay(5000);
            i--; // retry
            continue;
          }
          if (!tickersRes.ok) throw new Error(`tickers ${tickersRes.status}`);
          const tickers: ExchangeTicker[] = await tickersRes.json();

          const opp = computeOpportunity(
            coin.id, coin.name, coin.symbol, coin.image,
            coin.market_cap_rank, tickers, reliableIds, minSpread,
          );

          if (opp && opp.min_volume_usd >= minVolume) {
            found.push(opp);
            setOpportunities([...found].sort((a, b) => b.spread_pct - a.spread_pct));
          }
        } catch {
          // skip failed coins silently
        }

        setScanned(i + 1);
        // Throttle: ~25 req/min to stay under CoinGecko free limit
        await delay(2400);
      }

      setLastScan(new Date());
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [coinLimit, minSpread, minVolume]);

  const stopScan = () => { abortRef.current = true; };

  const sorted = [...opportunities].sort((a, b) => {
    if (sortBy === 'spread') return b.spread_pct - a.spread_pct;
    if (sortBy === 'volume') return b.min_volume_usd - a.min_volume_usd;
    return a.market_cap_rank - b.market_cap_rank;
  });

  const filtered = sorted.filter(o => o.spread_pct >= minSpread && o.min_volume_usd >= minVolume);

  const progress = totalCoins > 0 ? Math.round((scanned / totalCoins) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-emerald-400 tracking-tight">
            ⚡ Crypto Arbitrage Scanner
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Top 50 exchanges · Top 200 coins · Data via CoinGecko
          </p>
        </div>
        {lastScan && (
          <span className="text-xs text-slate-500">
            Last scan: {lastScan.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="flex flex-wrap gap-6 items-end">
          {/* Coin limit */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Coins to scan</label>
            <select
              value={coinLimit}
              onChange={e => setCoinLimit(Number(e.target.value))}
              disabled={status === 'scanning' || status === 'loading'}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {COIN_LIMITS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Min spread */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Min spread: <span className="text-emerald-400">{minSpread.toFixed(1)}%</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={minSpread}
              onChange={e => setMinSpread(Number(e.target.value))}
              className="w-32 accent-emerald-500"
            />
          </div>

          {/* Min volume */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Min volume: <span className="text-emerald-400">{fmtUSD(minVolume)}</span>
            </label>
            <input
              type="range"
              min={10_000}
              max={1_000_000}
              step={10_000}
              value={minVolume}
              onChange={e => setMinVolume(Number(e.target.value))}
              className="w-32 accent-emerald-500"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'spread' | 'volume' | 'rank')}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="spread">Spread %</option>
              <option value="volume">Volume</option>
              <option value="rank">Market Cap Rank</option>
            </select>
          </div>

          {/* Scan button */}
          <div className="flex gap-2 ml-auto">
            {status === 'scanning' || status === 'loading' ? (
              <button
                onClick={stopScan}
                className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-sm font-semibold transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={startScan}
                className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <span>▶</span> Start Scan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {(status === 'scanning' || status === 'loading') && (
        <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">
              {status === 'loading' ? 'Loading coin list and exchange data...' : `Scanning coin ${scanned} of ${totalCoins}...`}
            </span>
            <span className="text-emerald-400">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {status === 'scanning' && (
            <p className="text-xs text-slate-600 mt-1">
              ~{Math.round(((totalCoins - scanned) * 2.4) / 60)} min remaining
              (throttled to stay under CoinGecko free-tier limits)
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="mx-6 mt-4 p-4 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          Error: {error}
        </div>
      )}

      {/* Stats bar */}
      {opportunities.length > 0 && (
        <div className="px-6 py-3 flex gap-8 border-b border-slate-800 text-sm">
          <Stat label="Opportunities" value={String(filtered.length)} accent />
          <Stat label="Coins scanned" value={`${scanned}/${totalCoins}`} />
          <Stat label="Best spread" value={`${filtered[0]?.spread_pct.toFixed(2) ?? '—'}%`} accent />
          <Stat label="Avg spread" value={
            filtered.length > 0
              ? `${(filtered.reduce((s, o) => s + o.spread_pct, 0) / filtered.length).toFixed(2)}%`
              : '—'
          } />
        </div>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-bold text-slate-300 mb-3">Ready to scan</h2>
          <p className="text-slate-500 max-w-md mb-8 text-sm leading-relaxed">
            Scans top {coinLimit} coins across top 50 exchanges in real time.
            Finds price discrepancies where you can buy cheap and sell higher.
          </p>
          <button
            onClick={startScan}
            className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-lg transition-colors"
          >
            Start Scan
          </button>
          <p className="text-xs text-slate-600 mt-4">
            Top 50 coins ≈ 2 min · Top 100 ≈ 4 min · Top 200 ≈ 8 min
          </p>
        </div>
      )}

      {/* Results table */}
      {filtered.length > 0 && (
        <div className="px-6 py-4">
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-left px-4 py-3">Buy on</th>
                  <th className="text-right px-4 py-3">Buy price</th>
                  <th className="text-left px-4 py-3">Sell on</th>
                  <th className="text-right px-4 py-3">Sell price</th>
                  <th className="text-right px-4 py-3">Spread</th>
                  <th className="text-right px-4 py-3">Min vol</th>
                  <th className="text-right px-4 py-3">Profit/$1k</th>
                  <th className="text-right px-4 py-3">Exchanges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((opp, idx) => (
                  <tr
                    key={opp.coin_id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={opp.coin_image} alt={opp.coin_name} className="w-5 h-5 rounded-full" />
                        <span className="font-semibold text-slate-200">{opp.coin_symbol}</span>
                        <span className="text-slate-500 text-xs hidden md:inline">#{opp.market_cap_rank}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ExchangeBadge name={opp.buy_exchange} type="buy" />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {fmtPrice(opp.buy_price)}
                    </td>
                    <td className="px-4 py-3">
                      <ExchangeBadge name={opp.sell_exchange} type="sell" />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {fmtPrice(opp.sell_price)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${spreadColor(opp.spread_pct)}`}>
                      {opp.spread_pct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                      {fmtUSD(opp.min_volume_usd)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${opp.potential_profit_1k > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {opp.potential_profit_1k > 0 ? '+' : ''}{fmtUSD(opp.potential_profit_1k)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {opp.exchanges_available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state after scan */}
      {status === 'done' && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 text-slate-500">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-sm">No opportunities found above {minSpread}% spread.</p>
          <p className="text-xs mt-1">Try lowering the min spread or min volume filters.</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-6 py-6 mt-4 text-xs text-slate-600 border-t border-slate-800 leading-relaxed">
        <strong className="text-slate-500">Disclaimer:</strong> This tool is for informational purposes only.
        Arbitrage carries risks including network fees, transfer delays, exchange rate changes, and withdrawal restrictions.
        Always verify opportunities manually before trading. Not financial advice.
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-bold text-base ${accent ? 'text-emerald-400' : 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}

function ExchangeBadge({ name, type }: { name: string; type: 'buy' | 'sell' }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
      type === 'buy'
        ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
        : 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
    }`}>
      {name}
    </span>
  );
}
