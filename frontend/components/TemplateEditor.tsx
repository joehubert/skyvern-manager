'use client';

import ConfigEditor from './ConfigEditor';

interface TemplateEditorProps {
  value: string;
  onChange: (val: string) => void;
  hasUnsavedChanges: boolean;
  error?: string | null;
}

export default function TemplateEditor({
  value,
  onChange,
  hasUnsavedChanges,
  error,
}: TemplateEditorProps) {
  return (
    <ConfigEditor
      label="HTML Template"
      value={value}
      onChange={onChange}
      hasUnsavedChanges={hasUnsavedChanges}
      error={error}
      language="html"
      rows={22}
    />
  );
}
