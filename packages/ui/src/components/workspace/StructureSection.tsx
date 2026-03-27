/**
 * StructureSection - Story structure with horizontal swimlane layout.
 * Wrapped in CollapsibleSection, contains ActSwimlanes and StashSection.
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { OutlineData, OutlinePlotPoint, OutlineScene, CreateSceneRequest, NodeData } from '../../api/types';
import { mergeProposedIntoOutline, type MergedOutlineData, type MergedOutlinePlotPoint, type MergedOutlineScene, type MergedOutlineBeat } from '../../utils/outlineMergeUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { ActSwimlane } from './ActSwimlane';
import { AddStoryBeatModal } from '../outline/AddStoryBeatModal';
import { CreateStoryBeatModal } from '../outline/CreateStoryBeatModal';
import { CreateSceneModal } from '../outline/CreateSceneModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { AssignStoryBeatModal } from '../outline/AssignStoryBeatModal';
import { AssignSceneModal } from '../outline/AssignSceneModal';
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

// Context for triggering edits and deletes (passed down to children)
interface StructureEditContextValue {
  onEditPlotPoint: (pp: OutlinePlotPoint) => void;
  onEditScene: (scene: OutlineScene) => void;
  onDeletePlotPoint: (plotPoint: MergedOutlinePlotPoint) => void;
  onDeleteScene: (scene: MergedOutlineScene) => void;
}

const StructureEditContext = createContext<StructureEditContextValue>({
  onEditPlotPoint: () => {},
  onEditScene: () => {},
  onDeletePlotPoint: () => {},
  onDeleteScene: () => {},
});

export function useStructureEdit() {
  return useContext(StructureEditContext);
}

type AnyElementType = 'Character' | 'Location' | 'Object' | 'PlotPoint' | 'Scene' | 'Beat' | 'Idea' | string;

interface StructureSectionProps {
  /** Callback when an element is clicked (for node selection mode) */
  onElementClick?: ((elementId: string, elementType: AnyElementType, elementName?: string) => void) | undefined;
  /** Whether we're in node selection mode (for Expand) - when true, don't open edit panel */
  nodeSelectionMode?: boolean | undefined;
}

