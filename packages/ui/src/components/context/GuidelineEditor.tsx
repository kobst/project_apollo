/**
 * GuidelineEditor
 *
 * Editor for a single soft guideline with tags.
 * Shows selected tags as compact chips; click to expand full tag selector.
 */

import { useState, useCallback } from 'react';
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
  const [editingTags, setEditingTags] = useState(false);

  const handleTextChange = useCallback((text: string) => {
    onChange({ ...guideline, text });
  }, [guideline, onChange]);

  const handleTagsChange = useCallback((tags: GuidelineTag[]) => {
    onChange({ ...guideline, tags });
  }, [guideline, onChange]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tagChips}>
          {guideline.tags.map((tag) => (
            <span key={tag} className={styles.tagChip}>{tag}</span>
          ))}
          {!disabled && (
            <button
              type="button"
              className={styles.editTagsButton}
              onClick={() => setEditingTags(!editingTags)}
              title="Edit tags"
            >
              {editingTags ? 'done' : 'edit tags'}
            </button>
          )}
        </div>
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
      {editingTags && (
        <div className={styles.tagsSection}>
          <TagSelect
            selectedTags={guideline.tags}
            onChange={handleTagsChange}
            disabled={disabled}
          />
        </div>
      )}
      <textarea
        className={styles.textInput}
        value={guideline.text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Guideline text..."
        disabled={disabled}
        rows={2}
      />
    </div>
  );
}
