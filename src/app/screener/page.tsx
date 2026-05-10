import StockScreener from '@/components/StockScreener';

export default function ScreenerPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Stock Screener
        </h1>
        <p className="text-sm text-gray-400">
          The screener module is currently being updated.
        </p>
      </div>

      <StockScreener />
    </div>
  );
}
