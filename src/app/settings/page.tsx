'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUserPreferencesStore } from '@/lib/userPreferencesStore';
import { useFCDSTThresholdsStore } from '@/lib/fcdstThresholdsStore';
import { FCDSTThresholds, DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';
import {
  Settings,
  Save,
  Upload,
  ToggleLeft,
  ToggleRight,
  Database,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Landmark,
  CheckCircle,
} from 'lucide-react';
import { downloadBackup, importAllData } from '@/lib/dataManagement';

// ─── Types ───────────────────────────────────────────────────────────────────
type FieldDraft = Record<keyof FCDSTThresholds, string>;
type ValidationErrors = Partial<Record<keyof FCDSTThresholds, string>>;

function toFieldDraft(t: FCDSTThresholds): FieldDraft {
  return Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, String(v)])
  ) as FieldDraft;
}

function parseAndValidate(draft: FieldDraft): {
  parsed: Partial<FCDSTThresholds>;
  errors: ValidationErrors;
} {
  const parsed: Partial<FCDSTThresholds> = {};
  const errors: ValidationErrors = {};

  const growthMarginFields: (keyof FCDSTThresholds)[] = [
    'revenueGrowthMin',
    'netIncomeGrowthMin',
    'roeMin',
    'netProfitMarginMin',
    'grossProfitMarginMin',
    'nplMax',
    'carMin',
  ];

  for (const key of Object.keys(draft) as (keyof FCDSTThresholds)[]) {
    const raw = draft[key].trim().replace(',', '.');
    const num = parseFloat(raw);

    if (raw === '' || isNaN(num)) {
      errors[key] = 'Must be a number';
      continue;
    }
    if (num <= 0) {
      errors[key] = 'Must be > 0';
      continue;
    }
    if (growthMarginFields.includes(key) && num > 100) {
      errors[key] = 'Must be ≤ 100';
      continue;
    }
    parsed[key] = num;
  }

  return { parsed, errors };
}

// ─── Threshold Input Row ──────────────────────────────────────────────────────
interface ThresholdRowProps {
  id: string;
  label: string;
  suffix?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}

