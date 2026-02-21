'use client';

import styles from './DocToolbar.module.css';

interface DocToolbarProps {
  onRefresh: () => void;
  onSave: () => void;
  onCopyHtml: () => void;
  isSaving: boolean;
  isRefreshing: boolean;
  hasUnsavedChanges: boolean;
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

export default function DocToolbar({
  onRefresh,
  onSave,
  onCopyHtml,
  isSaving,
  isRefreshing,
  hasUnsavedChanges,
}: DocToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button
        className={styles.btn}
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing && <Spinner />}
        Refresh
      </button>
      <button
        className={`${styles.btn} ${hasUnsavedChanges ? styles.unsaved : ''}`}
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving && <Spinner />}
        Save Configs
      </button>
      <button className={styles.btn} onClick={onCopyHtml}>
        Copy HTML
      </button>
    </div>
  );
}
