import { describe, it, expect, beforeEach } from 'vitest';
import { useUserPreferencesStore } from './userPreferencesStore';

describe('userPreferencesStore', () => {
  beforeEach(() => {
    useUserPreferencesStore.setState({ analysisMode: 'guided' });
  });

  it('defaults to guided mode', () => {
    const state = useUserPreferencesStore.getState();
    expect(state.analysisMode).toBe('guided');
  });

  it('can set mode directly', () => {
    useUserPreferencesStore.getState().setAnalysisMode('advanced');
    expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
  });

  it('can toggle mode', () => {
    const { toggleAnalysisMode } = useUserPreferencesStore.getState();
    
    toggleAnalysisMode();
    expect(useUserPreferencesStore.getState().analysisMode).toBe('advanced');
    
    toggleAnalysisMode();
    expect(useUserPreferencesStore.getState().analysisMode).toBe('guided');
  });
});
