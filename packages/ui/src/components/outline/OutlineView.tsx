import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { OutlineData, OutlinePlotPoint, OutlineScene, OutlineIdea, CreateSceneRequest, CreateIdeaRequest } from '../../api/types';
import { ActRow } from './ActRow';
import { UnassignedSection } from './UnassignedSection';
import { CreatePlotPointModal } from './CreatePlotPointModal';
import { CreateSceneModal } from './CreateSceneModal';
import { CreateIdeaModal } from './CreateIdeaModal';
import styles from './OutlineView.module.css';

export function OutlineView() {
  const { currentStoryId, status, refreshStatus } = useStory();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showPlotPointModal, setShowPlotPointModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [savingPlotPoint, setSavingPlotPoint] = useState(false);
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

  // Handle creating a new unassigned PlotPoint
  const handleAddPlotPoint = useCallback(async (data: Parameters<typeof api.createPlotPoint>[1]) => {
    if (!currentStoryId) return;

    setSavingPlotPoint(true);
    try {
      await api.createPlotPoint(currentStoryId, data);
      setShowPlotPointModal(false);
      // Refresh outline to show the new plot point
      await fetchOutline();
      // Also refresh status to update counts
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create plot point:', err);
    } finally {
      setSavingPlotPoint(false);
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
      // Also refresh status to update counts
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create idea:', err);
    } finally {
      setSavingIdea(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle clicking on an unassigned plot point
  const handlePlotPointClick = useCallback((pp: OutlinePlotPoint) => {
    // For now, just log - could open a detail modal in the future
    console.log('Clicked plot point:', pp.id);
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
  const unassignedPlotPointCount = outline.unassignedPlotPoints?.length ?? 0;
  const unassignedSceneCount = outline.unassignedScenes?.length ?? 0;
  const unassignedIdeaCount = outline.unassignedIdeas?.length ?? 0;
  const totalUnassignedCount = unassignedPlotPointCount + unassignedSceneCount + unassignedIdeaCount;

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
            <strong>{outline.summary.totalPlotPoints}</strong> plot points
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

        {/* Unassigned Items Section */}
        <UnassignedSection
          plotPoints={outline.unassignedPlotPoints ?? []}
          scenes={outline.unassignedScenes ?? []}
          ideas={outline.unassignedIdeas ?? []}
          onAddPlotPoint={() => setShowPlotPointModal(true)}
          onAddScene={() => setShowSceneModal(true)}
          onAddIdea={() => setShowIdeaModal(true)}
          onPlotPointClick={handlePlotPointClick}
          onSceneClick={handleSceneClick}
          onIdeaClick={handleIdeaClick}
        />
      </div>

      {/* Create Plot Point Modal */}
      {showPlotPointModal && (
        <CreatePlotPointModal
          onAdd={handleAddPlotPoint}
          onCancel={() => setShowPlotPointModal(false)}
          saving={savingPlotPoint}
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
