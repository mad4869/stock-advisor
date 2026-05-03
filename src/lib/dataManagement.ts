import { usePortfolioStore } from './portfolioStore';
import { useWatchlistStore } from './watchlistStore';
import { useBankingMetricsStore } from './bankingMetricsStore';
import { useStoryAnalysisStore } from './storyAnalysisStore';
import { useUserPreferencesStore } from './userPreferencesStore';

export function exportAllData(): string {
  const portfolio = usePortfolioStore.getState();
  const watchlist = useWatchlistStore.getState();
  const banking = useBankingMetricsStore.getState();
  const story = useStoryAnalysisStore.getState();
  const preferences = useUserPreferencesStore.getState();

  const exportData = {
    exportVersion: 1,
    exportDate: Date.now(),
    data: {
      portfolio: {
        snapshots: portfolio.snapshots,
        closedPositions: portfolio.closedPositions,
        lastSnapshotDate: portfolio.lastSnapshotDate,
      },
      watchlist: {
        items: watchlist.items,
      },
      banking: {
        metrics: banking.metrics,
      },
      story: {
        analyses: story.analyses,
      },
      preferences: {
        analysisMode: preferences.analysisMode,
      },
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export function downloadBackup() {
  const json = exportAllData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `stockadvisor-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllData(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) throw new Error('Invalid backup file');
    
    const { portfolio, watchlist, banking, story, preferences } = parsed.data;

    // We must use setState to safely merge/replace the state without destroying methods
    if (portfolio) {
      usePortfolioStore.setState({
        snapshots: portfolio.snapshots || [],
        closedPositions: portfolio.closedPositions || [],
        lastSnapshotDate: portfolio.lastSnapshotDate || null,
      });
    }

    if (watchlist) {
      useWatchlistStore.setState({
        items: watchlist.items || [],
      });
    }

    if (banking) {
      useBankingMetricsStore.setState({
        metrics: banking.metrics || {},
      });
    }

    if (story) {
      useStoryAnalysisStore.setState({
        analyses: story.analyses || {},
      });
    }

    if (preferences && preferences.analysisMode) {
      useUserPreferencesStore.setState({
        analysisMode: preferences.analysisMode,
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to import backup:', err);
    return false;
  }
}
