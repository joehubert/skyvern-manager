'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './EditDescriptionModal.module.css';

interface EditDescriptionModalProps {
  workflowTitle: string;
  initialDescription: string;
  onSave: (description: string) => Promise<void>;
  onClose: () => void;
}

export default function EditDescriptionModal({
  workflowTitle,
  initialDescription,
  onSave,
  onClose,
}: EditDescriptionModalProps) {
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(description);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div className={styles.card} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <p className={styles.workflowTitle}>{workflowTitle}</p>
          <h2 className={styles.modalTitle}>Edit Description</h2>
        </div>
        <div className={styles.body}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter workflow description…"
            disabled={isSaving}
          />
        </div>
        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className={styles.btnSave} onClick={handleSave} disabled={isSaving}>
            {isSaving && <span className={styles.savingSpinner} />}
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
