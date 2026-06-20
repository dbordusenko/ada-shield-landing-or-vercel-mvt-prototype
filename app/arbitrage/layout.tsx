import Script from 'next/script';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto Arbitrage Scanner',
  description: 'Real-time price scanner across top 50 exchanges and 200 coins.',
  // Required for Telegram Mini App viewport
  other: { 'telegram:web_app': '1' },
};

export default function ArbitrageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Telegram Web App SDK — must load before page JS */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
