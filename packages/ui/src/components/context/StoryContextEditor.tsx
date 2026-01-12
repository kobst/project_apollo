/**
 * Story Context Editor
 *
 * A full-height markdown editor for story context (creative guidance).
 * Features auto-save with debounce.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import styles from './StoryContextEditor.module.css';

// Default template for new/empty Story Context
const DEFAULT_TEMPLATE = `# Story Context

## Creative Direction
Overall vision, mood, what makes this story unique.

## Themes & Motifs
Thematic concerns, recurring symbols, what the story explores.

## Working Notes
Fragments, unresolved ideas, things still being figured out.

## Reference & Inspiration
External sources, mood boards, "like X meets Y", visual references.

## Constraints & Rules
Story-specific rules that guide generation.
`;

interface StoryContextEditorProps {
  /** If true, renders in compact mode for drawer */
  compact?: boolean;
}

export function StoryContextEditor({ compact = false }: StoryContextEditorProps) {
  const { currentStoryId, refreshStatus } = useStory();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // Fetch context on mount
  useEffect(() => {
    async function fetchContext() {
      if (!currentStoryId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await api.getContext(currentStoryId);
        // Use default template if content is empty/null
        const ctx = data.context?.trim() ? data.context : DEFAULT_TEMPLATE;
        setContent(ctx);
        lastSavedContentRef.current = data.context ?? '';
        setLastSaved(data.modifiedAt);
        // Mark as having changes if we're using the template (needs initial save)
        setHasChanges(!data.context?.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setLoading(false);
      }
    }

    void fetchContext();
  }, [currentStoryId]);

  // Auto-save with debounce
  const saveContext = useCallback(async (newContent: string) => {
    if (!currentStoryId) return;
    if (newContent === lastSavedContentRef.current) {
      setHasChanges(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await api.updateContext(currentStoryId, newContent);
      lastSavedContentRef.current = newContent;
      setLastSaved(result.modifiedAt);
      setHasChanges(false);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save context');
    } finally {
      setSaving(false);
    }
  }, [currentStoryId, refreshStatus]);

  // Handle content change with debounced save
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== lastSavedContentRef.current);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      void saveContext(newContent);
    }, 1000);
  }, [saveContext]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on blur (immediate)
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (hasChanges) {
      void saveContext(content);
    }
  }, [content, hasChanges, saveContext]);

  // Word and character count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (!currentStoryId) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.placeholder}>Select a story to edit context</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Story Context</h3>
        <div className={styles.status}>
          {saving && <span className={styles.saving}>Saving...</span>}
          {hasChanges && !saving && <span className={styles.unsaved}>Unsaved changes</span>}
          {!hasChanges && !saving && lastSaved && (
            <span className={styles.saved}>Saved</span>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.description}>
        Creative guidance that can't be captured in formal nodes: vision, themes,
        working notes, references, and constraints. Changes are auto-saved.
      </div>

      <div className={styles.editorWrapper}>
        <textarea
          className={styles.editor}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Start typing your story context..."
          disabled={saving}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.stats}>
          {wordCount} words | {charCount} characters
        </span>
        {lastSaved && (
          <span className={styles.lastSaved}>
            Last saved: {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
