import { NextRequest, NextResponse } from 'next/server';
import { getComprehensiveAnalysis2, getPeerAnalysis2 } from '@/lib/yahooFinance2';
import { detectRedFlags } from '@/lib/redFlags';
import { Market } from '@/types';
import { PeerData } from '@/types/analysis';
import { IDX_SECTOR_MAP, POPULAR_STOCKS } from '@/lib/constants';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase().trim();
  const marketRaw = searchParams.get('market') || 'US';

  // Input validation
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }
  if (!symbol.match(/^[A-Z0-9.]{1,10}$/)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
  }
  const market: Market = marketRaw === 'ID' ? 'ID' : 'US';

  try {
    // Fetch comprehensive analysis using yahoo-finance2 (handles auth)
    const analysis = await getComprehensiveAnalysis2(symbol, market);

    // Detect red flags
    const redFlags = detectRedFlags(analysis);

    // Fetch peers (best-effort, don't fail if this errors)
    let peers: PeerData[] = [];
    try {
      peers = await getPeerAnalysis2(
        analysis.profile.sector,
        market,
        symbol,
        IDX_SECTOR_MAP,
        POPULAR_STOCKS,
        4
      );
    } catch (peerErr: any) {
      console.warn(`[Analysis API] Peer fetch failed: ${peerErr.message}`);
    }

    return NextResponse.json({ analysis, redFlags, peers });
  } catch (error: any) {
    console.error(`[Analysis API] ${symbol}: ${error.message}`);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
