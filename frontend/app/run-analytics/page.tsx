'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getRunAnalyticsSettings,
  saveRunAnalyticsSettings,
  getRunAnalyticsWorkflowFilter,
  saveRunAnalyticsWorkflowFilter,
  getRunAnalyticsResults,
} from '../../lib/api';
import { RunAnalyticsSettings, WorkflowFilterConfig, WorkflowRunSummary } from '../../lib/types';

type SortKey = keyof WorkflowRunSummary;

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${Math.round(seconds % 60)}s`;
}

function isoToDatetimeLocal(iso: string): string {
  // "2025-01-01T00:00:00.000Z" → "2025-01-01T00:00"
  return iso.slice(0, 16);
}

function datetimeLocalToIso(local: string): string {
  // "2025-01-01T00:00" → "2025-01-01T00:00:00.000Z"
  return new Date(local).toISOString();
}

function exportCsv(summaries: WorkflowRunSummary[]) {
  const header = [
    'Workflow Title',
    'Total Runs',
    'Completed',
    'Unsuccessful',
    'Avg Run Time (s)',
    'Max Run Time (s)',
    'Min Run Time (s)',
  ].join(',');

  const rows = summaries.map((s) =>
    [
      `"${s.workflow_title.replace(/"/g, '""')}"`,
      s.total_count,
      s.completed_count,
      s.unsuccessful_count,
      s.avg_run_time_seconds ?? '',
      s.max_run_time_seconds ?? '',
      s.min_run_time_seconds ?? '',
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `run-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RunAnalyticsPage() {
  const [summaries, setSummaries] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RunAnalyticsSettings | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilterConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('total_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Settings panel local state
  const [cutoffLocal, setCutoffLocal] = useState('');
  const [filterJson, setFilterJson] = useState('');
  const [filterJsonError, setFilterJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [s, f] = await Promise.all([
          getRunAnalyticsSettings(),
          getRunAnalyticsWorkflowFilter(),
        ]);
        setSettings(s);
        setWorkflowFilter(f);
        setCutoffLocal(isoToDatetimeLocal(s.cutoff_timestamp));
        setFilterJson(JSON.stringify(f, null, 2));
      } catch (err: any) {
        setError(err.message);
      }
    }
    loadInitial();
  }, []);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const results = await getRunAnalyticsResults();
      setSummaries(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setFilterJsonError(null);
    setSaveError(null);

    let parsedFilter: WorkflowFilterConfig;
    try {
      parsedFilter = JSON.parse(filterJson);
    } catch {
      setFilterJsonError('Invalid JSON — please fix before saving.');
      return;
    }

    setSaving(true);
    try {
      const newSettings: RunAnalyticsSettings = {
        cutoff_timestamp: datetimeLocalToIso(cutoffLocal),
      };
      await Promise.all([
        saveRunAnalyticsSettings(newSettings),
        saveRunAnalyticsWorkflowFilter(parsedFilter),
      ]);
      setSettings(newSettings);
      setWorkflowFilter(parsedFilter);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [summaries, sortKey, sortDir]);

  function arrow(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const columns: { label: string; key: SortKey; format?: (v: any) => string }[] = [
    { label: 'Workflow Title', key: 'workflow_title' },
    { label: 'Total Runs', key: 'total_count' },
    { label: 'Completed', key: 'completed_count' },
    { label: 'Unsuccessful', key: 'unsuccessful_count' },
    { label: 'Avg Run Time', key: 'avg_run_time_seconds', format: formatDuration },
    { label: 'Max Run Time', key: 'max_run_time_seconds', format: formatDuration },
    { label: 'Min Run Time', key: 'min_run_time_seconds', format: formatDuration },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Run Analytics</h1>
        <button
          onClick={handleRun}
          disabled={loading}
          style={{
            padding: '8px 20px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Settings panel */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '12px 16px',
            background: '#f9fafb',
            border: 'none',
            borderRadius: settingsOpen ? '8px 8px 0 0' : '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {settingsOpen ? '▾' : '▸'} Settings
        </button>

        {settingsOpen && (
          <div style={{ padding: '16px', borderTop: '1px solid #d1d5db' }}>
            {/* Cut-off date */}
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
              Cut-off date
            </label>
            <input
              type="datetime-local"
              value={cutoffLocal}
              onChange={(e) => setCutoffLocal(e.target.value)}
              style={{ marginBottom: '16px', fontSize: '13px' }}
            />

            {/* Workflow filter */}
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
              Workflow filter
            </label>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontFamily: 'monospace' }}>
              {'// Supported fields: status (array), folder_id (array), search_key (string)'}<br />
              {'// Example: { "status": ["published"], "folder_id": ["fld_abc123"] }'}
            </div>
            <textarea
              value={filterJson}
              onChange={(e) => {
                setFilterJson(e.target.value);
                setFilterJsonError(null);
              }}
              rows={6}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '8px',
                border: filterJsonError ? '1px solid #f87171' : '1px solid #d1d5db',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
            {filterJsonError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                {filterJsonError}
              </div>
            )}

            {saveError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
                Save failed: {saveError}
              </div>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              style={{
                marginTop: '12px',
                padding: '7px 18px',
                fontSize: '13px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Export buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => exportCsv(sorted)}
          disabled={summaries.length === 0}
          style={{
            padding: '7px 16px',
            fontSize: '13px',
            cursor: summaries.length === 0 ? 'not-allowed' : 'pointer',
            opacity: summaries.length === 0 ? 0.5 : 1,
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Results table */}
      {sorted.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderBottom: '2px solid #d1d5db',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}{arrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.workflow_title}
                  style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}
                >
                  {columns.map((col) => {
                    const raw = s[col.key];
                    const display = col.format ? col.format(raw) : String(raw ?? '');
                    return (
                      <td
                        key={col.key}
                        style={{ padding: '7px 12px', borderBottom: '1px solid #e5e7eb' }}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>
            No results. Press <strong>Run</strong> to fetch data.
          </div>
        )
      )}
    </div>
  );
}
