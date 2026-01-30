/**
 * StructureSection - Story structure with horizontal swimlane layout.
 * Wrapped in CollapsibleSection, contains ActSwimlanes and StashSection.
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { OutlineData, OutlineStoryBeat, OutlineScene, OutlineIdea, CreateSceneRequest, CreateIdeaRequest, NodeData } from '../../api/types';
import { mergeProposedIntoOutline, type MergedOutlineData, type MergedOutlineStoryBeat, type MergedOutlineScene, type MergedOutlineBeat } from '../../utils/outlineMergeUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { ActSwimlane } from './ActSwimlane';
import { StashSection } from '../outline/StashSection';
import { AddStoryBeatModal } from '../outline/AddStoryBeatModal';
import { CreateStoryBeatModal } from '../outline/CreateStoryBeatModal';
import { CreateSceneModal } from '../outline/CreateSceneModal';
import { CreateIdeaModal } from '../outline/CreateIdeaModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { AssignStoryBeatModal } from '../outline/AssignStoryBeatModal';
import { AssignSceneModal } from '../outline/AssignSceneModal';
import { EditPanel } from './EditPanel';
import styles from './StructureSection.module.css';

// Types for edit panel
type EditItemType = 'storybeat' | 'scene';
interface EditState {
  type: EditItemType;
  item: OutlineStoryBeat | OutlineScene;
}

// State for tracking which beat was clicked
interface BeatContext {
  beatId: string;
  beatType: string;
  act: 1 | 2 | 3 | 4 | 5;
}

// Context for triggering edits and deletes (passed down to children)
interface StructureEditContextValue {
  onEditStoryBeat: (pp: OutlineStoryBeat) => void;
  onEditScene: (scene: OutlineScene) => void;
  onDeleteStoryBeat: (storyBeat: MergedOutlineStoryBeat) => void;
  onDeleteScene: (scene: MergedOutlineScene) => void;
}

const StructureEditContext = createContext<StructureEditContextValue>({
  onEditStoryBeat: () => {},
  onEditScene: () => {},
  onDeleteStoryBeat: () => {},
  onDeleteScene: () => {},
});

export function useStructureEdit() {
  return useContext(StructureEditContext);
}

type AnyElementType = 'Character' | 'Location' | 'Object' | 'StoryBeat' | 'Scene' | 'Beat' | 'Idea' | string;

interface StructureSectionProps {
  /** Callback when an element is clicked (for node selection mode) */
  onElementClick?: ((elementId: string, elementType: AnyElementType, elementName?: string) => void) | undefined;
  /** Whether we're in node selection mode (for Expand) - when true, don't open edit panel */
  nodeSelectionMode?: boolean | undefined;
}

