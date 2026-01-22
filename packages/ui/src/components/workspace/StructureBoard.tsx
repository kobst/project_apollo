/**
 * StructureBoard - Main content area showing the story structure.
 * Features a slide-out edit panel for editing PlotPoints and Scenes.
 * Proposed nodes from staged packages are merged into their logical positions.
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { OutlineData, OutlinePlotPoint, OutlineScene, OutlineIdea, CreateSceneRequest, CreateIdeaRequest } from '../../api/types';
import { mergeProposedIntoOutline, type MergedOutlineData } from '../../utils/outlineMergeUtils';
import { ActRow } from '../outline/ActRow';
import { UnassignedSection } from '../outline/UnassignedSection';
import { CreatePlotPointModal } from '../outline/CreatePlotPointModal';
import { CreateSceneModal } from '../outline/CreateSceneModal';
import { CreateIdeaModal } from '../outline/CreateIdeaModal';
import { EditPanel } from './EditPanel';
import styles from './StructureBoard.module.css';

// Types for edit panel
type EditItemType = 'plotpoint' | 'scene';
interface EditState {
  type: EditItemType;
  item: OutlinePlotPoint | OutlineScene;
}

// Context for triggering edits (passed down to children)
interface EditContextValue {
  onEditPlotPoint: (pp: OutlinePlotPoint) => void;
  onEditScene: (scene: OutlineScene) => void;
}

export const EditContext = createContext<EditContextValue>({
  onEditPlotPoint: () => {},
  onEditScene: () => {},
});

export function useEdit() {
  return useContext(EditContext);
}

// Keep useExpansion for backward compatibility during transition
export function useExpansion() {
  return {
    expandedId: null,
    onToggleExpand: () => {},
  };
}

export function StructureBoard() {
  const { currentStoryId, refreshStatus } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode } = useGeneration();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit panel state
  const [editState, setEditState] = useState<EditState | null>(null);

  // Modal states
  const [showPlotPointModal, setShowPlotPointModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [savingPlotPoint, setSavingPlotPoint] = useState(false);
  const [savingScene, setSavingScene] = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);

  // Compute merged outline with proposed nodes in their logical positions
  const mergedOutline: MergedOutlineData | null = useMemo(() => {
    if (!outline) return null;
    return mergeProposedIntoOutline(
      outline,
      stagedPackage,
      staging.editedNodes,
      staging.removedNodeIds
    );
  }, [outline, stagedPackage, staging.editedNodes, staging.removedNodeIds]);

  const handleEditProposedNode = useCallback((nodeId: string, updates: Partial<Record<string, unknown>>) => {
    updateEditedNode(nodeId, updates);
  }, [updateEditedNode]);

  const handleRemoveProposedNode = useCallback((nodeId: string) => {
    removeProposedNode(nodeId);
  }, [removeProposedNode]);

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

  // Edit handlers - open the slide-out panel
  const handleEditPlotPoint = useCallback((pp: OutlinePlotPoint) => {
    setEditState({ type: 'plotpoint', item: pp });
  }, []);

  const handleEditScene = useCallback((scene: OutlineScene) => {
    setEditState({ type: 'scene', item: scene });
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditState(null);
  }, []);

  const handleEditSave = useCallback(() => {
    void fetchOutline();
  }, [fetchOutline]);

  // Handle creating a new unassigned PlotPoint
  const handleAddPlotPoint = useCallback(async (data: Parameters<typeof api.createPlotPoint>[1]) => {
    if (!currentStoryId) return;

    setSavingPlotPoint(true);
    try {
      await api.createPlotPoint(currentStoryId, data);
      setShowPlotPointModal(false);
      await fetchOutline();
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
      await fetchOutline();
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
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create idea:', err);
    } finally {
      setSavingIdea(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle clicking on items in UnassignedSection
  const handlePlotPointClick = useCallback((pp: OutlinePlotPoint) => {
    handleEditPlotPoint(pp);
  }, [handleEditPlotPoint]);

  const handleSceneClick = useCallback((scene: OutlineScene) => {
    handleEditScene(scene);
  }, [handleEditScene]);

  const handleIdeaClick = useCallback((_idea: OutlineIdea) => {
    // Ideas don't have an edit panel yet - could add later
    console.log('Idea clicked - edit not implemented yet');
  }, []);

  const editContextValue: EditContextValue = {
    onEditPlotPoint: handleEditPlotPoint,
    onEditScene: handleEditScene,
  };

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Stories tab to view its outline.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading structure...</div>
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

  // Calculate summary stats
  const unassignedPlotPointCount = outline.unassignedPlotPoints?.length ?? 0;
  const unassignedSceneCount = outline.unassignedScenes?.length ?? 0;
  const unassignedIdeaCount = outline.unassignedIdeas?.length ?? 0;
  const totalUnassignedCount = unassignedPlotPointCount + unassignedSceneCount + unassignedIdeaCount;

  return (
    <EditContext.Provider value={editContextValue}>
      <div className={styles.container}>
        <div className={styles.header}>
            <h2 className={styles.title}>Structure Board</h2>
            <div className={styles.summary}>
              <span className={styles.summaryItem}>
                <strong>{outline.summary.totalBeats}</strong> beats
              </span>
              <span className={styles.summaryDivider}>•</span>
              <span className={styles.summaryItem}>
                <strong>{outline.summary.totalPlotPoints}</strong> plot points
              </span>
              <span className={styles.summaryDivider}>•</span>
              <span className={styles.summaryItem}>
                <strong>{outline.summary.totalScenes}</strong> scenes
              </span>
              {totalUnassignedCount > 0 && (
                <>
                  <span className={styles.summaryDivider}>•</span>
                  <span className={styles.summaryItemWarning}>
                    <strong>{totalUnassignedCount}</strong> unassigned
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={styles.content}>
            {/* Acts with merged proposed nodes in their logical positions */}
            {mergedOutline?.acts.map((act) => (
              <ActRow
                key={act.act}
                act={act}
                onEditProposed={handleEditProposedNode}
                onRemoveProposed={handleRemoveProposedNode}
                removedNodeIds={staging.removedNodeIds}
              />
            ))}

            {mergedOutline?.acts.length === 0 && (
              <div className={styles.noBeats}>
                <p>No beats in this story yet.</p>
                <p className={styles.hint}>Use the Generation tab to create story structure.</p>
              </div>
            )}

            {/* Unassigned Items Section - includes proposed unassigned items */}
            <UnassignedSection
              plotPoints={mergedOutline?.unassignedPlotPoints ?? []}
              scenes={mergedOutline?.unassignedScenes ?? []}
              ideas={mergedOutline?.unassignedIdeas ?? []}
              proposedPlotPoints={mergedOutline?.proposedUnassignedPlotPoints ?? []}
              proposedScenes={mergedOutline?.proposedUnassignedScenes ?? []}
              onAddPlotPoint={() => setShowPlotPointModal(true)}
              onAddScene={() => setShowSceneModal(true)}
              onAddIdea={() => setShowIdeaModal(true)}
              onPlotPointClick={handlePlotPointClick}
              onSceneClick={handleSceneClick}
              onIdeaClick={handleIdeaClick}
              onEditProposed={handleEditProposedNode}
              onRemoveProposed={handleRemoveProposedNode}
              removedNodeIds={staging.removedNodeIds}
            />
          </div>

        {/* Edit Modal */}
        {editState && (
          <EditPanel
            itemType={editState.type}
            item={editState.item}
            onClose={handleCloseEdit}
            onSave={handleEditSave}
          />
        )}

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
    </EditContext.Provider>
  );
}
