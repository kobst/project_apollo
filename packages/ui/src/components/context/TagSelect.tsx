/**
 * TagSelect
 *
 * A multi-select component for guideline tags.
 * Displays tags as toggleable chips.
 */

import { useCallback } from 'react';
import type { GuidelineTag } from '../../api/types';
import styles from './TagSelect.module.css';

const ALL_TAGS: GuidelineTag[] = [
  'character',
  'dialogue',
  'scene',
  'action',
  'pacing',
  'plot',
  'worldbuilding',
  'general',
];

interface TagSelectProps {
  selectedTags: GuidelineTag[];
  onChange: (tags: GuidelineTag[]) => void;
  disabled?: boolean;
}

export function TagSelect({ selectedTags, onChange, disabled = false }: TagSelectProps) {
  const handleToggle = useCallback((tag: GuidelineTag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }, [selectedTags, onChange]);

  return (
    <div className={styles.container}>
      {ALL_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`${styles.tag} ${selectedTags.includes(tag) ? styles.selected : ''}`}
          onClick={() => handleToggle(tag)}
          disabled={disabled}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
