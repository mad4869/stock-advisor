import { Market } from '@/types';
import { BuySignalResult, PriceLevel, FundamentalSummary } from './buySignalDetector';

export interface BuySignalPayload {
  symbol: string;
  market: Market;
  price: number;
  signal: BuySignalResult;
  appBaseUrl?: string;
}

/**
 * Formats a price with the correct market currency prefix.
 */
function fmtPrice(price: number, market: Market): string {
  if (market === 'ID') {
    return `Rp ${price.toLocaleString('id-ID')}`;
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Sends a rich BUY signal notification via the Telegram Bot API.
 */
export async function sendBuySignalAlert(payload: BuySignalPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[telegramNotifier] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in environment.');
    return false;
  }

  const { symbol, market, price, signal } = payload;

  // ── Build Reasons Block ──
  const reasonLines = signal.reasons.map(r => `• ${r.label} (${r.detail})`).join('\n');

  // ── Build Entry Block ──
  const entryLines = signal.entries
    .map(e => `  → ${e.label}: ${fmtPrice(e.price, market)}`)
    .join('\n');

  // ── Build Stop Loss ──
  const slLine = signal.stopLoss
    ? `🛑 <b>Stop Loss:</b> ${fmtPrice(signal.stopLoss.price, market)} (${signal.stopLoss.label})`
    : '';

  // ── Build Targets Block ──
  const targetLines = signal.targets
    .map((t, i) => `  → T${i + 1}: ${fmtPrice(t.price, market)} (${t.label})`)
    .join('\n');

  // ── Build Fundamental Summary ──
  let fundLine = '';
  if (signal.fundamentalSummary) {
    const f = signal.fundamentalSummary;
    const parts: string[] = [];
    if (f.roe) parts.push(`ROE ${f.roe}`);
    if (f.debtToEquity) parts.push(`D/E ${f.debtToEquity}`);
    if (f.dividendYield) parts.push(`Div ${f.dividendYield}`);
    fundLine = `📈 <b>Fundamental Grade:</b> ${f.grade} (${f.total}/100)` +
      (parts.length > 0 ? `\n  ${parts.join(' | ')}` : '');
  }

  // ── Build Detail URL ──
  const vUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  const baseUrl = payload.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || (vUrl ? `https://${vUrl}` : 'https://stock-advisor-two.vercel.app');
  const detailUrl = `${baseUrl.replace(/\/$/, '')}/stock/${symbol}?market=${market}`;

  // ── Assemble Message ──
  const message = [
    `🟢 <b>BUY SIGNAL: ${symbol.replace('.JK', '')}</b> (${market === 'ID' ? 'IDX' : 'US'})`,
    '',
    `📊 <b>Why Buy:</b>`,
    reasonLines,
    '',
    `💰 <b>Entry:</b>`,
    entryLines,
    '',
    slLine,
    '',
    targetLines ? `🎯 <b>Targets:</b>\n${targetLines}` : '',
    '',
    fundLine,
    '',
    `👉 <a href="${detailUrl}">Open Detailed Analytics</a>`,
  ]
    .filter(line => line !== '') // Remove empty sections
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse triple+ newlines
    .trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
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
