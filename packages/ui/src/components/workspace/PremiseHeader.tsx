import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import styles from './PremiseHeader.module.css';

interface PremiseHeaderProps {
  onEditPremise: () => void;
}

interface PremiseData {
  logline: NodeData | null;
  genreTone: NodeData | null;
  setting: NodeData | null;
}

export function PremiseHeader({ onEditPremise }: PremiseHeaderProps) {
  const { currentStoryId, status } = useStory();
  const [premiseData, setPremiseData] = useState<PremiseData>({
    logline: null,
    genreTone: null,
    setting: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchPremiseData = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    try {
      // Fetch all three premise node types in parallel
      const [loglineRes, genreToneRes, settingRes] = await Promise.all([
        api.listNodes(currentStoryId, 'Logline', 1),
        api.listNodes(currentStoryId, 'GenreTone', 1),
        api.listNodes(currentStoryId, 'Setting', 1),
      ]);

      setPremiseData({
        logline: loglineRes.nodes[0] ?? null,
        genreTone: genreToneRes.nodes[0] ?? null,
        setting: settingRes.nodes[0] ?? null,
      });
    } catch (err) {
      console.error('Failed to fetch premise data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchPremiseData();
  }, [fetchPremiseData]);

  // Extract display values from node data
  const loglineText = premiseData.logline?.data?.text as string | undefined;
  const genre = premiseData.genreTone?.data?.genre as string | undefined;
  const tone = premiseData.genreTone?.data?.tone as string | undefined;
  const settingName = premiseData.setting?.data?.name as string | undefined;
  const settingPeriod = premiseData.setting?.data?.time_period as string | undefined;

  // Build genre/tone display string
  const genreToneDisplay = [genre, tone].filter(Boolean).join(' / ') || null;

  // Build setting display string
  const settingDisplay = [settingName, settingPeriod].filter(Boolean).join(', ') || null;

  const storyName = status?.name || currentStoryId || 'Untitled Story';

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.storyName}>{storyName}</h1>
          <button
            className={styles.editButton}
            onClick={onEditPremise}
            type="button"
            disabled={loading}
          >
            Edit Premise
          </button>
        </div>

        <div className={styles.premiseRow}>
          {loglineText ? (
            <p className={styles.logline}>"{loglineText}"</p>
          ) : (
            <p className={styles.placeholder}>Add a logline to describe your story...</p>
          )}
        </div>

        <div className={styles.metaRow}>
          {genreToneDisplay ? (
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}>&#127916;</span>
              {genreToneDisplay}
            </span>
          ) : (
            <span className={styles.metaPlaceholder}>Add genre/tone</span>
          )}

          <span className={styles.metaDivider}>|</span>

          {settingDisplay ? (
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}>&#128205;</span>
              {settingDisplay}
            </span>
          ) : (
            <span className={styles.metaPlaceholder}>Add setting</span>
          )}
        </div>
      </div>
    </div>
  );
}
