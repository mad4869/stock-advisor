import { NextRequest, NextResponse } from 'next/server';
import { getStockFundamentals2 } from '@/lib/yahooFinance2';
import { calculateFCDSTScore, computeTotalFCDSTScore } from '@/lib/fcdstEngine';
import { isBankingSector } from '@/lib/sectorUtils';
import { DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';

function computeStoryScoreFromBody(storyAnalysis: any): number | 'Pending' {
  if (!storyAnalysis) return 'Pending';

  let score = 0;
  if (storyAnalysis.megatrend?.checked && storyAnalysis.megatrend?.justification?.trim()) score++;
  if (storyAnalysis.moat?.checked && storyAnalysis.moat?.justification?.trim()) score++;
  if (storyAnalysis.catalyst?.checked && storyAnalysis.catalyst?.justification?.trim()) score++;

  return score;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbol = String(body.symbol || '').trim();
    const market = (body.market || 'US') as Market;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const fundamentalData = await getStockFundamentals2(symbol, market);
    const isBanking = isBankingSector(fundamentalData.sector || null);
    const bankingMetrics = body.bankingMetrics || null;
    const rawScore = calculateFCDSTScore(
      fundamentalData,
      bankingMetrics?.npl ?? null,
      bankingMetrics?.car ?? null,
      DEFAULT_FCDST_THRESHOLDS,
      isBanking
    );
    const sScore = computeStoryScoreFromBody(body.storyAnalysis);
    const total = computeTotalFCDSTScore(rawScore.fScore, rawScore.cScore, rawScore.dScore, sScore);

    return NextResponse.json({
      totalScore: total.totalScore,
      grade: total.grade,
      fScore: rawScore.fScore,
      cScore: rawScore.cScore,
      dScore: rawScore.dScore,
      sScore,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to calculate FCDS-T score' },
      { status: 500 }
    );
  }
}
