'use client';

import styles from './ConfigEditor.module.css';

interface ConfigEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  hasUnsavedChanges: boolean;
  error?: string | null;
  language?: 'json' | 'html';
  rows?: number;
}

export default function ConfigEditor({
  label,
  value,
  onChange,
  hasUnsavedChanges,
  error,
  language = 'json',
  rows = 14,
}: ConfigEditorProps) {
  return (
    <div className={styles.editorSection}>
      <label className={styles.label}>{label}</label>
      <textarea
        className={`${styles.textarea} ${hasUnsavedChanges ? styles.unsaved : ''} ${error ? styles.hasError : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        data-language={language}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
