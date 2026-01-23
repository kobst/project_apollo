/**
 * StructureSection - Story structure with horizontal swimlane layout.
 * Wrapped in CollapsibleSection, contains ActSwimlanes and UnassignedSection.
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { OutlineData, OutlinePlotPoint, OutlineScene, OutlineIdea, CreateSceneRequest, CreateIdeaRequest } from '../../api/types';
import { mergeProposedIntoOutline, type MergedOutlineData, type MergedOutlinePlotPoint, type MergedOutlineScene, type MergedOutlineBeat } from '../../utils/outlineMergeUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { ActSwimlane } from './ActSwimlane';
import { UnassignedSection } from '../outline/UnassignedSection';
import { AddPlotPointModal } from '../outline/AddPlotPointModal';
import { CreatePlotPointModal } from '../outline/CreatePlotPointModal';
import { CreateSceneModal } from '../outline/CreateSceneModal';
import { CreateIdeaModal } from '../outline/CreateIdeaModal';
import { EditPanel } from './EditPanel';
import styles from './StructureSection.module.css';

// Types for edit panel
type EditItemType = 'plotpoint' | 'scene';
interface EditState {
  type: EditItemType;
  item: OutlinePlotPoint | OutlineScene;
}

// State for tracking which beat was clicked
interface BeatContext {
  beatId: string;
  beatType: string;
  act: 1 | 2 | 3 | 4 | 5;
}

// Context for triggering edits (passed down to children)
interface StructureEditContextValue {
  onEditPlotPoint: (pp: OutlinePlotPoint) => void;
  onEditScene: (scene: OutlineScene) => void;
}

const StructureEditContext = createContext<StructureEditContextValue>({
  onEditPlotPoint: () => {},
  onEditScene: () => {},
});

export function useStructureEdit() {
  return useContext(StructureEditContext);
}

export function StructureSection() {
  const { currentStoryId, refreshStatus } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode, sectionChangeCounts } = useGeneration();
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

  // Track the clicked beat for pre-populating the modal
  const [beatContext, setBeatContext] = useState<BeatContext | null>(null);

  // Compute merged outline with proposed nodes
  const mergedOutline: MergedOutlineData | null = useMemo(() => {
    if (!outline) return null;
    return mergeProposedIntoOutline(
      outline,
      stagedPackage,
      staging.editedNodes,
      staging.removedNodeIds
    );
  }, [outline, stagedPackage, staging.editedNodes, staging.removedNodeIds]);

  // Build a map of beatId -> beat info for quick lookup
  const beatMap = useMemo((): Map<string, { beat: MergedOutlineBeat; act: number }> => {
    const map = new Map<string, { beat: MergedOutlineBeat; act: number }>();
    if (!mergedOutline) return map;

    for (const act of mergedOutline.acts) {
      for (const beat of act.beats) {
        map.set(beat.id, { beat, act: act.act });
      }
    }
    return map;
  }, [mergedOutline]);

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
  const handleEditPlotPoint = useCallback((pp: OutlinePlotPoint | MergedOutlinePlotPoint) => {
    setEditState({ type: 'plotpoint', item: pp as OutlinePlotPoint });
  }, []);

  const handleEditScene = useCallback((scene: OutlineScene | MergedOutlineScene, _plotPointId?: string) => {
    setEditState({ type: 'scene', item: scene as OutlineScene });
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditState(null);
  }, []);

  const handleEditSave = useCallback(() => {
    void fetchOutline();
  }, [fetchOutline]);

  // Handle opening add plot point modal - with beat context
  const handleOpenAddPlotPoint = useCallback((beatId: string) => {
    const beatInfo = beatMap.get(beatId);
    if (beatInfo) {
      setBeatContext({
        beatId,
        beatType: beatInfo.beat.beatType,
        act: beatInfo.act as 1 | 2 | 3 | 4 | 5,
      });
    } else {
      // No beat context - will create unassigned
      setBeatContext(null);
    }
    setShowPlotPointModal(true);
  }, [beatMap]);

  // Handle opening add plot point modal without beat context (unassigned)
  const handleOpenAddUnassignedPlotPoint = useCallback(() => {
    setBeatContext(null);
    setShowPlotPointModal(true);
  }, []);

  // Handle creating a new PlotPoint
  const handleAddPlotPoint = useCallback(async (data: Parameters<typeof api.createPlotPoint>[1]) => {
    if (!currentStoryId) return;

    setSavingPlotPoint(true);
    try {
      await api.createPlotPoint(currentStoryId, data);
      setShowPlotPointModal(false);
      setBeatContext(null);
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create plot point:', err);
    } finally {
      setSavingPlotPoint(false);
    }
  }, [currentStoryId, fetchOutline, refreshStatus]);

  // Handle creating a new Scene
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

  // Handle closing plot point modal
  const handleClosePlotPointModal = useCallback(() => {
    setShowPlotPointModal(false);
    setBeatContext(null);
  }, []);

  // Handle clicking on items
  const handlePlotPointClick = useCallback((pp: OutlinePlotPoint) => {
    handleEditPlotPoint(pp);
  }, [handleEditPlotPoint]);

  const handleSceneClick = useCallback((scene: OutlineScene) => {
    handleEditScene(scene);
  }, [handleEditScene]);

  const handleIdeaClick = useCallback((_idea: OutlineIdea) => {
    console.log('Idea clicked - edit not implemented yet');
  }, []);

  // Generate collapsed summary
  const collapsedSummary = useMemo(() => {
    if (!outline) return 'No structure data';
    const parts: string[] = [];
    parts.push(`${outline.summary.totalBeats} beats`);
    parts.push(`${outline.summary.totalPlotPoints} plot points`);
    parts.push(`${outline.summary.totalScenes} scenes`);
    return parts.join(', ');
  }, [outline]);

  // Get badge counts
  const structureCounts = sectionChangeCounts?.structure;
  const badge = structureCounts && (structureCounts.additions > 0 || structureCounts.modifications > 0)
    ? { additions: structureCounts.additions, modifications: structureCounts.modifications }
    : undefined;

  const editContextValue: StructureEditContextValue = {
    onEditPlotPoint: handleEditPlotPoint,
    onEditScene: handleEditScene,
  };

  if (loading) {
    return (
      <CollapsibleSection
        id="structure"
        title="Structure"
        icon={'\uD83D\uDCCB'}
        defaultExpanded={true}
      >
        <div className={styles.loading}>Loading structure...</div>
      </CollapsibleSection>
    );
  }

  if (error) {
    return (
      <CollapsibleSection
        id="structure"
        title="Structure"
        icon={'\uD83D\uDCCB'}
        defaultExpanded={true}
      >
        <div className={styles.error}>{error}</div>
      </CollapsibleSection>
    );
  }

  if (!outline || !mergedOutline) {
    return (
      <CollapsibleSection
        id="structure"
        title="Structure"
        icon={'\uD83D\uDCCB'}
        defaultExpanded={true}
      >
        <div className={styles.empty}>
          <p>No outline data available</p>
        </div>
      </CollapsibleSection>
    );
  }

  // Calculate unassigned counts
  const unassignedPlotPointCount = outline.unassignedPlotPoints?.length ?? 0;
  const unassignedSceneCount = outline.unassignedScenes?.length ?? 0;
  const unassignedIdeaCount = outline.unassignedIdeas?.length ?? 0;
  const totalUnassignedCount = unassignedPlotPointCount + unassignedSceneCount + unassignedIdeaCount;

  return (
    <StructureEditContext.Provider value={editContextValue}>
      <CollapsibleSection
        id="structure"
        title="Structure"
        icon={'\uD83D\uDCCB'}
        collapsedSummary={collapsedSummary}
        badge={badge}
        defaultExpanded={true}
      >
        <div className={styles.container}>
          {/* Summary stats */}
          <div className={styles.summary}>
            <span className={styles.summaryItem}>
              <strong>{outline.summary.totalBeats}</strong> beats
            </span>
            <span className={styles.summaryDivider}>{'\u2022'}</span>
            <span className={styles.summaryItem}>
              <strong>{outline.summary.totalPlotPoints}</strong> plot points
            </span>
            <span className={styles.summaryDivider}>{'\u2022'}</span>
            <span className={styles.summaryItem}>
              <strong>{outline.summary.totalScenes}</strong> scenes
            </span>
            {totalUnassignedCount > 0 && (
              <>
                <span className={styles.summaryDivider}>{'\u2022'}</span>
                <span className={styles.summaryItemWarning}>
                  <strong>{totalUnassignedCount}</strong> unassigned
                </span>
              </>
            )}
          </div>

          {/* Acts with swimlane layout */}
          <div className={styles.acts}>
            {mergedOutline.acts.map((act) => (
              <ActSwimlane
                key={act.act}
                act={act}
                onEditPlotPoint={handleEditPlotPoint}
                onEditScene={handleEditScene}
                onAddPlotPoint={handleOpenAddPlotPoint}
                onAddScene={() => setShowSceneModal(true)}
                onEditProposed={handleEditProposedNode}
                onRemoveProposed={handleRemoveProposedNode}
                removedNodeIds={staging.removedNodeIds}
              />
            ))}

            {mergedOutline.acts.length === 0 && (
              <div className={styles.noBeats}>
                <p>No beats in this story yet.</p>
                <p className={styles.hint}>Use the Generation panel to create story structure.</p>
              </div>
            )}
          </div>

          {/* Unassigned Items Section */}
          <UnassignedSection
            plotPoints={mergedOutline.unassignedPlotPoints ?? []}
            scenes={mergedOutline.unassignedScenes ?? []}
            ideas={mergedOutline.unassignedIdeas ?? []}
            proposedPlotPoints={mergedOutline.proposedUnassignedPlotPoints ?? []}
            proposedScenes={mergedOutline.proposedUnassignedScenes ?? []}
            onAddPlotPoint={handleOpenAddUnassignedPlotPoint}
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

        {/* Edit Panel */}
        {editState && (
          <EditPanel
            itemType={editState.type}
            item={editState.item}
            onClose={handleCloseEdit}
            onSave={handleEditSave}
          />
        )}

        {/* Plot Point Modal - use AddPlotPointModal if beat context, else CreatePlotPointModal */}
        {showPlotPointModal && beatContext && (
          <AddPlotPointModal
            beatId={beatContext.beatId}
            beatType={beatContext.beatType}
            act={beatContext.act}
            onAdd={handleAddPlotPoint}
            onCancel={handleClosePlotPointModal}
            saving={savingPlotPoint}
          />
        )}

        {showPlotPointModal && !beatContext && (
          <CreatePlotPointModal
            onAdd={handleAddPlotPoint}
            onCancel={handleClosePlotPointModal}
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
      </CollapsibleSection>
    </StructureEditContext.Provider>
  );
}
