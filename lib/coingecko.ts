export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
}

export interface ExchangeTicker {
  market: { name: string; identifier: string; has_trading_incentive: boolean };
  base: string;
  target: string;
  last: number;
  volume: number;
  converted_last: { usd: number; btc: number; eth: number };
  converted_volume: { usd: number; btc: number; eth: number };
  trust_score: 'green' | 'yellow' | 'red' | null;
  bid_ask_spread_percentage: number | null;
  timestamp: string;
  is_stale: boolean;
  is_anomaly: boolean;
}

export interface GeckoExchange {
  id: string;
  name: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  has_trading_incentive: boolean;
  year_established: number | null;
  country: string | null;
  url: string;
  image: string;
}

export interface ArbitrageOpportunity {
  coin_id: string;
  coin_name: string;
  coin_symbol: string;
  coin_image: string;
  market_cap_rank: number;
  buy_exchange: string;
  buy_exchange_id: string;
  buy_price: number;
  sell_exchange: string;
  sell_exchange_id: string;
  sell_price: number;
  spread_pct: number;
  min_volume_usd: number;
  pair: string;
  last_updated: string;
  exchanges_available: number;
  potential_profit_1k: number;
}

const STABLECOIN_TARGETS = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'TUSD', 'DAI', 'FDUSD', 'PYUSD']);

export function computeOpportunity(
  coinId: string,
  coinName: string,
  coinSymbol: string,
  coinImage: string,
  marketCapRank: number,
  tickers: ExchangeTicker[],
  reliableExchangeIds: Set<string>,
  minSpreadPct: number = 0.2,
): ArbitrageOpportunity | null {
  const valid = tickers.filter(t =>
    !t.is_stale &&
    !t.is_anomaly &&
    t.trust_score === 'green' &&
    STABLECOIN_TARGETS.has(t.target) &&
    t.converted_last?.usd > 0 &&
    (t.converted_volume?.usd ?? 0) >= 10_000 &&
    reliableExchangeIds.has(t.market.identifier)
  );

  if (valid.length < 2) return null;

  const sorted = [...valid].sort((a, b) => a.converted_last.usd - b.converted_last.usd);
  const cheapest = sorted[0];
  const priciest = sorted[sorted.length - 1];

  const spreadPct =
    ((priciest.converted_last.usd - cheapest.converted_last.usd) / cheapest.converted_last.usd) * 100;

  if (spreadPct < minSpreadPct) return null;

  const minVol = Math.min(
    cheapest.converted_volume?.usd ?? 0,
    priciest.converted_volume?.usd ?? 0,
  );

  // Profit on $1k capital after ~0.2% buy+sell fees
  const profit1k = (spreadPct / 100 - 0.002) * 1000;

  return {
    coin_id: coinId,
    coin_name: coinName,
    coin_symbol: coinSymbol.toUpperCase(),
    coin_image: coinImage,
    market_cap_rank: marketCapRank,
    buy_exchange: cheapest.market.name,
    buy_exchange_id: cheapest.market.identifier,
    buy_price: cheapest.converted_last.usd,
    sell_exchange: priciest.market.name,
    sell_exchange_id: priciest.market.identifier,
    sell_price: priciest.converted_last.usd,
    spread_pct: parseFloat(spreadPct.toFixed(3)),
    min_volume_usd: minVol,
    pair: `${coinSymbol.toUpperCase()}/${cheapest.target}`,
    last_updated: new Date().toISOString(),
    exchanges_available: valid.length,
    potential_profit_1k: parseFloat(profit1k.toFixed(2)),
  };
}