export function StructureSection({ onElementClick, nodeSelectionMode }: StructureSectionProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode, toggleStashedIdeaExclusion, excludedStashedIdeaIds, sectionChangeCounts } = useGeneration();
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit panel state
  const [editState, setEditState] = useState<EditState | null>(null);

  // Modal states
  const [showStoryBeatModal, setShowStoryBeatModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [savingStoryBeat, setSavingStoryBeat] = useState(false);
  const [savingScene, setSavingScene] = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);

  // Track the clicked beat for pre-populating the modal
  const [beatContext, setBeatContext] = useState<BeatContext | null>(null);

  // Delete modal state
  const [deleteNode, setDeleteNode] = useState<NodeData | null>(null);

  // Assign modal states
  const [assignStoryBeat, setAssignStoryBeat] = useState<MergedOutlineStoryBeat | null>(null);
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

  // Get all story beats for the assign scene modal
  const allStoryBeats = useMemo(() => {
    const storyBeats: OutlineStoryBeat[] = [];
    if (!mergedOutline) return storyBeats;

    for (const act of mergedOutline.acts) {
      for (const beat of act.beats) {
        for (const sb of beat.storyBeats) {
          if (!sb._isProposed) {
            storyBeats.push(sb as unknown as OutlineStoryBeat);
          }
        }
      }
    }
    return storyBeats;
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

  // Edit handlers - open the slide-out panel (unless in selection mode)
  const handleEditStoryBeat = useCallback((pp: OutlineStoryBeat | MergedOutlineStoryBeat) => {
    // Notify parent for node selection mode
    onElementClick?.(pp.id, 'StoryBeat', pp.title);
    // Only open edit panel if not in selection mode
    if (!nodeSelectionMode) {
      setEditState({ type: 'storybeat', item: pp as OutlineStoryBeat });
    }
  }, [onElementClick, nodeSelectionMode]);

  const handleEditScene = useCallback((scene: OutlineScene | MergedOutlineScene, _storyBeatId?: string) => {
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

  // Handle opening add story beat modal - with beat context
  const handleOpenAddStoryBeat = useCallback((beatId: string) => {
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
    setShowStoryBeatModal(true);
  }, [beatMap]);

  // Handle opening add story beat modal without beat context (unassigned)
  const handleOpenAddUnassignedStoryBeat = useCallback(() => {
    setBeatContext(null);
    setShowStoryBeatModal(true);
  }, []);

  // Handle creating a new StoryBeat
  const handleAddStoryBeat = useCallback(async (data: Parameters<typeof api.createStoryBeat>[1]) => {
    if (!currentStoryId) return;

    setSavingStoryBeat(true);
    try {
      await api.createStoryBeat(currentStoryId, data);
      setShowStoryBeatModal(false);
      setBeatContext(null);
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to create story beat:', err);
    } finally {
      setSavingStoryBeat(false);
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

  // Handle closing story beat modal
  const handleCloseStoryBeatModal = useCallback(() => {
    setShowStoryBeatModal(false);
    setBeatContext(null);
  }, []);

  // Handle clicking on items
  const handleStoryBeatClick = useCallback((pp: OutlineStoryBeat) => {
    handleEditStoryBeat(pp);
  }, [handleEditStoryBeat]);

  const handleSceneClick = useCallback((scene: OutlineScene) => {
    handleEditScene(scene);
  }, [handleEditScene]);

  const handleIdeaClick = useCallback((_idea: OutlineIdea) => {
    console.log('Idea clicked - edit not implemented yet');
  }, []);

  // Delete handlers
  const handleDeleteStoryBeat = useCallback((storyBeat: MergedOutlineStoryBeat) => {
    setDeleteNode({
      id: storyBeat.id,
      type: 'StoryBeat',
      label: storyBeat.title,
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

  const handleDeleteIdea = useCallback((idea: OutlineIdea) => {
    setDeleteNode({
      id: idea.id,
      type: 'Idea',
      label: idea.title,
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

  // Assign handlers
  const handleOpenAssignStoryBeat = useCallback((storyBeat: MergedOutlineStoryBeat) => {
    setAssignStoryBeat(storyBeat);
  }, []);

  const handleOpenAssignScene = useCallback((scene: MergedOutlineScene) => {
    setAssignScene(scene);
  }, []);

  const handleAssignStoryBeatToBeat = useCallback(async (beatId: string) => {
    if (!currentStoryId || !assignStoryBeat) return;

    setSavingAssignment(true);
    try {
      await api.createEdge(currentStoryId, {
        type: 'ALIGNS_WITH',
        from: assignStoryBeat.id,
        to: beatId,
      });
      setAssignStoryBeat(null);
      await fetchOutline();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to assign story beat:', err);
    } finally {
      setSavingAssignment(false);
    }
  }, [currentStoryId, assignStoryBeat, fetchOutline, refreshStatus]);

  const handleAssignSceneToStoryBeat = useCallback(async (storyBeatId: string) => {
    if (!currentStoryId || !assignScene) return;

    setSavingAssignment(true);
    try {
      await api.createEdge(currentStoryId, {
        type: 'SATISFIED_BY',
        from: storyBeatId,
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
    parts.push(`${outline.summary.totalStoryBeats} story beats`);
    parts.push(`${outline.summary.totalScenes} scenes`);
    return parts.join(', ');
  }, [outline]);

  // Get badge counts
  const structureCounts = sectionChangeCounts?.structure;
  const badge = structureCounts && (structureCounts.additions > 0 || structureCounts.modifications > 0)
    ? { additions: structureCounts.additions, modifications: structureCounts.modifications }
    : undefined;

  const editContextValue: StructureEditContextValue = {
    onEditStoryBeat: handleEditStoryBeat,
    onEditScene: handleEditScene,
    onDeleteStoryBeat: handleDeleteStoryBeat,
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
  const unassignedStoryBeatCount = outline.unassignedStoryBeats?.length ?? 0;
  const unassignedSceneCount = outline.unassignedScenes?.length ?? 0;
  const unassignedIdeaCount = outline.unassignedIdeas?.length ?? 0;
  const totalUnassignedCount = unassignedStoryBeatCount + unassignedSceneCount + unassignedIdeaCount;

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
              <strong>{outline.summary.totalStoryBeats}</strong> story beats
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
                onEditStoryBeat={handleEditStoryBeat}
                onEditScene={handleEditScene}
                onDeleteStoryBeat={handleDeleteStoryBeat}
                onDeleteScene={handleDeleteScene}
                onAddStoryBeat={handleOpenAddStoryBeat}
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

          {/* Stash Section */}
          <StashSection
            storyBeats={mergedOutline.unassignedStoryBeats ?? []}
            scenes={mergedOutline.unassignedScenes ?? []}
            ideas={mergedOutline.unassignedIdeas ?? []}
            proposedStoryBeats={mergedOutline.proposedUnassignedStoryBeats ?? []}
            proposedScenes={mergedOutline.proposedUnassignedScenes ?? []}
            proposedIdeas={mergedOutline.proposedIdeas ?? []}
            onAddStoryBeat={handleOpenAddUnassignedStoryBeat}
            onAddScene={() => setShowSceneModal(true)}
            onAddIdea={() => setShowIdeaModal(true)}
            onStoryBeatClick={handleStoryBeatClick}
            onSceneClick={handleSceneClick}
            onIdeaClick={handleIdeaClick}
            onEditProposed={handleEditProposedNode}
            onRemoveProposed={handleRemoveProposedNode}
            removedNodeIds={staging.removedNodeIds}
            excludedIdeaIds={excludedStashedIdeaIds}
            onToggleIdeaExclusion={toggleStashedIdeaExclusion}
            onDeleteStoryBeat={handleDeleteStoryBeat}
            onDeleteScene={handleDeleteScene}
            onDeleteIdea={handleDeleteIdea}
            onAssignStoryBeat={handleOpenAssignStoryBeat}
            onAssignScene={handleOpenAssignScene}
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

        {/* Story Beat Modal - use AddStoryBeatModal if beat context, else CreateStoryBeatModal */}
        {showStoryBeatModal && beatContext && (
          <AddStoryBeatModal
            beatId={beatContext.beatId}
            beatType={beatContext.beatType}
            act={beatContext.act}
            onAdd={handleAddStoryBeat}
            onCancel={handleCloseStoryBeatModal}
            saving={savingStoryBeat}
          />
        )}

        {showStoryBeatModal && !beatContext && (
          <CreateStoryBeatModal
            onAdd={handleAddStoryBeat}
            onCancel={handleCloseStoryBeatModal}
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

        {/* Delete Node Modal */}
        {deleteNode && currentStoryId && (
          <DeleteNodeModal
            storyId={currentStoryId}
            node={deleteNode}
            onDeleted={handleDeleteConfirmed}
            onCancel={handleDeleteCancelled}
          />
        )}

        {/* Assign Story Beat Modal */}
        {assignStoryBeat && (
          <AssignStoryBeatModal
            storyBeatTitle={assignStoryBeat.title}
            beats={allBeats}
            onAssign={handleAssignStoryBeatToBeat}
            onCancel={() => setAssignStoryBeat(null)}
            saving={savingAssignment}
          />
        )}

        {/* Assign Scene Modal */}
        {assignScene && (
          <AssignSceneModal
            sceneHeading={assignScene.heading || 'Untitled Scene'}
            storyBeats={allStoryBeats}
            onAssign={handleAssignSceneToStoryBeat}
            onCancel={() => setAssignScene(null)}
            saving={savingAssignment}
          />
        )}
      </CollapsibleSection>
    </StructureEditContext.Provider>
  );
}
