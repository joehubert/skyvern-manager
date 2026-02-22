'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfigEditor from '../../components/ConfigEditor';
import TemplateEditor from '../../components/TemplateEditor';
import DocToolbar from '../../components/DocToolbar';
import WorkflowDocPreview from '../../components/WorkflowDocPreview';
import EditDescriptionModal from '../../components/EditDescriptionModal';
import {
  getFilterConfig,
  saveFilterConfig,
  getFieldConfig,
  saveFieldConfig,
  getTemplate,
  saveTemplate,
  getWorkflows,
  updateWorkflowDescription,
} from '../../lib/api';
import { renderAllWorkflows } from '../../lib/templateRenderer';
import styles from './page.module.css';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

function tryParseJson(str: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(str) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default function WorkflowDocPage() {
  const [filterConfigStr, setFilterConfigStr] = useState('');
  const [fieldConfigStr, setFieldConfigStr] = useState('');
  const [templateStr, setTemplateStr] = useState('');
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<Record<string, unknown>[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Record<string, unknown> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPreviewError(null);
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Load configs on mount, then fetch workflows
  useEffect(() => {
    async function load() {
      try {
        const [filter, field, tmpl] = await Promise.all([
          getFilterConfig(),
          getFieldConfig(),
          getTemplate(),
        ]);
        setFilterConfigStr(JSON.stringify(filter, null, 2));
        setFieldConfigStr(JSON.stringify(field, null, 2));
        setTemplateStr(tmpl);
      } catch (err) {
        showToast(`Failed to load configs: ${(err as Error).message}`, 'error');
      }
    }
    load().then(() => handleRefresh());
  }, [handleRefresh, showToast]);

  const handleFilterChange = (val: string) => {
    setFilterConfigStr(val);
    setHasUnsavedChanges(true);
    const parsed = tryParseJson(val);
    setFilterError(parsed.ok ? null : parsed.error);
  };

  const handleFieldChange = (val: string) => {
    setFieldConfigStr(val);
    setHasUnsavedChanges(true);
    const parsed = tryParseJson(val);
    setFieldError(parsed.ok ? null : parsed.error);
  };

  const handleTemplateChange = (val: string) => {
    setTemplateStr(val);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    const filterParsed = tryParseJson(filterConfigStr);
    const fieldParsed = tryParseJson(fieldConfigStr);

    if (!filterParsed.ok) {
      showToast(`Filter config has invalid JSON: ${filterParsed.error}`, 'error');
      return;
    }
    if (!fieldParsed.ok) {
      showToast(`Field config has invalid JSON: ${fieldParsed.error}`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveFilterConfig(filterParsed.value as Parameters<typeof saveFilterConfig>[0]);
      await saveFieldConfig(fieldParsed.value as Parameters<typeof saveFieldConfig>[0]);
      await saveTemplate(templateStr);
      setHasUnsavedChanges(false);
      showToast('Config saved successfully', 'success');
    } catch (err) {
      showToast(`Failed to save config: ${(err as Error).message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyHtml = async () => {
    try {
      const html = renderAllWorkflows(templateStr, workflows);
      await navigator.clipboard.writeText(html);
      showToast('Copied to clipboard', 'success');
    } catch (err) {
      showToast(`Failed to copy: ${(err as Error).message}`, 'error');
    }
  };

  const handleSaveDescription = async (description: string) => {
    if (!editingWorkflow) return;
    const rawId = editingWorkflow.workflow_permanent_id;
    const workflowId = typeof rawId === 'string' ? rawId : '';
    try {
      await updateWorkflowDescription(workflowId, description);
      setWorkflows(prev =>
        prev.map(w =>
          w.workflow_permanent_id === editingWorkflow.workflow_permanent_id
            ? { ...w, description }
            : w
        )
      );
      setEditingWorkflow(null);
      showToast('Description updated', 'success');
    } catch (err) {
      showToast(`Failed to update description: ${(err as Error).message}`, 'error');
      throw err; // keep modal open on error
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Workflow Doc</h1>
        <p className={styles.subtitle}>Generate API documentation from your workflows.</p>
      </div>

      <DocToolbar
        onRefresh={handleRefresh}
        onSave={handleSave}
        onCopyHtml={handleCopyHtml}
        isSaving={isSaving}
        isRefreshing={isRefreshing}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <div className={styles.content}>
        <div className={`${styles.configPanel} ${configCollapsed ? styles.configPanelCollapsed : ''}`}>
          <div className={styles.configPanelHeader}>
            <button
              className={styles.collapseToggle}
              onClick={() => setConfigCollapsed(c => !c)}
              title={configCollapsed ? 'Expand config panel' : 'Collapse config panel'}
            >
              {configCollapsed ? '▶' : '◀'}
            </button>
            {!configCollapsed && <span className={styles.configPanelTitle}>Config</span>}
          </div>
          {!configCollapsed && (
            <div className={styles.configPanelContent}>
              <ConfigEditor
                label="Filter Config"
                value={filterConfigStr}
                onChange={handleFilterChange}
                hasUnsavedChanges={hasUnsavedChanges && filterConfigStr !== ''}
                error={filterError}
                language="json"
              />
              <ConfigEditor
                label="Field Config"
                value={fieldConfigStr}
                onChange={handleFieldChange}
                hasUnsavedChanges={hasUnsavedChanges && fieldConfigStr !== ''}
                error={fieldError}
                language="json"
              />
              <TemplateEditor
                value={templateStr}
                onChange={handleTemplateChange}
                hasUnsavedChanges={hasUnsavedChanges && templateStr !== ''}
              />
            </div>
          )}
        </div>

        <div className={styles.previewPanel}>
          <WorkflowDocPreview
            workflows={workflows}
            template={templateStr}
            isLoading={isRefreshing}
            error={previewError}
            onEditDescription={setEditingWorkflow}
          />
        </div>
      </div>

      {editingWorkflow && (
        <EditDescriptionModal
          workflowTitle={typeof editingWorkflow.title === 'string' ? editingWorkflow.title : 'Untitled Workflow'}
          initialDescription={typeof editingWorkflow.description === 'string' ? editingWorkflow.description : ''}
          onSave={handleSaveDescription}
          onClose={() => setEditingWorkflow(null)}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
