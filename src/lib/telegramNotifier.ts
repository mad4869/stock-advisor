import { Market } from '@/types';
import { Preset } from '@/lib/swingScreener';

export interface TelegramAlertPayload {
  symbol: string;
  market: Market;
  preset: Preset;
  price?: number;
  volumeRatio?: number | null;
  priceChange10d?: number | null;
  taScore: number;
  smartMoneyScore?: number | null;
  appBaseUrl?: string;
}

/**
 * Sends a rich HTML push notification via the Telegram Bot API.
 */
export async function sendTelegramAlert(payload: TelegramAlertPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[telegramNotifier] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in environment.');
    return false;
  }

  const { symbol, market, preset, price, volumeRatio, priceChange10d, taScore, smartMoneyScore } = payload;

  const presetTitleMap: Record<string, string> = {
    VOL_SPIKE: '🚀 VOLUME SPIKE DETECTED',
    OVERSOLD: '📊 STOCH GC FROM OVERSOLD',
    BREAKOUT: '⚡ SWING BREAKOUT SETUP',
    EARLY_BREAKOUT: '🌱 EARLY BREAKOUT SETUP'
  };

  const title = presetTitleMap[preset] || `📈 ALERT: ${preset}`;
  const volStr = volumeRatio != null ? `<b>Volume Spike:</b> ${volumeRatio.toFixed(1)}x avg` : '<b>Volume:</b> Normal';
  const priceChangeStr = priceChange10d != null
    ? `<b>10d Price Change:</b> ${(priceChange10d * 100 >= 0 ? '+' : '')}${(priceChange10d * 100).toFixed(1)}%`
    : '';
  const priceStr = price != null ? `<b>Live Price:</b> ${market === 'ID' ? 'Rp ' : '$'}${price.toLocaleString()}` : '';
  const smartScoreStr = smartMoneyScore != null ? `<b>Smart Money Score:</b> ${smartMoneyScore}/100` : '';

  const vUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  const baseUrl = payload.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || (vUrl ? `https://${vUrl}` : 'https://stock-advisor-two.vercel.app');
  const detailUrl = `${baseUrl.replace(/\/$/, '')}/stock/${symbol}?market=${market}&preset=${preset}`;

  const message = `
${title}

<b>Symbol:</b> <code>${symbol}</code> (${market})
${priceStr}
${volStr}
${priceChangeStr}
<b>TA Score:</b> ${taScore}/100
${smartScoreStr}

👉 <a href="${detailUrl}">Open Detailed Analytics</a>
`.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[telegramNotifier] Telegram API failed (${response.status}):`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[telegramNotifier] Network error sending Telegram message:', error);
    return false;
  }
}
