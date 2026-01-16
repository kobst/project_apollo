/**
 * StoryContextModal - Full-screen overlay for Story Context editing.
 * Wraps the StoryContextEditor in a modal dialog.
 */

import { useCallback } from 'react';
import { StoryContextEditor } from './StoryContextEditor';
import styles from './StoryContextModal.module.css';

interface StoryContextModalProps {
  onClose: () => void;
}

export function StoryContextModal({ onClose }: StoryContextModalProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking directly on the backdrop
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-context-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="story-context-modal-title" className={styles.title}>
            Story Context
          </h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          <StoryContextEditor />
        </div>
      </div>
    </div>
  );
}
