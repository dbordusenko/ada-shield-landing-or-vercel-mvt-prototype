'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal subset of the Telegram Web App JS API
export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  viewportHeight: number;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function useTelegram() {
  const tg = useRef<TelegramWebApp | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      tg.current = webApp;
      setIsTelegram(true);
    }
  }, []);

  return { tg, isTelegram };
}
