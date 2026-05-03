import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SettingsPage from '@/app/settings/page';
import { useFCDSTThresholdsStore } from '@/lib/fcdstThresholdsStore';
import { DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';

// Mock next/navigation if used by child components
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SettingsPage — FCDS-T Threshold Form', () => {
  beforeEach(() => {
    cleanup();
    useFCDSTThresholdsStore.setState({ thresholds: { ...DEFAULT_FCDST_THRESHOLDS } });
  });

  it('renders all fundamental threshold fields with current values', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Revenue Growth Min')).toHaveValue(15);
    expect(screen.getByLabelText('Net Income Growth Min')).toHaveValue(15);
    expect(screen.getByLabelText('ROE Min')).toHaveValue(15);
    expect(screen.getByLabelText('Net Profit Margin Min')).toHaveValue(10);
    expect(screen.getByLabelText('Gross Profit Margin Min')).toHaveValue(20);
  });

  it('renders valuation threshold fields', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('PER Max')).toHaveValue(15);
    expect(screen.getByLabelText('PBV Max')).toHaveValue(2);
    expect(screen.getByLabelText('PEG Max')).toHaveValue(1);
    expect(screen.getByLabelText('EV/EBITDA Max')).toHaveValue(10);
  });

  it('renders banking threshold fields', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('NPL Max')).toHaveValue(3);
    expect(screen.getByLabelText('CAR Min')).toHaveValue(12);
  });

  it('shows inline validation error for negative number', async () => {
    render(<SettingsPage />);
    const roeInput = screen.getByLabelText('ROE Min');
    await act(async () => {
      fireEvent.change(roeInput, { target: { value: '-5' } });
    });
    expect(screen.getByText('Must be > 0')).toBeInTheDocument();
  });

  it('shows inline validation error for non-numeric input', async () => {
    render(<SettingsPage />);
    const perInput = screen.getByLabelText('PER Max');
    await act(async () => {
      fireEvent.change(perInput, { target: { value: 'abc' } });
    });
    expect(screen.getByText('Must be a number')).toBeInTheDocument();
  });

  it('disables Save button when validation errors exist', async () => {
    render(<SettingsPage />);
    const roeInput = screen.getByLabelText('ROE Min');
    await act(async () => {
      fireEvent.change(roeInput, { target: { value: '-1' } });
    });
    const saveBtn = screen.getByRole('button', { name: /Save Thresholds/i });
    expect(saveBtn).toBeDisabled();
  });

  it('Save updates the store with new valid values', async () => {
    render(<SettingsPage />);
    const roeInput = screen.getByLabelText('ROE Min');
    await act(async () => {
      fireEvent.change(roeInput, { target: { value: '25' } });
    });
    const saveBtn = screen.getByRole('button', { name: /Save Thresholds/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(useFCDSTThresholdsStore.getState().thresholds.roeMin).toBe(25);
  });

  it('Reset to Defaults restores all values', async () => {
    // First change a value
    useFCDSTThresholdsStore.getState().setThresholds({ roeMin: 99 });
    render(<SettingsPage />);
    const resetBtn = screen.getByRole('button', { name: /Reset to Defaults/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    expect(useFCDSTThresholdsStore.getState().thresholds.roeMin).toBe(15);
  });
});
