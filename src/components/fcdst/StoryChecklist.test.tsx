import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StoryChecklist } from './StoryChecklist';
import { useStoryAnalysisStore, computeStoryScore } from '@/lib/storyAnalysisStore';

describe('StoryChecklist & computeStoryScore', () => {
  beforeEach(() => {
    useStoryAnalysisStore.setState({ analyses: {} });
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders 3 checklist items', () => {
    render(<StoryChecklist symbol="AAPL" />);
    expect(screen.getByText(/1\. Megatrend \/ Tailwinds/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Economic Moat/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Clear Catalyst/i)).toBeInTheDocument();
  });

  it('allows checking boxes and entering justifications', () => {
    const onSave = vi.fn();
    render(<StoryChecklist symbol="AAPL" onSave={onSave} />);
    
    // Score should be 0/3 initially
    expect(screen.getByText('Score: 0/3')).toBeInTheDocument();
    
    // Check Megatrend
    const megatrendLabel = screen.getByText(/1\. Megatrend \/ Tailwinds/i);
    fireEvent.click(megatrendLabel);
    
    // Score still 0 because no justification
    expect(screen.getByText('Score: 0/3')).toBeInTheDocument();
    expect(screen.getByText(/Justification required/i)).toBeInTheDocument();
    
    // Type justification
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBe(3); // All 3 textareas are always visible
    expect(textareas[0]).not.toBeDisabled(); // Megatrend is enabled
    expect(textareas[1]).toBeDisabled(); // Moat is disabled
    fireEvent.change(textareas[0], { target: { value: 'AI boom' } });
    
    // Score should now be 1/3
    expect(screen.getByText('Score: 1/3')).toBeInTheDocument();
    
    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Story Analysis/i });
    fireEvent.click(saveBtn);
    
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('scoring logic: whitespace-only justification = 0 points', () => {
    render(<StoryChecklist symbol="AAPL" />);
    
    fireEvent.click(screen.getByText(/2\. Economic Moat/i));
    
    const textareas = screen.getAllByRole('textbox');
    expect(textareas[1]).not.toBeDisabled();
    fireEvent.change(textareas[1], { target: { value: '   \n  ' } });
    
    // Score still 0
    expect(screen.getByText('Score: 0/3')).toBeInTheDocument();
    expect(screen.getByText(/Justification required/i)).toBeInTheDocument();
  });

  it('persistence works correctly', () => {
    // Setup initial state manually
    useStoryAnalysisStore.setState({
      analyses: {
        'AAPL': {
          symbol: 'AAPL',
          megatrend: { checked: true, justification: 'Tech boom' },
          moat: { checked: false, justification: '' },
          catalyst: { checked: true, justification: 'New iPhone' },
          lastUpdated: Date.now(),
        }
      }
    });

    render(<StoryChecklist symbol="AAPL" />);
    
    expect(screen.getByText('Score: 2/3')).toBeInTheDocument();
    
    // There should be 3 textareas visible
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBe(3);
    expect(textareas[0]).toHaveValue('Tech boom');
    expect(textareas[0]).not.toBeDisabled();
    
    expect(textareas[1]).toHaveValue('');
    expect(textareas[1]).toBeDisabled();
    
    expect(textareas[2]).toHaveValue('New iPhone');
    expect(textareas[2]).not.toBeDisabled();
  });

  describe('computeStoryScore helper', () => {
    it('returns Pending if no analysis', () => {
      expect(computeStoryScore(undefined)).toBe('Pending');
    });

    it('computes correct score based on checked and justification', () => {
      expect(computeStoryScore({
        symbol: 'AAPL',
        megatrend: { checked: true, justification: 'Valid' },
        moat: { checked: true, justification: '  ' }, // whitespace only
        catalyst: { checked: false, justification: 'Valid' }, // not checked
        lastUpdated: 123,
      })).toBe(1);
    });
  });
});
