'use client';

import { useState, useEffect, useRef } from 'react';
import { WorkflowRun, WorkflowRunsResponse } from '../../lib/types';
import { fetchWorkflowRuns, fetchWorkflowRun } from '../../lib/api';
import { resolveDotPath } from '../../lib/dotPath';

// Status badge colour map
const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  completed:  { background: '#d1fae5', color: '#065f46' },
  failed:     { background: '#fee2e2', color: '#991b1b' },
  terminated: { background: '#fef3c7', color: '#92400e' },
  timed_out:  { background: '#fef3c7', color: '#92400e' },
  canceled:   { background: '#f3f4f6', color: '#374151' },
  running:    { background: '#dbeafe', color: '#1e40af' },
  queued:     { background: '#f3f4f6', color: '#374151' },
  created:    { background: '#f3f4f6', color: '#374151' },
};

const DEFAULT_BADGE = { background: '#f3f4f6', color: '#374151' };

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status.toLowerCase()] ?? DEFAULT_BADGE;
  return (
    <span
      style={{
        ...style,
        borderRadius: '9999px',
        padding: '2px 10px',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function truncateRunId(id: string): string {
  return id.length > 12 ? '...' + id.slice(-12) : id;
}

// Autocomplete: get suggested keys from an object given a partial dot-path
function getSuggestions(run: Record<string, unknown>, input: string): string[] {
  try {
    const dotIdx = input.lastIndexOf('.');
    if (dotIdx === -1) {
      // Top-level keys
      const prefix = input.toLowerCase();
      return Object.keys(run)
        .filter((k) => k.toLowerCase().startsWith(prefix))
        .slice(0, 8);
    } else {
      const parentPath = input.slice(0, dotIdx);
      const childPrefix = input.slice(dotIdx + 1).toLowerCase();
      const parentVal = resolveDotPath(run, parentPath);
      if (parentVal !== null && parentVal !== undefined && typeof parentVal === 'object') {
        return Object.keys(parentVal as Record<string, unknown>)
          .filter((k) => k.toLowerCase().startsWith(childPrefix))
          .map((k) => `${parentPath}.${k}`)
          .slice(0, 8);
      }
      return [];
    }
  } catch {
    return [];
  }
}

function DetailPanel({
  listRun,
  detailRun,
  detailLoading,
  detailError,
  onClose,
}: {
  listRun: WorkflowRun;
  detailRun: Record<string, unknown> | null;
  detailLoading: boolean;
  detailError: string | null;
  onClose: () => void;
}) {
  const [pathInput, setPathInput] = useState('');
  const [resolvedValue, setResolvedValue] = useState<unknown>(Symbol('unset'));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUnset = typeof resolvedValue === 'symbol';

  // The object used for inspection — fall back to list item while detail is loading
  const inspectTarget = detailRun ?? (listRun as unknown as Record<string, unknown>);

  function handlePathChange(val: string) {
    setPathInput(val);
    const s = getSuggestions(inspectTarget, val);
    setSuggestions(s);
    setShowSuggestions(s.length > 0);
  }

  function handleSuggestionClick(suggestion: string) {
    setPathInput(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function handleGetValue() {
    const result = resolveDotPath(inspectTarget, pathInput);
    setResolvedValue(result);
    setShowSuggestions(false);
  }

  function renderValue() {
    if (isUnset) return null;
    if (resolvedValue === undefined) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Path not found</span>;
    }
    if (resolvedValue === null) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>;
    }
    if (typeof resolvedValue === 'object') {
      return <pre style={{ margin: 0 }}>{JSON.stringify(resolvedValue, null, 2)}</pre>;
    }
    return <span>{String(resolvedValue)}</span>;
  }

  function handleCopy() {
    const json = detailRun ? JSON.stringify(detailRun, null, 2) : '';
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const title = listRun.workflow_title ?? listRun.workflow_run_id;

  return (
    <div
      style={{
        borderLeft: '1px solid #e5e7eb',
        paddingLeft: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, wordBreak: 'break-all' }}>
          {title}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '0.75rem',
            color: '#374151',
            flexShrink: 0,
            marginLeft: '0.5rem',
          }}
        >
          Close
        </button>
      </div>

      {/* JSON Path Inspector */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#374151' }}>JSON Path</div>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={pathInput}
            onChange={(e) => handlePathChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGetValue();
            }}
            placeholder="e.g. status or failure_reason"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '5px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={() => handleSuggestionClick(s)}
                  style={{
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleGetValue}
          disabled={detailLoading}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 14px',
            background: detailLoading ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: detailLoading ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          Get Value
        </button>

        {!isUnset && (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Value:</div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                padding: '6px 8px',
                maxHeight: '120px',
                overflowY: 'auto',
                background: '#f9fafb',
                wordBreak: 'break-all',
              }}
            >
              {renderValue()}
            </div>
          </>
        )}
      </div>

      {/* Raw JSON viewer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#374151' }}>
            Full Run Object
          </div>
          <button
            onClick={handleCopy}
            disabled={!detailRun}
            style={{
              padding: '3px 10px',
              background: copied ? '#059669' : '#f3f4f6',
              color: copied ? '#fff' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: detailRun ? 'pointer' : 'not-allowed',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>
        {detailLoading ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', padding: '8px 0' }}>Loading…</div>
        ) : detailError ? (
          <div
            style={{
              padding: '8px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              color: '#991b1b',
              fontSize: '0.8rem',
            }}
          >
            {detailError}
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              maxHeight: '400px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            {detailRun ? JSON.stringify(detailRun, null, 2) : ''}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function WorkflowRunExplorerPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [detailRun, setDetailRun] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function loadPage(p: number) {
    setLoading(true);
    setError(null);
    try {
      const data: WorkflowRunsResponse = await fetchWorkflowRuns(p);
      setRuns(data.runs);
      setPage(data.page);
      setHasMore(data.has_more);
      // Clear selection when navigating pages
      setSelectedRun(null);
      setDetailRun(null);
      setDetailError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }

  async function handleRowClick(run: WorkflowRun) {
    if (selectedRun?.workflow_run_id === run.workflow_run_id) {
      setSelectedRun(null);
      setDetailRun(null);
      setDetailError(null);
      return;
    }
    setSelectedRun(run);
    setDetailRun(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await fetchWorkflowRun(run.workflow_run_id);
      setDetailRun(data);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load run detail');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadPage(1);
  }, []);

  return (
    <div style={{ padding: '1.5rem', height: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 700 }}>
        Workflow Run Explorer
      </h1>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedRun ? '1fr 1fr' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left: Table + Pagination */}
        <div>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</div>
          ) : runs.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
              No runs found for this page.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
                    Run ID
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
                    Workflow
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const isActive = selectedRun?.workflow_run_id === run.workflow_run_id;
                  return (
                    <tr
                      key={run.workflow_run_id}
                      onClick={() => handleRowClick(run)}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = '';
                        }
                      }}
                    >
                      <td
                        style={{
                          padding: '7px 10px',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: '#1d4ed8',
                        }}
                        title={run.workflow_run_id}
                      >
                        {truncateRunId(run.workflow_run_id)}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#374151' }}>
                        {run.workflow_title ?? '—'}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <StatusBadge status={run.status} />
                      </td>
                      <td style={{ padding: '7px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {formatDateTime(run.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <button
              onClick={() => loadPage(page - 1)}
              disabled={page === 1 || loading}
              style={{
                padding: '5px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: page === 1 || loading ? '#f3f4f6' : '#fff',
                color: page === 1 || loading ? '#9ca3af' : '#374151',
                cursor: page === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>Page {page}</span>
            <button
              onClick={() => loadPage(page + 1)}
              disabled={!hasMore || loading}
              style={{
                padding: '5px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: !hasMore || loading ? '#f3f4f6' : '#fff',
                color: !hasMore || loading ? '#9ca3af' : '#374151',
                cursor: !hasMore || loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedRun && (
          <DetailPanel
            listRun={selectedRun}
            detailRun={detailRun}
            detailLoading={detailLoading}
            detailError={detailError}
            onClose={() => {
              setSelectedRun(null);
              setDetailRun(null);
              setDetailError(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
