'use client';

import { renderAllWorkflows } from '../lib/templateRenderer';
import styles from './WorkflowDocPreview.module.css';

interface WorkflowDocPreviewProps {
  workflows: Record<string, unknown>[];
  template: string;
  isLoading: boolean;
  error: string | null;
}

export default function WorkflowDocPreview({
  workflows,
  template,
  isLoading,
  error,
}: WorkflowDocPreviewProps) {
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

  const html = renderAllWorkflows(template, workflows);

  return (
    <div
      className="workflow-doc-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
