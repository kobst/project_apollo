import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { OutlineData } from '../../api/types';
import { ActRow } from './ActRow';
import styles from './OutlineView.module.css';

export function OutlineView() {
  const { currentStoryId, status } = useStory();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutline = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getOutline(currentStoryId);
      setOutline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outline');
      setOutline(null);
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchOutline();
  }, [fetchOutline]);

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Contract tab to view its outline.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading outline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No outline data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Outline: {status?.name || currentStoryId}
        </h2>
        <div className={styles.summary}>
          <span className={styles.summaryItem}>
            <strong>{outline.summary.totalBeats}</strong> beats
          </span>
          <span className={styles.summaryItem}>
            <strong>{outline.summary.totalScenes}</strong> scenes
          </span>
          {outline.summary.emptyBeats > 0 && (
            <span className={styles.summaryItemWarning}>
              <strong>{outline.summary.emptyBeats}</strong> empty
            </span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {outline.acts.map((act) => (
          <ActRow key={act.act} act={act} />
        ))}

        {outline.acts.length === 0 && (
          <div className={styles.noBeats}>
            <p>No beats in this story yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
