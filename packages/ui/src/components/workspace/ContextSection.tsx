/**
 * ContextSection - Story Context editor wrapped in CollapsibleSection.
 * Embeds StoryContextEditor inline with auto-save.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import { CollapsibleSection } from './CollapsibleSection';
import type { StoryContextChange } from '../../api/types';
import styles from './ContextSection.module.css';

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

export function ContextSection() {
  const { currentStoryId, refreshStatus } = useStory();
  const { sectionChangeCounts, staging, session } = useGeneration();

  // Get staged story context changes
  const stagedContextChanges: StoryContextChange[] = useMemo(() => {
    return staging.stagedPackage?.changes.storyContext ?? [];
  }, [staging.stagedPackage]);

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const prevSessionStatusRef = useRef<string | null>(null);

  // Track session status changes to trigger refetch when package is accepted
  useEffect(() => {
    if (session?.status === 'accepted' && prevSessionStatusRef.current === 'active') {
      // Package was just accepted - trigger a refetch
      setRefreshTrigger((prev) => prev + 1);
    }
    prevSessionStatusRef.current = session?.status ?? null;
  }, [session?.status]);

  // Fetch context on mount and when refreshTrigger changes
  useEffect(() => {
    async function fetchContext() {
      if (!currentStoryId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await api.getContext(currentStoryId);
        const ctx = data.context?.trim() ? data.context : DEFAULT_TEMPLATE;
        setContent(ctx);
        lastSavedContentRef.current = data.context ?? '';
        setLastSaved(data.modifiedAt);
        setHasChanges(!data.context?.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setLoading(false);
      }
    }

    void fetchContext();
  }, [currentStoryId, refreshTrigger]);

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

  // Handle content change with debounced save (2s as per plan)
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== lastSavedContentRef.current);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void saveContext(newContent);
    }, 2000);
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

  // Word count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Generate collapsed summary
  const collapsedSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${wordCount} words`);
    if (lastSaved) {
      parts.push(`Last saved ${new Date(lastSaved).toLocaleTimeString()}`);
    }
    return parts.join(' | ');
  }, [wordCount, lastSaved]);

  // Get badge counts
  const contextCounts = sectionChangeCounts?.storyContext;
  const badge = contextCounts && (contextCounts.additions > 0 || contextCounts.modifications > 0)
    ? { additions: contextCounts.additions, modifications: contextCounts.modifications }
    : undefined;

  if (loading) {
    return (
      <CollapsibleSection
        id="context"
        title="Story Context"
        icon={'\uD83D\uDCC4'}
        defaultExpanded={false}
      >
        <div className={styles.loading}>Loading...</div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="context"
      title="Story Context"
      icon={'\uD83D\uDCC4'}
      collapsedSummary={collapsedSummary}
      badge={badge}
      defaultExpanded={false}
    >
      <div className={styles.container}>
        <div className={styles.header}>
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
            {wordCount} words | {content.length} characters
          </span>
          {lastSaved && (
            <span className={styles.lastSaved}>
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Staged Story Context Changes - only show when session is active */}
        {stagedContextChanges.length > 0 && session?.status === 'active' && (
          <div className={styles.stagedChanges}>
            <h4 className={styles.stagedHeader}>
              Proposed Changes ({stagedContextChanges.length})
            </h4>
            <div className={styles.changesList}>
              {stagedContextChanges.map((change, idx) => (
                <div key={idx} className={`${styles.changeItem} ${styles[change.operation]}`}>
                  <div className={styles.changeHeader}>
                    <span className={styles.changeSection}>{change.section}</span>
                    <span className={`${styles.changeBadge} ${styles[change.operation]}`}>
                      {change.operation}
                    </span>
                  </div>
                  <p className={styles.changeContent}>{change.content}</p>
                </div>
              ))}
            </div>
            <p className={styles.stagedHint}>
              Accept or reject the package to apply these changes.
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