export function StructureSection({ onElementClick, nodeSelectionMode }: StructureSectionProps) {
  const { currentStoryId, refreshStatus, status } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode, sectionChangeCounts } = useGeneration();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit panel state
  const [editState, setEditState] = useState<EditState | null>(null);

  // Modal states
  const [showPlotPointModal, setShowPlotPointModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [savingPlotPoint, setSavingPlotPoint] = useState(false);
  const [savingScene, setSavingScene] = useState(false);

  // Track the clicked beat for pre-populating the modal
  const [beatContext, setBeatContext] = useState<BeatContext | null>(null);

  // Delete modal state
  const [deleteNode, setDeleteNode] = useState<NodeData | null>(null);

  // Assign modal states
  const [assignPlotPoint, setAssignPlotPoint] = useState<MergedOutlinePlotPoint | null>(null);
  const [assignScene, setAssignScene] = useState<MergedOutlineScene | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);

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

  // Get all beats for the assign modal
  const allBeats = useMemo(() => {
    const beats: Array<{ id: string; beatType: string; act: number }> = [];
    if (!mergedOutline) return beats;

    for (const act of mergedOutline.acts) {
      for (const beat of act.beats) {
        beats.push({ id: beat.id, beatType: beat.beatType, act: act.act });
      }
    }
    return beats;
  }, [mergedOutline]);

  // Get all plot points for the assign scene modal
  const allPlotPoints = useMemo(() => {
    const plotPoints: OutlinePlotPoint[] = [];
    if (!mergedOutline) return plotPoints;

    for (const act of mergedOutline.acts) {
      for (const beat of act.beats) {
        for (const pp of beat.plotPoints) {
          if (!pp._isProposed) {
            plotPoints.push(pp as unknown as OutlinePlotPoint);
          }
        }
      }
    }
    return plotPoints;
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

  // Re-fetch outline when story changes or when a new version is created (e.g. after accept)
  useEffect(() => {
    void fetchOutline();
  }, [fetchOutline, status?.currentVersionId]);

  // Edit handlers - open the slide-out panel (unless in selection mode)
  const handleEditPlotPoint = useCallback((pp: OutlinePlotPoint | MergedOutlinePlotPoint) => {
    // Notify parent for node selection mode
    onElementClick?.(pp.id, 'PlotPoint', pp.title);
    // Only open edit panel if not in selection mode
    if (!nodeSelectionMode) {
      setEditState({ type: 'plotpoint', item: pp as OutlinePlotPoint });
    }
  }, [onElementClick, nodeSelectionMode]);

  const handleEditScene = useCallback((scene: OutlineScene | MergedOutlineScene, _plotPointId?: string) => {
    // Notify parent for node selection mode
    onElementClick?.(scene.id, 'Scene', scene.heading);
    // Only open edit panel if not in selection mode
    if (!nodeSelectionMode) {
      setEditState({ type: 'scene', item: scene as OutlineScene });
    }
  }, [onElementClick, nodeSelectionMode]);

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

  // Handle closing plot point modal
  const handleClosePlotPointModal = useCallback(() => {
    setShowPlotPointModal(false);
    setBeatContext(null);
  }, []);

  // Delete handlers
  const handleDeletePlotPoint = useCallback((plotPoint: MergedOutlinePlotPoint) => {
    setDeleteNode({
      id: plotPoint.id,
      type: 'PlotPoint',
      label: plotPoint.title,
      data: {},
    });
  }, []);

  const handleDeleteScene = useCallback((scene: MergedOutlineScene) => {
    setDeleteNode({
      id: scene.id,
      type: 'Scene',
      label: scene.heading || 'Untitled Scene',
      data: {},
    });
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    setDeleteNode(null);
    await fetchOutline();
    void refreshStatus();
  }, [fetchOutline, refreshStatus]);

  const handleDeleteCancelled = useCallback(() => {
    setDeleteNode(null);
  }, []);

  const handleAssignPlotPointToBeat = useCallback(async (beatId: string) => {
    if (!currentStoryId || !assignPlotPoint) return;

    setSavingAssignment(true);
    try {
      // Update the PlotPoint's alignedBeatId property
      await api.updatePlotPoint(currentStoryId, assignPlotPoint.id, { alignedBeatId: beatId });
      setAssignPlotPoint(null);
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to assign plot point:', err);
    } finally {
      setSavingAssignment(false);
    }
  }, [currentStoryId, assignPlotPoint, fetchOutline, refreshStatus]);

  const handleAssignSceneToPlotPoint = useCallback(async (plotPointId: string) => {
    if (!currentStoryId || !assignScene) return;

    setSavingAssignment(true);
    try {
      await api.createEdge(currentStoryId, {
        type: 'REALIZED_BY',
        from: plotPointId,
        to: assignScene.id,
      });
      setAssignScene(null);
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to assign scene:', err);
    } finally {
      setSavingAssignment(false);
    }
  }, [currentStoryId, assignScene, fetchOutline, refreshStatus]);

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
    onDeletePlotPoint: handleDeletePlotPoint,
    onDeleteScene: handleDeleteScene,
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
                onDeletePlotPoint={handleDeletePlotPoint}
                onDeleteScene={handleDeleteScene}
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

        {/* Plot Point Modal - use AddStoryBeatModal if beat context, else CreateStoryBeatModal */}
        {showPlotPointModal && beatContext && (
          <AddStoryBeatModal
            beatId={beatContext.beatId}
            beatType={beatContext.beatType}
            act={beatContext.act}
            onAdd={handleAddPlotPoint}
            onCancel={handleClosePlotPointModal}
            saving={savingPlotPoint}
          />
        )}

        {showPlotPointModal && !beatContext && (
          <CreateStoryBeatModal
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

        {/* Delete Node Modal */}
        {deleteNode && currentStoryId && (
          <DeleteNodeModal
            storyId={currentStoryId}
            node={deleteNode}
            onDeleted={handleDeleteConfirmed}
            onCancel={handleDeleteCancelled}
          />
        )}

        {/* Assign Plot Point Modal */}
        {assignPlotPoint && (
          <AssignStoryBeatModal
            plotPointTitle={assignPlotPoint.title}
            beats={allBeats}
            onAssign={handleAssignPlotPointToBeat}
            onCancel={() => setAssignPlotPoint(null)}
            saving={savingAssignment}
          />
        )}

        {/* Assign Scene Modal */}
        {assignScene && (
          <AssignSceneModal
            sceneHeading={assignScene.heading || 'Untitled Scene'}
            plotPoints={allPlotPoints}
            onAssign={handleAssignSceneToPlotPoint}
            onCancel={() => setAssignScene(null)}
            saving={savingAssignment}
          />
        )}
      </CollapsibleSection>
    </StructureEditContext.Provider>
  );
}
