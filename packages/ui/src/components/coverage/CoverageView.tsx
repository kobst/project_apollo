import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { GapsData, GapTier, GapType } from '../../api/types';
import { PyramidPanel } from './PyramidPanel';
import { GapList } from './GapList';
import styles from './CoverageView.module.css';

export function CoverageView() {
  const { currentStoryId, status } = useStory();
  const [gapsData, setGapsData] = useState<GapsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<GapTier | null>(null);
  const [typeFilter, setTypeFilter] = useState<GapType | 'all'>('all');
  const [generatingCluster, setGeneratingCluster] = useState(false);

  const fetchGaps = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);

    try {
      // Use the new unified /gaps endpoint
      const data = await api.getGaps(currentStoryId);
      setGapsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gaps');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchGaps();
  }, [fetchGaps]);

  // Handle cluster generation for a narrative gap
  const handleGenerateCluster = async (gapId: string) => {
    if (!currentStoryId || generatingCluster) return;

    setGeneratingCluster(true);
    try {
      const cluster = await api.generateCluster(currentStoryId, { gapId });
      // TODO: Navigate to cluster view or show cluster panel
      console.log('Generated cluster:', cluster);
      alert(`Generated cluster "${cluster.title}" with ${cluster.moves.length} moves`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate cluster');
    } finally {
      setGeneratingCluster(false);
    }
  };

  // Filter gaps by selected tier
  const filteredGaps =
    gapsData?.gaps.filter((gap) => !selectedTier || gap.tier === selectedTier) ?? [];

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Contract tab to view coverage.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Gaps: {status?.name || currentStoryId}
        </h2>
        <div className={styles.controls}>
          <select
            className={styles.typeFilter}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as GapType | 'all')}
          >
            <option value="all">All Types</option>
            <option value="structural">Structural</option>
            <option value="narrative">Narrative</option>
          </select>
          <button
            className={styles.refreshBtn}
            onClick={fetchGaps}
            disabled={loading}
            type="button"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        <div className={styles.pyramidPane}>
          {gapsData && (
            <PyramidPanel
              tiers={gapsData.summary}
              selectedTier={selectedTier}
              onSelectTier={setSelectedTier}
            />
          )}
        </div>

        <div className={styles.gapPane}>
          {loading && !gapsData ? (
            <div className={styles.loading}>Loading gaps...</div>
          ) : (
            <GapList
              gaps={filteredGaps}
              selectedTier={selectedTier}
              gapType={typeFilter === 'all' ? undefined : typeFilter}
              onGenerateCluster={handleGenerateCluster}
            />
          )}
          {generatingCluster && (
            <div className={styles.generating}>Generating cluster...</div>
          )}
        </div>
      </div>
    </div>
  );
}
