'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CoinMarket, GeckoExchange, ExchangeTicker,
  ArbitrageOpportunity, computeOpportunity,
} from '@/lib/coingecko';
import { useTelegram } from '@/hooks/useTelegram';

type ScanStatus = 'idle' | 'loading' | 'scanning' | 'done' | 'error';
type SortKey = 'spread' | 'volume' | 'rank';

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number) {
  if (n >= 10_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1)      return `$${n.toFixed(4)}`;
  if (n >= 0.01)   return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

function spreadLabel(pct: number) {
  if (pct >= 2)   return { text: 'text-emerald-400', bg: 'bg-emerald-900/50 border-emerald-700/50', ring: 'ring-emerald-500/30' };
  if (pct >= 0.8) return { text: 'text-yellow-400',  bg: 'bg-yellow-900/40 border-yellow-700/50',   ring: 'ring-yellow-500/30' };
  return           { text: 'text-slate-400',          bg: 'bg-slate-800/50 border-slate-700/50',     ring: 'ring-slate-600/20' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PillBtn({
  active, onClick, children, disabled,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${
        active
          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/40'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
    >
      {children}
    </button>
  );
}

function OpportunityCard({ opp, rank }: { opp: ArbitrageOpportunity; rank: number }) {
  const c = spreadLabel(opp.spread_pct);
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${c.bg} ring-1 ${c.ring}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={opp.coin_image} alt={opp.coin_name} className="w-7 h-7 rounded-full" />
          <div>
            <span className="font-bold text-slate-100 text-base">{opp.coin_symbol}</span>
            <span className="text-slate-500 text-xs ml-1.5">#{opp.market_cap_rank}</span>
          </div>
        </div>
        <div className={`text-2xl font-black tabular-nums ${c.text}`}>
          {opp.spread_pct.toFixed(2)}%
        </div>
      </div>

      {/* Trade path */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-blue-400 font-medium flex items-center gap-1">
            <span className="text-xs bg-blue-900/50 border border-blue-700/50 rounded px-1.5 py-0.5">BUY</span>
            {opp.buy_exchange}
          </span>
          <span className="text-slate-200 font-mono tabular-nums">{fmtPrice(opp.buy_price)}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 pl-2">
          <div className="w-px h-4 bg-slate-700" />
          <span className="text-xs">
            +{fmtUSD(opp.sell_price - opp.buy_price)} per coin
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="text-xs bg-emerald-900/50 border border-emerald-700/50 rounded px-1.5 py-0.5">SELL</span>
            {opp.sell_exchange}
          </span>
          <span className="text-slate-200 font-mono tabular-nums">{fmtPrice(opp.sell_price)}</span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-700/40">
        <span>Vol {fmtUSD(opp.min_volume_usd)}</span>
        <span>{opp.exchanges_available} exchanges</span>
        <span className={opp.potential_profit_1k > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
          {opp.potential_profit_1k > 0 ? '+' : ''}{fmtUSD(opp.potential_profit_1k)} / $1k
        </span>
      </div>
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center px-3">
      <div className={`text-lg font-black tabular-nums ${accent ? 'text-emerald-400' : 'text-slate-200'}`}>{value}</div>
      <div className="text-xs text-slate-500 leading-tight">{label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const COIN_PRESETS = [
  { label: 'Quick', value: 50,  est: '~2 min' },
  { label: 'Standard', value: 100, est: '~4 min' },
  { label: 'Full 200', value: 200, est: '~8 min' },
];
const SPREAD_PRESETS = [0.3, 0.5, 1.0, 2.0];
const VOLUME_PRESETS = [10_000, 50_000, 100_000, 500_000];
const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Spread', value: 'spread' },
  { label: 'Volume', value: 'volume' },
  { label: 'Rank',   value: 'rank'   },
];

export default function ArbitrageScanner() {
  const { tg, isTelegram } = useTelegram();

  const [status, setStatus]           = useState<ScanStatus>('idle');
  const [opportunities, setOpps]      = useState<ArbitrageOpportunity[]>([]);
  const [scanned, setScanned]         = useState(0);
  const [totalCoins, setTotalCoins]   = useState(0);
  const [error, setError]             = useState('');
  const [minSpread, setMinSpread]     = useState(0.3);
  const [minVolume, setMinVolume]     = useState(50_000);
  const [coinLimit, setCoinLimit]     = useState(50);
  const [sortBy, setSortBy]           = useState<SortKey>('spread');
  const [lastScan, setLastScan]       = useState<Date | null>(null);
  const [showSetup, setShowSetup]     = useState(false);
  const abortRef                      = useRef(false);

  const isRunning = status === 'scanning' || status === 'loading';

  // ── Scan logic ──────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    abortRef.current = false;
    setStatus('loading');
    setOpps([]);
    setScanned(0);
    setError('');
    tg.current?.HapticFeedback.impactOccurred('light');

    try {
      const [coinsRes, exchangesRes] = await Promise.all([
        fetch('/api/arbitrage/coins'),
        fetch('/api/arbitrage/exchanges'),
      ]);
      if (!coinsRes.ok)     throw new Error('Failed to fetch coins list');
      if (!exchangesRes.ok) throw new Error('Failed to fetch exchanges list');

      const allCoins: CoinMarket[]    = await coinsRes.json();
      const exchanges: GeckoExchange[] = await exchangesRes.json();
      const reliableIds               = new Set(exchanges.map(e => e.id));
      const coins                     = allCoins.slice(0, coinLimit);

      setTotalCoins(coins.length);
      setStatus('scanning');

      const found: ArbitrageOpportunity[] = [];

      for (let i = 0; i < coins.length; i++) {
        if (abortRef.current) break;

        try {
          const res = await fetch(`/api/arbitrage/tickers?coin=${coins[i].id}`);
          if (res.status === 429) { await delay(6000); i--; continue; }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const tickers: ExchangeTicker[] = await res.json();
          const opp = computeOpportunity(
            coins[i].id, coins[i].name, coins[i].symbol, coins[i].image,
            coins[i].market_cap_rank, tickers, reliableIds, minSpread,
          );

          if (opp && opp.min_volume_usd >= minVolume) {
            found.push(opp);
            setOpps([...found].sort((a, b) => b.spread_pct - a.spread_pct));
            tg.current?.HapticFeedback.notificationOccurred('success');
          }
        } catch { /* skip individual coin failures */ }

        setScanned(i + 1);
        await delay(2400); // ~25 req/min
      }

      setLastScan(new Date());
      setStatus('done');
      tg.current?.HapticFeedback.notificationOccurred('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
      tg.current?.HapticFeedback.notificationOccurred('error');
    }
  }, [coinLimit, minSpread, minVolume, tg]);

  const stopScan = useCallback(() => {
    abortRef.current = true;
    tg.current?.HapticFeedback.impactOccurred('medium');
  }, [tg]);

  // ── Telegram MainButton sync ────────────────────────────────────────────────
  useEffect(() => {
    const btn = tg.current?.MainButton;
    if (!btn) return;

    const handler = isRunning ? stopScan : startScan;

    if (isRunning) {
      btn.showProgress(true);
      btn.setText(scanned > 0 ? `Scanning ${scanned}/${totalCoins}…` : 'Loading…');
    } else {
      btn.hideProgress();
      btn.setText(status === 'done' ? '🔄 Scan Again' : '▶  Start Scan');
    }

    btn.onClick(handler);
    btn.show();

    return () => btn.offClick(handler);
  }, [isRunning, scanned, totalCoins, status, startScan, stopScan, tg]);

  // ── Filtered / sorted results ───────────────────────────────────────────────
  const filtered = [...opportunities]
    .filter(o => o.spread_pct >= minSpread && o.min_volume_usd >= minVolume)
    .sort((a, b) =>
      sortBy === 'spread' ? b.spread_pct - a.spread_pct :
      sortBy === 'volume' ? b.min_volume_usd - a.min_volume_usd :
      a.market_cap_rank - b.market_cap_rank
    );

  const progress = totalCoins > 0 ? Math.round((scanned / totalCoins) * 100) : 0;
  const avgSpread = filtered.length > 0
    ? (filtered.reduce((s, o) => s + o.spread_pct, 0) / filtered.length).toFixed(2)
    : '—';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <h1 className="text-sm font-bold text-emerald-400 leading-tight">Arbitrage Scanner</h1>
            <p className="text-xs text-slate-600 leading-tight">50 exchanges · 200 coins</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastScan && (
            <span className="text-xs text-slate-600">
              {lastScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {isTelegram && (
            <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-800/50 rounded px-2 py-0.5">
              Telegram
            </span>
          )}
          <button
            onClick={() => setShowSetup(v => !v)}
            className="text-slate-500 hover:text-slate-300 text-lg px-1"
            aria-label="Setup info"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── Setup info panel ───────────────────────────────────────────────── */}
      {showSetup && (
        <div className="mx-4 mt-3 p-4 rounded-xl border border-slate-700 bg-slate-900 text-xs space-y-2">
          <p className="font-semibold text-slate-300">📱 Open in Telegram as Mini App</p>
          <ol className="text-slate-500 space-y-1 pl-4 list-decimal">
            <li>Open <span className="text-blue-400">@BotFather</span> in Telegram</li>
            <li>Send <code className="text-emerald-400">/newapp</code> and choose your bot</li>
            <li>Set Web App URL to your Vercel domain + <code className="text-emerald-400">/arbitrage</code></li>
            <li>Share the app link — it opens natively in Telegram</li>
          </ol>
          <p className="text-slate-600">
            URL: <code className="text-slate-400">{typeof window !== 'undefined' ? window.location.origin : 'your-domain.vercel.app'}/arbitrage</code>
          </p>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 space-y-4 border-b border-slate-800/60">
        {/* Scan depth */}
        <div>
          <div className="text-xs text-slate-500 mb-2">Scan depth</div>
          <div className="flex gap-2">
            {COIN_PRESETS.map(p => (
              <PillBtn
                key={p.value}
                active={coinLimit === p.value}
                onClick={() => setCoinLimit(p.value)}
                disabled={isRunning}
              >
                {p.label}
                <span className="ml-1 text-slate-500 font-normal">{p.est}</span>
              </PillBtn>
            ))}
          </div>
        </div>

        {/* Min spread */}
        <div>
          <div className="text-xs text-slate-500 mb-2">Min spread</div>
          <div className="flex gap-2 flex-wrap">
            {SPREAD_PRESETS.map(v => (
              <PillBtn key={v} active={minSpread === v} onClick={() => setMinSpread(v)} disabled={isRunning}>
                {v}%
              </PillBtn>
            ))}
          </div>
        </div>

        {/* Min volume */}
        <div>
          <div className="text-xs text-slate-500 mb-2">Min volume</div>
          <div className="flex gap-2 flex-wrap">
            {VOLUME_PRESETS.map(v => (
              <PillBtn key={v} active={minVolume === v} onClick={() => setMinVolume(v)} disabled={isRunning}>
                {fmtUSD(v)}
              </PillBtn>
            ))}
          </div>
        </div>
      </div>

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      {isRunning && (
        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">
              {status === 'loading'
                ? 'Loading exchanges & coins…'
                : `Coin ${scanned} / ${totalCoins}`}
            </span>
            <span className="text-emerald-400 font-mono">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {status === 'scanning' && (
            <p className="text-xs text-slate-600">
              ~{Math.ceil(((totalCoins - scanned) * 2.4) / 60)} min left · {opportunities.length} found so far
            </p>
          )}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      {opportunities.length > 0 && (
        <div className="flex divide-x divide-slate-800 border-b border-slate-800 py-3">
          <StatChip label="Found"       value={String(filtered.length)} accent />
          <StatChip label="Scanned"     value={`${scanned}/${totalCoins}`} />
          <StatChip label="Best"        value={`${filtered[0]?.spread_pct.toFixed(2) ?? '—'}%`} accent />
          <StatChip label="Avg spread"  value={`${avgSpread}%`} />
        </div>
      )}

      {/* ── Sort bar ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/60 text-xs">
          <span className="text-slate-600">Sort:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2.5 py-1 rounded-full border transition-all ${
                sortBy === opt.value
                  ? 'border-emerald-600 text-emerald-400'
                  : 'border-slate-700 text-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Idle splash ────────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-7xl mb-5">📊</div>
          <h2 className="text-2xl font-bold text-slate-200 mb-2">Find arbitrage</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-xs">
            Compares prices for top 200 coins across 50 trusted exchanges in real time.
            Shows where to buy cheap and sell high.
          </p>
          {!isTelegram && (
            <button
              onClick={startScan}
              className="w-full max-w-xs py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-lg transition-all active:scale-95 shadow-lg shadow-emerald-900/40"
            >
              ▶  Start Scan
            </button>
          )}
        </div>
      )}

      {/* ── Results (mobile cards) ─────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="p-4 space-y-3 md:hidden">
          {filtered.map((opp, idx) => (
            <OpportunityCard key={opp.coin_id} opp={opp} rank={idx + 1} />
          ))}
        </div>
      )}

      {/* ── Results (desktop table) ────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="hidden md:block px-6 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-left px-4 py-3">Buy on</th>
                  <th className="text-right px-4 py-3">Buy price</th>
                  <th className="text-left px-4 py-3">Sell on</th>
                  <th className="text-right px-4 py-3">Sell price</th>
                  <th className="text-right px-4 py-3">Spread</th>
                  <th className="text-right px-4 py-3">Min vol</th>
                  <th className="text-right px-4 py-3">Profit/$1k</th>
                  <th className="text-right px-4 py-3">Exch.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((opp, idx) => {
                  const c = spreadLabel(opp.spread_pct);
                  return (
                    <tr key={opp.coin_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={opp.coin_image} alt="" className="w-5 h-5 rounded-full" />
                          <span className="font-semibold text-slate-200">{opp.coin_symbol}</span>
                          <span className="text-slate-600 text-xs">#{opp.market_cap_rank}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-900/40 text-blue-300 border border-blue-800/40">
                          {opp.buy_exchange}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 font-mono tabular-nums">
                        {fmtPrice(opp.buy_price)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800/40">
                          {opp.sell_exchange}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 font-mono tabular-nums">
                        {fmtPrice(opp.sell_price)}
                      </td>
                      <td className={`px-4 py-3 text-right font-black tabular-nums ${c.text}`}>
                        {opp.spread_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                        {fmtUSD(opp.min_volume_usd)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${opp.potential_profit_1k > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {opp.potential_profit_1k > 0 ? '+' : ''}{fmtUSD(opp.potential_profit_1k)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">{opp.exchanges_available}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty after scan ───────────────────────────────────────────────── */}
      {status === 'done' && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 px-6 text-center text-slate-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">No opportunities above {minSpread}% spread + {fmtUSD(minVolume)} vol.</p>
          <p className="text-xs mt-1">Lower the filters or try a wider coin scan.</p>
        </div>
      )}

      {/* ── Bottom CTA (mobile browser only, not Telegram — TG uses MainButton) */}
      {!isTelegram && (
        <div className="sticky bottom-0 px-4 py-3 bg-slate-950/95 backdrop-blur border-t border-slate-800">
          {isRunning ? (
            <button
              onClick={stopScan}
              className="w-full py-3.5 rounded-2xl bg-red-700 hover:bg-red-600 font-bold text-base transition-all active:scale-95"
            >
              ⏹  Stop Scan
            </button>
          ) : (
            <button
              onClick={startScan}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-base transition-all active:scale-95 shadow-lg shadow-emerald-900/40"
            >
              {status === 'done' ? '🔄  Scan Again' : '▶  Start Scan'}
            </button>
          )}
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      <div className={`px-4 py-5 text-xs text-slate-700 leading-relaxed ${!isTelegram ? 'pb-24' : ''}`}>
        Not financial advice. Prices shown are delayed; always verify before trading.
        Arbitrage involves transfer delays, fees, and withdrawal risks.
      </div>
    </div>
  );
}