function ThresholdRow({ id, label, suffix, value, error, onChange }: ThresholdRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-dark-700 last:border-0">
      <label htmlFor={id} className="text-sm text-gray-300 min-w-0 flex-1">
        {label}
      </label>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col items-end">
          <div
            className={`flex items-center gap-1 bg-dark-900 border rounded-lg overflow-hidden ${
              error ? 'border-red-500' : 'border-dark-600 focus-within:border-blue-500'
            } transition-colors`}
          >
            <input
              id={id}
              type="number"
              step="any"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-20 bg-transparent text-right text-white text-sm px-2 py-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label={label}
            />
            {suffix && (
              <span className="text-gray-500 text-xs pr-2">{suffix}</span>
            )}
          </div>
          {error && (
            <span className="text-red-400 text-xs mt-0.5">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
interface ThresholdSectionProps {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ThresholdSection({
  icon,
  title,
  badge,
  badgeColor,
  children,
  defaultOpen = true,
}: ThresholdSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-dark-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dark-700 hover:bg-dark-600 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-gray-100 text-sm">{title}</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${badgeColor}`}
          >
            {badge}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-4 py-2">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const { analysisMode, toggleAnalysisMode } = useUserPreferencesStore();
  const { thresholds, setThresholds, resetToDefaults } = useFCDSTThresholdsStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Draft state for the form (all strings to allow free typing)
  const [draft, setDraft] = useState<FieldDraft>(() => toFieldDraft(DEFAULT_FCDST_THRESHOLDS));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saved, setSaved] = useState(false);

  // Sync draft when store hydrates (after mount)
  useEffect(() => {
    setMounted(true);
    setDraft(toFieldDraft(thresholds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = useCallback((key: keyof FCDSTThresholds, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    // Inline validation on change
    const raw = value.trim().replace(',', '.');
    const num = parseFloat(raw);
    const growthMarginFields: (keyof FCDSTThresholds)[] = [
      'revenueGrowthMin', 'netIncomeGrowthMin', 'roeMin',
      'netProfitMarginMin', 'grossProfitMarginMin', 'nplMax', 'carMin',
    ];
    setErrors((prev) => {
      const next = { ...prev };
      if (raw === '' || isNaN(num)) {
        next[key] = 'Must be a number';
      } else if (num <= 0) {
        next[key] = 'Must be > 0';
      } else if (growthMarginFields.includes(key) && num > 100) {
        next[key] = 'Must be ≤ 100';
      } else {
        delete next[key];
      }
      return next;
    });
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = () => {
    const { parsed, errors: errs } = parseAndValidate(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setThresholds(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetToDefaults();
    setDraft(toFieldDraft(DEFAULT_FCDST_THRESHOLDS));
    setErrors({});
    setSaved(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const success = importAllData(result);
        if (success) {
          alert('Backup imported successfully. The page will reload to apply changes.');
          window.location.reload();
        } else {
          alert('Failed to import backup. The file may be invalid or corrupted.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!mounted) {
    return <div className="p-8 text-center text-gray-400">Loading Settings...</div>;
  }

  const f = (key: keyof FCDSTThresholds) => ({
    id: `threshold-${key}`,
    value: draft[key],
    error: errors[key],
    onChange: (v: string) => updateField(key, v),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8 border-b border-dark-600 pb-4">
        <Settings className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your FCDS-T preferences and application settings.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Analysis Preferences */}
        <section className="bg-dark-800 rounded-xl p-6 border border-dark-600">
          <h2 className="text-xl font-bold text-white mb-4 border-b border-dark-700 pb-2">Analysis Preferences</h2>
          <div className="flex items-start justify-between">
            <div className="max-w-xl">
              <h3 className="text-lg font-medium text-gray-200">Analysis Mode</h3>
              <p className="text-sm text-gray-400 mt-1">
                Choose how you want to interact with the FCDS-T methodology.
                <strong> Guided</strong> takes you step-by-step, while <strong>Advanced</strong> shows all sections simultaneously for power users.
              </p>
            </div>
            <button
              onClick={toggleAnalysisMode}
              className="flex items-center gap-3 bg-dark-900 border border-dark-600 rounded-lg p-2 px-4 hover:border-dark-500 transition-colors shrink-0"
            >
              <span className={`text-sm font-bold ${analysisMode === 'guided' ? 'text-blue-400' : 'text-gray-500'}`}>Guided</span>
              {analysisMode === 'guided' ? (
                <ToggleLeft className="w-8 h-8 text-blue-500" />
              ) : (
                <ToggleRight className="w-8 h-8 text-blue-500" />
              )}
              <span className={`text-sm font-bold ${analysisMode === 'advanced' ? 'text-blue-400' : 'text-gray-500'}`}>Advanced</span>
            </button>
          </div>
        </section>

        {/* Section 2: FCDS-T Thresholds */}
        <section className="bg-dark-800 rounded-xl p-6 border border-dark-600">
          <div className="flex justify-between items-center border-b border-dark-700 pb-2 mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">FCDS-T Threshold Configuration</h2>
              <p className="text-sm text-gray-400 mt-1">
                Customize passing criteria. Defaults follow Benjamin Graham / Peter Lynch principles.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* [F] Fundamental */}
            <ThresholdSection
              icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              title="Fundamental Thresholds"
              badge="F"
              badgeColor="bg-green-500/20 text-green-400"
            >
              <ThresholdRow label="Revenue Growth Min" suffix="%" {...f('revenueGrowthMin')} />
              <ThresholdRow label="Net Income Growth Min" suffix="%" {...f('netIncomeGrowthMin')} />
              <ThresholdRow label="ROE Min" suffix="%" {...f('roeMin')} />
              <ThresholdRow label="Net Profit Margin Min" suffix="%" {...f('netProfitMarginMin')} />
              <ThresholdRow label="Gross Profit Margin Min" suffix="%" {...f('grossProfitMarginMin')} />
            </ThresholdSection>

            {/* [C] Valuation */}
            <ThresholdSection
              icon={<DollarSign className="w-4 h-4 text-yellow-400" />}
              title="Valuation Thresholds"
              badge="C"
              badgeColor="bg-yellow-500/20 text-yellow-400"
            >
              <ThresholdRow label="PER Max" {...f('perMax')} />
              <ThresholdRow label="PBV Max" {...f('pbvMax')} />
              <ThresholdRow label="PEG Max" {...f('pegMax')} />
              <ThresholdRow label="EV/EBITDA Max" {...f('evEbitdaMax')} />
            </ThresholdSection>

            {/* [D] Debt General */}
            <ThresholdSection
              icon={<ShieldCheck className="w-4 h-4 text-blue-400" />}
              title="Debt Thresholds (General)"
              badge="D"
              badgeColor="bg-blue-500/20 text-blue-400"
            >
              <ThresholdRow label="DER Max (General)" {...f('derMaxGeneral')} />
              <ThresholdRow label="DER Max (Non-Financial)" {...f('derMaxNonFinancial')} />
              <ThresholdRow label="Current Ratio Min" {...f('currentRatioMin')} />
              <ThresholdRow label="Interest Coverage Min" {...f('interestCoverageMin')} />
            </ThresholdSection>

            {/* [D] Debt Banking */}
            <ThresholdSection
              icon={<Landmark className="w-4 h-4 text-purple-400" />}
              title="Debt Thresholds (Banking)"
              badge="D·Bank"
              badgeColor="bg-purple-500/20 text-purple-400"
            >
              <ThresholdRow label="NPL Max" suffix="%" {...f('nplMax')} />
              <ThresholdRow label="CAR Min" suffix="%" {...f('carMin')} />
            </ThresholdSection>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-dark-700">
            <button
              id="threshold-reset-btn"
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              id="threshold-save-btn"
              type="button"
              onClick={handleSave}
              disabled={hasErrors}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? 'bg-green-600 text-white'
                  : hasErrors
                  ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Thresholds
                </>
              )}
            </button>
          </div>
        </section>

        {/* Section 3: Data Management */}
        <section className="bg-dark-800 rounded-xl p-6 border border-dark-600">
          <div className="flex justify-between items-center border-b border-dark-700 pb-2 mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              Data Management
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Export or backup your manual analysis data, journals, and watchlist.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImport}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-dark-700 hover:bg-dark-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Backup
              </button>
              <button
                onClick={downloadBackup}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Export Backup
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
