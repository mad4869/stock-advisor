import { NextRequest, NextResponse } from 'next/server';
import { Market } from '@/types';
import { computeCompositeScore } from '@/lib/scoreService';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const market = (searchParams.get('market') || 'US') as Market;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    const { dcfResult } = await computeCompositeScore(symbol, market);
    return NextResponse.json({ dcf: dcfResult });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to compute valuation' },
      { status: 500 }
    );
  }
}

