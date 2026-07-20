import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol, Preset } from '@/lib/swingScreener';
import { ID_UNIVERSES, US_UNIVERSES } from '@/lib/universes';
import { isAlertedToday, markAlertedToday } from '@/lib/alertStorage';
import { sendTelegramAlert } from '@/lib/telegramNotifier';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby maximum duration limit

/**
 * Helper to delay between concurrency batches to prevent Yahoo Finance 429 errors
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // ──────────────────────────────────────────────────────────────
  // 1. JAKARTA MARKET HOURS GUARD (Monday–Friday, 09:00–16:00 WIB)
  // ──────────────────────────────────────────────────────────────
  if (!force) {
    const now = new Date();
    const jakartaTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const jakartaDate = new Date(jakartaTimeString);
    const dayOfWeek = jakartaDate.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = jakartaDate.getHours();

    if (dayOfWeek === 0 || dayOfWeek === 6 || hours < 10 || hours >= 16) {
      return NextResponse.json({
        status: 'skipped_outside_market_hours',
        message: `Current Jakarta time (${jakartaDate.toLocaleTimeString('id-ID')}, Day ${dayOfWeek}) is outside IDX trading hours (M-F 10:00-16:00 WIB). Use ?force=true to test anytime.`
      });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. AUTHENTICATION / AUTHORIZATION GUARD
  // ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const querySecret = searchParams.get('secret');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isValidCronSecret = process.env.CRON_SECRET && 
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET);

  // Allow execution if triggered by Vercel Cron, valid Bearer secret, valid query secret, or force=true in development
  if (!isVercelCron && !isValidCronSecret && !force && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
  }

  // ──────────────────────────────────────────────────────────────
  // 3. UNIVERSE & PRESETS SETUP
  // ──────────────────────────────────────────────────────────────
  const marketRaw = searchParams.get('market') || 'ID';
  const market: Market = marketRaw === 'US' ? 'US' : 'ID';
  const universeKey = searchParams.get('universe') || 'ALL';

  let symbols: string[] = [];
  if (market === 'ID') {
    symbols = ID_UNIVERSES[universeKey as keyof typeof ID_UNIVERSES] || ID_UNIVERSES.ALL;
  } else {
    symbols = US_UNIVERSES[universeKey as keyof typeof US_UNIVERSES] || US_UNIVERSES.SP100;
  }

  // Target presets for real-time alerts
  const presetsParam = searchParams.get('preset');
  const targetPresets: Preset[] = presetsParam
    ? (presetsParam.split(',').filter(Boolean) as Preset[])
    : ['VOL_SPIKE', 'STEALTH_ACCUM'];

  const batchSize = 15; // Scan 15 symbols concurrently per batch
  const coolDownMs = 150; // 150ms rest between batches

  let totalScanned = 0;
  let alertsSent = 0;
  const matches: Array<{ symbol: string; preset: Preset; alerted: boolean }> = [];

  // ──────────────────────────────────────────────────────────────
  // 4. BATCHED CONCURRENCY SCANNING LOOP
  // ──────────────────────────────────────────────────────────────
  const startTime = Date.now();
  for (let i = 0; i < symbols.length; i += batchSize) {
    if (Date.now() - startTime > 52000) {
      console.warn('[cron/alerts] Approaching 60s Vercel Hobby duration limit. Exiting loop cleanly.');
      break;
    }

    const batchSymbols = symbols.slice(i, i + batchSize);

    await Promise.allSettled(
      batchSymbols.map(async (symbol) => {
        for (const preset of targetPresets) {
          try {
            const result = await runScreenerForSymbol(symbol, market, preset);
            totalScanned++;

            if (result.isPass) {
              const alreadyAlerted = await isAlertedToday(symbol, preset);
              if (!alreadyAlerted) {
                // Trigger Telegram Push Notification
                const sent = await sendTelegramAlert({
                  symbol: result.symbol,
                  market: result.market,
                  preset,
                  price: result.taData?.price,
                  volumeRatio: result.taData?.volumeRatio,
                  priceChange10d: result.taData?.priceChange10d,
                  taScore: result.taScore,
                  smartMoneyScore: result.smartMoney?.accumulationScore
                });

                if (sent) {
                  alertsSent++;
                }

                // Mark as alerted in Vercel KV (even if sendTelegramAlert returned false due to missing bot token,
                // so we don't spam errors every 15 mins)
                await markAlertedToday(symbol, preset, {
                  timestamp: Date.now(),
                  price: result.taData?.price,
                  volumeRatio: result.taData?.volumeRatio
                });

                matches.push({ symbol: result.symbol, preset, alerted: sent });
              } else {
                matches.push({ symbol: result.symbol, preset, alerted: false });
              }
            }
          } catch (err) {
            // Silently skip individual symbol fetch errors to keep the batch moving
            console.error(`[cron/alerts] Error scanning ${symbol} (${preset}):`, err);
          }
        }
      })
    );

    // Rest briefly before next batch
    if (i + batchSize < symbols.length) {
      await sleep(coolDownMs);
    }
  }

  return NextResponse.json({
    status: 'success',
    market,
    universe: universeKey,
    totalSymbols: symbols.length,
    totalScanned,
    alertsSent,
    matches
  });
}
