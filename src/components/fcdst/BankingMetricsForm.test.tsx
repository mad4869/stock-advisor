import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BankingMetricsForm } from './BankingMetricsForm';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';

describe('BankingMetricsForm', () => {
  beforeEach(() => {
    // Clear the store before each test
    useBankingMetricsStore.setState({ metrics: {} });
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders empty form correctly when no existing metrics', () => {
    render(<BankingMetricsForm symbol="BBCA.JK" />);
    expect(screen.getByText('Banking Metrics (Manual Input)')).toBeInTheDocument();
    
    // Inputs should be empty
    const nplInput = screen.getByLabelText(/NPL Ratio/i);
    const carInput = screen.getByLabelText(/CAR/i);
    
    expect(nplInput).toHaveValue(null);
    expect(carInput).toHaveValue(null);
  });

  it('validates bounds for NPL and CAR', () => {
    render(<BankingMetricsForm symbol="BBCA.JK" />);
    
    const nplInput = screen.getByLabelText(/NPL Ratio/i);
    const carInput = screen.getByLabelText(/CAR/i);
    const saveBtn = screen.getByRole('button', { name: /Save Metrics/i });
    
    // Test NPL > 100
    fireEvent.change(nplInput, { target: { value: '105' } });
    fireEvent.change(carInput, { target: { value: '20' } });
    fireEvent.click(saveBtn);
    expect(screen.getByText('NPL must be a number between 0 and 100')).toBeInTheDocument();
    
    // Test CAR < 0
    fireEvent.change(nplInput, { target: { value: '2' } });
    fireEvent.change(carInput, { target: { value: '-5' } });
    fireEvent.click(saveBtn);
    expect(screen.getByText('CAR must be a number between 0 and 100')).toBeInTheDocument();
  });

  it('saves data and shows it on reload', () => {
    const onSave = vi.fn();
    const { rerender } = render(<BankingMetricsForm symbol="BBCA.JK" onSave={onSave} />);
    
    const nplInput = screen.getByLabelText(/NPL Ratio/i);
    const carInput = screen.getByLabelText(/CAR/i);
    const noteInput = screen.getByLabelText(/Source Note/i);
    const saveBtn = screen.getByRole('button', { name: /Save Metrics/i });
    
    fireEvent.change(nplInput, { target: { value: '1.5' } });
    fireEvent.change(carInput, { target: { value: '22.5' } });
    fireEvent.change(noteInput, { target: { value: 'Q3 Report' } });
    fireEvent.click(saveBtn);
    
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    
    // Unmount and remount (reload)
    cleanup();
    render(<BankingMetricsForm symbol="BBCA.JK" />);
    
    expect(screen.getByLabelText(/NPL Ratio/i)).toHaveValue(1.5);
    expect(screen.getByLabelText(/CAR/i)).toHaveValue(22.5);
    expect(screen.getByLabelText(/Source Note/i)).toHaveValue('Q3 Report');
    expect(screen.getByText('Data is up to date')).toBeInTheDocument();
    expect(screen.getByText(/Last saved:/i)).toBeInTheDocument();
  });

  it('shows stale warning when data is >90 days old', () => {
    // Set system time
    const now = Date.now();
    
    // Insert stale data (100 days old)
    useBankingMetricsStore.setState({
      metrics: {
        'BBCA.JK': {
          symbol: 'BBCA.JK',
          npl: 2.0,
          car: 20.0,
          sourceNote: '',
          lastUpdated: now - (100 * 24 * 60 * 60 * 1000), 
        }
      }
    });

    render(<BankingMetricsForm symbol="BBCA.JK" />);
    expect(screen.getByText('Warning: Data is >90 days old')).toBeInTheDocument();
    expect(screen.getByText(/Last saved:/i)).toBeInTheDocument();
  });

  it('handles comma and dot as decimal separators', () => {
    const saveMetricsMock = vi.fn();
    useBankingMetricsStore.setState({
      saveMetrics: saveMetricsMock,
      metrics: {},
    });

    render(<BankingMetricsForm symbol="TEST.JK" />);
    
    const nplInput = screen.getByLabelText(/NPL Ratio/i);
    const carInput = screen.getByLabelText(/CAR/i);
    const saveBtn = screen.getByRole('button', { name: /Save Metrics/i });

    // Test with dot
    fireEvent.change(nplInput, { target: { value: '2.5' } });
    fireEvent.change(carInput, { target: { value: '18.5' } });
    fireEvent.click(saveBtn);
    
    expect(saveMetricsMock).toHaveBeenCalledWith('TEST.JK', {
      npl: 2.5,
      car: 18.5,
      sourceNote: ''
    });

    // Test with comma
    fireEvent.change(nplInput, { target: { value: '2,5' } });
    fireEvent.change(carInput, { target: { value: '18,5' } });
    fireEvent.click(saveBtn);
    
    expect(saveMetricsMock).toHaveBeenCalledWith('TEST.JK', {
      npl: 2.5,
      car: 18.5,
      sourceNote: ''
    });

    // Test with invalid (out of bounds)
    fireEvent.change(nplInput, { target: { value: '-1' } });
    fireEvent.change(carInput, { target: { value: '20' } });
    fireEvent.click(saveBtn);
    expect(screen.getByText(/NPL must be a number/i)).toBeInTheDocument();
  });
});
