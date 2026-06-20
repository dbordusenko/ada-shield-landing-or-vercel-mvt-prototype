import ArbitrageScanner from '@/components/ArbitrageScanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto Arbitrage Scanner',
  description: 'Real-time price discrepancy scanner across top 50 exchanges and top 200 coins.',
};

export default function ArbitragePage() {
  return <ArbitrageScanner />;
}
