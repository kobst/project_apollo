/**
 * GuidelineEditor
 *
 * Editor for a single soft guideline with tags.
 */

import { useCallback } from 'react';
import type { GuidelineTag, SoftGuideline } from '../../api/types';
import { TagSelect } from './TagSelect';
import styles from './GuidelineEditor.module.css';

interface GuidelineEditorProps {
  guideline: SoftGuideline;
  onChange: (updated: SoftGuideline) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function GuidelineEditor({
  guideline,
  onChange,
  onRemove,
  disabled = false,
}: GuidelineEditorProps) {
  const handleTextChange = useCallback((text: string) => {
    onChange({ ...guideline, text });
  }, [guideline, onChange]);

  const handleTagsChange = useCallback((tags: GuidelineTag[]) => {
    onChange({ ...guideline, tags });
  }, [guideline, onChange]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.id}>{guideline.id}</span>
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          disabled={disabled}
          title="Remove guideline"
        >
          x
        </button>
      </div>
      <textarea
        className={styles.textInput}
        value={guideline.text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Guideline text..."
        disabled={disabled}
        rows={2}
      />
      <div className={styles.tagsSection}>
        <span className={styles.tagsLabel}>Tags:</span>
        <TagSelect
          selectedTags={guideline.tags}
          onChange={handleTagsChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
