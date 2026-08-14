import { NextRequest, NextResponse } from 'next/server';
import { yf, getComprehensiveAnalysis2 } from '@/lib/yahooFinance2';
import { calculateTA } from '@/lib/technicalIndicators';
import { computeFundamentalScore } from '@/lib/fundamentalScorer';
import { detectBuySignal, FundamentalInput } from '@/lib/buySignalDetector';
import { sendBuySignalAlert } from '@/lib/telegramNotifier';
import { isAlertedToday, markAlertedToday } from '@/lib/alertStorage';
import { ID_UNIVERSES, US_UNIVERSES } from '@/lib/universes';
import { historyCache, CACHE_TTL } from '@/lib/cache';
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
  // 1. JAKARTA MARKET HOURS GUARD (Monday–Friday, 10:00–16:00 WIB)
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

  if (!isVercelCron && !isValidCronSecret && !force && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
  }

  // ──────────────────────────────────────────────────────────────
  // 3. UNIVERSE SETUP
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

  const batchSize = 10; // Slightly smaller batches since we're doing TA + fundamentals per symbol
  const coolDownMs = 200;

  let totalScanned = 0;
  let alertsSent = 0;
  const matches: Array<{ symbol: string; reasons: string[]; alerted: boolean }> = [];

  // ──────────────────────────────────────────────────────────────
  // 4. BATCHED BUY SIGNAL SCANNING LOOP
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
        try {
          totalScanned++;

          // Check deduplication first — skip if already alerted today
          const alreadyAlerted = await isAlertedToday(symbol);
          if (alreadyAlerted) return;

          // ── Fetch Price History ──
          const cleanSymbol = market === 'ID' && !symbol.endsWith('.JK')
            ? `${symbol}.JK`
            : symbol;

          const cacheKey = `history:${cleanSymbol}:6mo`;
          let history = historyCache.get<any[]>(cacheKey);
          if (!history) {
            try {
              const chartResult = await yf.chart(cleanSymbol, {
                period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                interval: '1d'
              });
              history = chartResult?.quotes ?? [];
              if (history && history.length > 0) {
                historyCache.set(cacheKey, history, CACHE_TTL.HISTORICAL);
              }
            } catch {
              return; // Skip symbol if we can't fetch history
            }
          }

          if (!history || history.length < 20) return;

          // ── Calculate TA ──
          const ta = calculateTA(history, market);
          if (!ta) return;

          // ── Quick Pre-Filter: skip obviously healthy/overbought stocks ──
          // Only scan stocks that have at least one potential buy signal indicator
          const hasAnySupportHint = (ta.bollingerB != null && ta.bollingerB < 0.15) ||
            (ta.distFromEMA50 != null && ta.distFromEMA50 >= -0.04 && ta.distFromEMA50 <= 0.02) ||
            (ta.distFromEMA200 != null && ta.distFromEMA200 >= -0.04 && ta.distFromEMA200 <= 0.02) ||
            (ta.distanceToS1 != null && ta.distanceToS1 <= 0.04);

          const hasAnyOversoldHint = (ta.rsi != null && ta.rsi < 38) ||
            ta.stochRecovery ||
            (ta.mfi != null && ta.mfi < 30) ||
            (ta.williamsR != null && ta.williamsR < -75) ||
            (ta.cci != null && ta.cci < -90) ||
            ta.macdCrossFromBelowZero ||
            ta.rsiDivergence;

          if (!hasAnySupportHint && !hasAnyOversoldHint) return;

          // ── Fetch Fundamentals (only for promising candidates) ──
          let fundamentals: FundamentalInput | null = null;
          try {
            const analysis = await getComprehensiveAnalysis2(
              cleanSymbol.replace('.JK', ''),
              market
            );
            const fundScore = computeFundamentalScore(analysis, market);

            fundamentals = {
              grade: fundScore.grade,
              total: fundScore.total,
              roe: analysis.fundamentals.roe,
              debtToEquity: analysis.fundamentals.debtToEquity,
              dividendYield: analysis.dividend.dividendYield,
              analystUpside: fundScore.analystUpside,
              analystConsensus: fundScore.analystConsensus,
              analystTargetPrice: analysis.analystRating.targetMeanPrice,
            };
          } catch {
            // Fundamentals unavailable — detector will use ROE fallback or skip
          }

          // ── Detect BUY Signal ──
          const signal = detectBuySignal(ta, market, fundamentals);
          if (!signal.isBuy) return;

          // ── Send Telegram Alert ──
          const sent = await sendBuySignalAlert({
            symbol: cleanSymbol,
            market,
            price: ta.close,
            signal,
          });

          if (sent) alertsSent++;

          // Mark as alerted regardless of send success (prevent spam on errors)
          await markAlertedToday(symbol, {
            timestamp: Date.now(),
            price: ta.close,
            reasons: signal.reasons.map(r => r.label),
          });

          matches.push({
            symbol: cleanSymbol,
            reasons: signal.reasons.map(r => r.label),
            alerted: sent,
          });

        } catch (err) {
          console.error(`[cron/alerts] Error scanning ${symbol}:`, err);
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
