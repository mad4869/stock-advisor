import { NextRequest, NextResponse } from 'next/server';
import { getComprehensiveAnalysis2, getPeerAnalysis2 } from '@/lib/yahooFinance2';
import { detectRedFlags } from '@/lib/redFlags';
import { Market } from '@/types';
import { PeerData } from '@/types/analysis';

// IDX sector map (duplicated here to avoid circular imports with stockData)
const IDX_SECTOR_MAP: Record<string, string> = {
  BBCA: 'Financial', BBRI: 'Financial', BMRI: 'Financial', BBNI: 'Financial',
  BRIS: 'Financial', MEGA: 'Financial', NISP: 'Financial', BNGA: 'Financial',
  BDMN: 'Financial', BJTM: 'Financial', BJBR: 'Financial',
  ADRO: 'Energy', ITMG: 'Energy', PTBA: 'Energy', ANTM: 'Energy',
  INCO: 'Energy', MEDC: 'Energy', PGAS: 'Energy', HRUM: 'Energy', UNTR: 'Energy',
  TLKM: 'Technology', EXCL: 'Technology', ISAT: 'Technology', TOWR: 'Technology',
  ASII: 'Consumer Cyclical', UNVR: 'Consumer Defensive', HMSP: 'Consumer Defensive',
  ICBP: 'Consumer Defensive', INDF: 'Consumer Defensive', KLBF: 'Healthcare',
  GGRM: 'Consumer Defensive', MYOR: 'Consumer Defensive', CPIN: 'Consumer Defensive',
  SIDO: 'Consumer Defensive', AMRT: 'Consumer Defensive', JPFA: 'Consumer Defensive',
  BSDE: 'Real Estate', CTRA: 'Real Estate', SMRA: 'Real Estate', PWON: 'Real Estate',
  WIKA: 'Industrials', PTPP: 'Industrials', JSMR: 'Industrials', SMGR: 'Industrials',
  HEAL: 'Healthcare', MIKA: 'Healthcare', DVLA: 'Healthcare',
  AALI: 'Consumer Defensive', LSIP: 'Consumer Defensive',
  SCMA: 'Communication Services', MNCN: 'Communication Services',
};

const US_POPULAR = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', market: 'US', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Healthcare' },
];

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase().trim();
  const market = (searchParams.get('market') || 'US') as Market;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

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
        US_POPULAR,
        4
      );
    } catch (peerErr: any) {
      console.warn(`[Analysis API] Peer fetch failed: ${peerErr.message}`);
    }

    return NextResponse.json({ analysis, redFlags, peers });
  } catch (error: any) {
    console.error(`[Analysis API] ${symbol}: ${error.message}`);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
