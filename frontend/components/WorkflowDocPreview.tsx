'use client';

import { renderWorkflow } from '../lib/templateRenderer';
import styles from './WorkflowDocPreview.module.css';

interface WorkflowDocPreviewProps {
  workflows: Record<string, unknown>[];
  template: string;
  isLoading: boolean;
  error: string | null;
  onEditDescription: (workflow: Record<string, unknown>) => void;
}

export default function WorkflowDocPreview({
  workflows,
  template,
  isLoading,
  error,
  onEditDescription,
}: Readonly<WorkflowDocPreviewProps>) {
  if (isLoading) {
    return (
      <div className={styles.centered}>
        <span className={styles.spinner} />
        <span className={styles.loadingText}>Loading workflows…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <div className="workflow-doc-preview">
      {workflows.map((workflow, i) => {
        const rawId = workflow.workflow_permanent_id;
        const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : String(i);
        const html = renderWorkflow(template, workflow);
        return (
          <div key={id} className={styles.workflowWrapper}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
            <button
              className={styles.editDescBtn}
              onClick={() => onEditDescription(workflow)}
              title="Edit description"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0l-8.61 8.61a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l8.61-8.61a.25.25 0 0 0 0-.353l-1.085-1.086Z"
                  fill="currentColor"
                />
              </svg>
              Edit Description
            </button>
          </div>
        );
      })}
    </div>
  );
}
