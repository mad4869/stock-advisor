import { describe, it, expect, beforeEach } from 'vitest';
import { useUserPreferencesStore } from '@/lib/userPreferencesStore';

describe('userPreferencesStore', () => {
  beforeEach(() => {
    useUserPreferencesStore.setState({ analysisMode: 'guided' });
  });

  describe('default state', () => {
    it('defaults to guided mode', () => {
      const state = useUserPreferencesStore.getState();
      expect(state.analysisMode).toBe('guided');
    });
  });

  describe('setAnalysisMode', () => {
    it('can set mode to advanced', () => {
      useUserPreferencesStore.getState().setAnalysisMode('advanced');
      expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
    });

    it('can set mode back to guided', () => {
      useUserPreferencesStore.getState().setAnalysisMode('advanced');
      useUserPreferencesStore.getState().setAnalysisMode('guided');
      expect(useUserPreferencesStore.getState().analysisMode).toBe('guided');
    });
  });

  describe('toggleAnalysisMode', () => {
    it('toggles from guided to advanced', () => {
      const { toggleAnalysisMode } = useUserPreferencesStore.getState();
      
      toggleAnalysisMode();
      expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
    });

    it('toggles from advanced to guided', () => {
      useUserPreferencesStore.getState().setAnalysisMode('advanced');
      const { toggleAnalysisMode } = useUserPreferencesStore.getState();
      
      toggleAnalysisMode();
      expect(useUserPreferencesStore.getState().analysisMode).toBe('guided');
    });

    it('can toggle multiple times', () => {
      const { toggleAnalysisMode } = useUserPreferencesStore.getState();
      
      toggleAnalysisMode();
      expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
      
      toggleAnalysisMode();
      expect(useUserPreferencesStore.getState().analysisMode).toBe('guided');
      
      toggleAnalysisMode();
      expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
    });
  });
});
