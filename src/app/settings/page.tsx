'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Upload, Database } from 'lucide-react';
import { downloadBackup, importAllData } from '@/lib/dataManagement';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8 border-b border-dark-600 pb-4">
        <Settings className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Manage application settings and data.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Data Management */}
        <section className="bg-dark-800 rounded-xl p-6 border border-dark-600">
          <div className="flex justify-between items-center border-b border-dark-700 pb-2 mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              Data Management
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Export or backup your portfolio, journals, and watchlist.
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
