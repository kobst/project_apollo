import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { useStashContext } from '../../context/StashContext';
import { api } from '../../api/client';
import type { OutlineData, OutlineStoryBeat, OutlineScene, OutlineIdea, CreateSceneRequest, CreateIdeaRequest } from '../../api/types';
import { ActRow } from './ActRow';
import { StashSection } from './StashSection';
import { CreateStoryBeatModal } from './CreateStoryBeatModal';
import { CreateSceneModal } from './CreateSceneModal';
import { CreateIdeaModal } from './CreateIdeaModal';
import styles from './OutlineView.module.css';

export function OutlineView() {
  const { currentStoryId, status, refreshStatus } = useStory();
  const { refresh: refreshStash } = useStashContext();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showStoryBeatModal, setShowStoryBeatModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [savingStoryBeat, setSavingStoryBeat] = useState(false);
  const [savingScene, setSavingScene] = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);

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

  // Handle creating a new unassigned StoryBeat
  const handleAddStoryBeat = useCallback(async (data: Parameters<typeof api.createStoryBeat>[1]) => {
    if (!currentStoryId) return;

    setSavingStoryBeat(true);
    try {
      await api.createStoryBeat(currentStoryId, data);
      setShowStoryBeatModal(false);
      // Refresh outline to show the new story beat
      await fetchOutline();
      // Also refresh status to update counts
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create story beat:', err);
    } finally {
      setSavingStoryBeat(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle creating a new unassigned Scene
  const handleAddScene = useCallback(async (data: CreateSceneRequest) => {
    if (!currentStoryId) return;

    setSavingScene(true);
    try {
      await api.createScene(currentStoryId, data);
      setShowSceneModal(false);
      // Refresh outline to show the new scene
      await fetchOutline();
      // Also refresh status to update counts
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create scene:', err);
    } finally {
      setSavingScene(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle creating a new Idea
  const handleAddIdea = useCallback(async (data: CreateIdeaRequest) => {
    if (!currentStoryId) return;

    setSavingIdea(true);
    try {
      await api.createIdea(currentStoryId, data);
      setShowIdeaModal(false);
      // Refresh outline to show the new idea
      await fetchOutline();
      // Also refresh status and ideas list
      void refreshStatus();
      void refreshStash();
    } catch (err) {
      console.error('Failed to create idea:', err);
    } finally {
      setSavingIdea(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle clicking on an unassigned story beat
  const handleStoryBeatClick = useCallback((pp: OutlineStoryBeat) => {
    // For now, just log - could open a detail modal in the future
    console.log('Clicked story beat:', pp.id);
  }, []);

  // Handle clicking on an unassigned scene
  const handleSceneClick = useCallback((scene: OutlineScene) => {
    // For now, just log - could open a detail modal in the future
    console.log('Clicked scene:', scene.id);
  }, []);

  // Handle clicking on an idea
  const handleIdeaClick = useCallback((idea: OutlineIdea) => {
    // For now, just log - could open a detail modal in the future
    console.log('Clicked idea:', idea.id);
  }, []);

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

  // Calculate total unassigned count
  const unassignedStoryBeatCount = outline.unassignedStoryBeats?.length ?? 0;
  const unassignedSceneCount = outline.unassignedScenes?.length ?? 0;
  const unassignedIdeaCount = outline.unassignedIdeas?.length ?? 0;
  const totalUnassignedCount = unassignedStoryBeatCount + unassignedSceneCount + unassignedIdeaCount;

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
            <strong>{outline.summary.totalStoryBeats}</strong> story beats
          </span>
          <span className={styles.summaryItem}>
            <strong>{outline.summary.totalScenes}</strong> scenes
          </span>
          {totalUnassignedCount > 0 && (
            <span className={styles.summaryItemWarning}>
              <strong>{totalUnassignedCount}</strong> unassigned
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

        {/* Stash Section */}
        <StashSection
          storyBeats={outline.unassignedStoryBeats ?? []}
          scenes={outline.unassignedScenes ?? []}
          ideas={outline.unassignedIdeas ?? []}
          onAddStoryBeat={() => setShowStoryBeatModal(true)}
          onAddScene={() => setShowSceneModal(true)}
          onAddIdea={() => setShowIdeaModal(true)}
          onStoryBeatClick={handleStoryBeatClick}
          onSceneClick={handleSceneClick}
          onIdeaClick={handleIdeaClick}
        />
      </div>

      {/* Create Plot Point Modal */}
      {showStoryBeatModal && (
        <CreateStoryBeatModal
          onAdd={handleAddStoryBeat}
          onCancel={() => setShowStoryBeatModal(false)}
          saving={savingStoryBeat}
        />
      )}

      {/* Create Scene Modal */}
      {showSceneModal && (
        <CreateSceneModal
          onAdd={handleAddScene}
          onCancel={() => setShowSceneModal(false)}
          saving={savingScene}
        />
      )}

      {/* Create Idea Modal */}
      {showIdeaModal && (
        <CreateIdeaModal
          onAdd={handleAddIdea}
          onCancel={() => setShowIdeaModal(false)}
          saving={savingIdea}
        />
      )}
    </div>
  );
}
