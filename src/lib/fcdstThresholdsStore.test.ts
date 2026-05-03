import { describe, it, expect, beforeEach } from 'vitest';
import { useFCDSTThresholdsStore } from './fcdstThresholdsStore';
import { DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';

describe('fcdstThresholdsStore', () => {
  beforeEach(() => {
    useFCDSTThresholdsStore.setState({ thresholds: { ...DEFAULT_FCDST_THRESHOLDS } });
  });

  it('initialises with DEFAULT_FCDST_THRESHOLDS', () => {
    const { thresholds } = useFCDSTThresholdsStore.getState();
    expect(thresholds).toEqual(DEFAULT_FCDST_THRESHOLDS);
  });

  it('setThresholds merges a partial update', () => {
    useFCDSTThresholdsStore.getState().setThresholds({ roeMin: 20, perMax: 12 });
    const { thresholds } = useFCDSTThresholdsStore.getState();
    expect(thresholds.roeMin).toBe(20);
    expect(thresholds.perMax).toBe(12);
    // Other values unchanged
    expect(thresholds.pbvMax).toBe(DEFAULT_FCDST_THRESHOLDS.pbvMax);
  });

  it('resetToDefaults restores all values', () => {
    useFCDSTThresholdsStore.getState().setThresholds({ roeMin: 99, perMax: 99 });
    useFCDSTThresholdsStore.getState().resetToDefaults();
    const { thresholds } = useFCDSTThresholdsStore.getState();
    expect(thresholds).toEqual(DEFAULT_FCDST_THRESHOLDS);
  });

  it('setThresholds does not mutate the DEFAULT object', () => {
    useFCDSTThresholdsStore.getState().setThresholds({ roeMin: 999 });
    expect(DEFAULT_FCDST_THRESHOLDS.roeMin).toBe(15); // unchanged
  });
});
