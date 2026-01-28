import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData, NodeRelationsData, EdgeData, CreateEdgeRequest, EdgeProperties, EdgeStatus, EdgeType } from '../../api/types';
import { NodeTypeFilter, type NodeTypeOption } from './NodeTypeFilter';
import { NodeList } from './NodeList';
import { NodeDetailPanel } from './NodeDetailPanel';
import { NodeEditor } from './NodeEditor';
import { PatchBuilder } from './PatchBuilder';
import { CommitPanel } from './CommitPanel';
import { PatchPreview } from '../preview/PatchPreview';
import { ValidationStatus } from '../preview/ValidationStatus';
import { EditEdgeModal } from './EditEdgeModal';
import { AddRelationModal } from './AddRelationModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { EdgePatchBuilder, PendingEdgeOp } from './EdgePatchBuilder';
import { InteractiveEdgeData, BulkAttachConfig } from './NodeRelations';
import { useLint } from '../../hooks/useLint';
import { useBulkAttach } from '../../hooks/useBulkAttach';
import { LintPanel } from '../lint/LintPanel';
import { PreCommitModal } from '../lint/PreCommitModal';
import { BulkAttachModal } from '../bulk-attach';
import { EDGE_TEMPLATES } from '../../config/edgeTemplates';
import styles from './ExploreView.module.css';

// Determine if an edge type uses ordering
function isOrderedEdgeType(edgeType: EdgeType): boolean {
  const template = EDGE_TEMPLATES[edgeType];
  return !!template.properties.order;
}

export function ExploreView() {
  const {
    currentStoryId,
    status,
    cluster,
    clusterLoading,
    scopedNodeId,
    selectedMoveId,
    preview,
    // cluster/move UI removed
    loading,
    refreshStatus,
  } = useStory();

  // Local explore state
  const [selectedType, setSelectedType] = useState<NodeTypeOption>('Character');
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeRelations, setNodeRelations] = useState<NodeRelationsData | null>(null);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editChanges, setEditChanges] = useState<Record<string, unknown>>({});
  const [committing, setCommitting] = useState(false);

  // Edge editing state
  const [editingEdge, setEditingEdge] = useState<EdgeData | null>(null);
  const [addEdgeDirection, setAddEdgeDirection] = useState<'outgoing' | 'incoming' | null>(null);
  const [pendingEdgeOps, setPendingEdgeOps] = useState<PendingEdgeOp[]>([]);
  const [edgeCommitting, setEdgeCommitting] = useState(false);
  const [fullEdges, setFullEdges] = useState<EdgeData[]>([]);
  const [allNodes, setAllNodes] = useState<NodeData[]>([]);

  // Delete node state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Lint state
  const [showPreCommitModal, setShowPreCommitModal] = useState(false);
  const lint = useLint({
    storyId: currentStoryId ?? '',
    autoLintEnabled: isEditing,
  });

  // Bulk attach state
  const bulkAttach = useBulkAttach({
    storyId: currentStoryId ?? '',
    onSuccess: () => {
      // Refresh current node after bulk attach
      if (selectedNodeId) {
        void selectNode(selectedNodeId);
      }
      void refreshStatus();
    },
  });

  // Fetch nodes when story or type changes
  const fetchNodes = useCallback(async () => {
    if (!currentStoryId) return;

    setNodesLoading(true);
    setError(null);

    try {
      const data = await api.listNodes(currentStoryId, selectedType);
      setNodes(data.nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes');
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, [currentStoryId, selectedType]);

  useEffect(() => {
    void fetchNodes();
    setSelectedNodeId(null);
    setNodeRelations(null);
  }, [fetchNodes]);

  // Fetch full edge data for a node (for interactive editing)
  const fetchFullEdges = useCallback(async (nodeId: string): Promise<EdgeData[]> => {
    if (!currentStoryId) return [];

    try {
      const [outgoingEdges, incomingEdges] = await Promise.all([
        api.listEdges(currentStoryId, { from: nodeId }),
        api.listEdges(currentStoryId, { to: nodeId }),
      ]);

      // Combine edges without duplicates
      const edgeMap = new Map<string, EdgeData>();
      outgoingEdges.edges.forEach(e => edgeMap.set(e.id, e));
      incomingEdges.edges.forEach(e => edgeMap.set(e.id, e));
      return Array.from(edgeMap.values());
    } catch (err) {
      console.error('Failed to load full edge data:', err);
      return [];
    }
  }, [currentStoryId]);

  // Fetch relations when node selected
  const selectNode = useCallback(async (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setFullEdges([]); // Reset edges on new selection

    if (!nodeId || !currentStoryId) {
      setNodeRelations(null);
      return;
    }

    setRelationsLoading(true);

    try {
      // Fetch relations and full edges in parallel
      const [relationsData, edgesData] = await Promise.all([
        api.getNodeRelations(currentStoryId, nodeId),
        fetchFullEdges(nodeId),
      ]);
      setNodeRelations(relationsData);
      setFullEdges(edgesData);
    } catch (err) {
      console.error('Failed to load node data:', err);
      setNodeRelations(null);
      setFullEdges([]);
    } finally {
      setRelationsLoading(false);
    }
  }, [currentStoryId, fetchFullEdges]);

  // Fetch all nodes for the node picker (used when adding relations)
  useEffect(() => {
    const fetchAllNodes = async () => {
      if (!currentStoryId) return;
      try {
        // Fetch nodes of all types for the picker
        const types = ['Beat', 'Scene', 'Character', 'Location', 'CharacterArc', 'Object', 'StoryBeat'];
        const results = await Promise.all(
          types.map(type => api.listNodes(currentStoryId, type).catch(() => ({ nodes: [] })))
        );
        const all = results.flatMap(r => r.nodes);
        setAllNodes(all);
      } catch (err) {
        console.error('Failed to load all nodes:', err);
      }
    };
    void fetchAllNodes();
  }, [currentStoryId]);

  // Handle generate for selected node
  // Cluster/move actions removed

  // Handle entering edit mode
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditChanges({});
  }, []);

  // Handle canceling edit mode
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditChanges({});
  }, []);

  // Handle delete node
  const handleDeleteNode = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  // Handle successful node deletion
  const handleNodeDeleted = useCallback(() => {
    setShowDeleteModal(false);
    setSelectedNodeId(null);
    setNodeRelations(null);
    void fetchNodes();
    void refreshStatus();
  }, [fetchNodes, refreshStatus]);

  // Handle saving node changes
  const handleSaveChanges = useCallback((changes: Record<string, unknown>) => {
    setEditChanges(changes);
    // Mark the node as touched for lint
    if (selectedNodeId) {
      lint.markNodeTouched(selectedNodeId);
    }
  }, [selectedNodeId, lint]);

  // Perform the actual commit (called after pre-commit check passes)
  const doCommit = useCallback(async () => {
    if (!currentStoryId || !selectedNodeId || Object.keys(editChanges).length === 0) {
      return;
    }

    setCommitting(true);
    try {
      await api.updateNode(currentStoryId, selectedNodeId, editChanges);
      // Refresh the node data
      const data = await api.getNodeRelations(currentStoryId, selectedNodeId);
      setNodeRelations(data);
      // Exit edit mode
      setIsEditing(false);
      setEditChanges({});
      lint.clearTouchedScope();
      // Refresh node list to show updated label
      void fetchNodes();
      // Refresh status to update stats in tabs
      void refreshStatus();
    } catch (err) {
      console.error('Failed to commit changes:', err);
      throw err; // Let CommitPanel handle the error
    } finally {
      setCommitting(false);
    }
  }, [currentStoryId, selectedNodeId, editChanges, fetchNodes, lint, refreshStatus]);

  // Handle committing changes (with pre-commit lint check)
  const handleCommit = useCallback(async () => {
    if (!currentStoryId || !selectedNodeId || Object.keys(editChanges).length === 0) {
      return;
    }

    // Run pre-commit lint check
    const result = await lint.checkPreCommit();
    if (result) {
      // Show modal if there are blocking errors OR warnings
      if (!result.canCommit || result.warningCount > 0) {
        setShowPreCommitModal(true);
        return;
      }
    }

    // No violations at all, proceed with commit
    await doCommit();
  }, [currentStoryId, selectedNodeId, editChanges, lint, doCommit]);

  // Edge editing handlers
  const handleEditEdge = useCallback((edge: EdgeData) => {
    setEditingEdge(edge);
  }, []);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    const edge = fullEdges.find(e => e.id === edgeId);
    if (!edge) return;

    setPendingEdgeOps(prev => [...prev, {
      op: 'DELETE_EDGE',
      edgeId: edge.id,
      edgeType: edge.type,
      from: edge.from,
      to: edge.to,
    }]);
  }, [fullEdges]);

  const handleAddEdge = useCallback((direction: 'outgoing' | 'incoming') => {
    setAddEdgeDirection(direction);
  }, []);

  const handleSaveEdge = useCallback((edgeId: string, changes: { properties?: EdgeProperties | undefined; status?: EdgeStatus | undefined }) => {
    const edge = fullEdges.find(e => e.id === edgeId);
    if (!edge) return;

    const pendingChanges: { properties?: EdgeProperties; status?: EdgeStatus } = {};
    if (changes.properties !== undefined) {
      pendingChanges.properties = changes.properties;
    }
    if (changes.status !== undefined) {
      pendingChanges.status = changes.status;
    }

    setPendingEdgeOps(prev => [...prev, {
      op: 'UPDATE_EDGE',
      edgeId,
      edgeType: edge.type,
      from: edge.from,
      to: edge.to,
      changes: pendingChanges,
    }]);
    setEditingEdge(null);
  }, [fullEdges]);

  const handleAddNewEdge = useCallback((edgeRequest: CreateEdgeRequest) => {
    setPendingEdgeOps(prev => [...prev, {
      op: 'ADD_EDGE',
      edge: edgeRequest,
    }]);
    setAddEdgeDirection(null);
  }, []);

  // Bulk attach handler
  const handleBulkAttach = useCallback((config: BulkAttachConfig) => {
    if (!selectedNodeId) return;

    // Determine if this is ordered (SATISFIED_BY, HAS_CHARACTER, etc.)
    const ordered = isOrderedEdgeType(config.edgeType);

    // Determine single-select mode (LOCATED_AT, ALIGNS_WITH are single)
    const singleSelect = config.edgeType === 'LOCATED_AT' || config.edgeType === 'ALIGNS_WITH';

    bulkAttach.openModal({
      parentId: selectedNodeId,
      edgeType: config.edgeType,
      direction: config.direction,
      ordered,
      singleSelect,
      existingEdges: config.existingEdges,
    });
  }, [selectedNodeId, bulkAttach]);

  const handleRemoveEdgeOp = useCallback((index: number) => {
    setPendingEdgeOps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDiscardEdgeOps = useCallback(() => {
    setPendingEdgeOps([]);
  }, []);

  const handleCommitEdgeOps = useCallback(async () => {
    if (!currentStoryId || pendingEdgeOps.length === 0) return;

    setEdgeCommitting(true);
    try {
      // Execute operations via batch endpoint
      const adds: CreateEdgeRequest[] = [];
      const updates: Array<{ id: string; set?: Partial<EdgeProperties>; status?: EdgeStatus }> = [];
      const deletes: string[] = [];

      for (const pendingOp of pendingEdgeOps) {
        if (pendingOp.op === 'ADD_EDGE') {
          adds.push(pendingOp.edge);
        } else if (pendingOp.op === 'UPDATE_EDGE') {
          const updateEntry: { id: string; set?: Partial<EdgeProperties>; status?: EdgeStatus } = {
            id: pendingOp.edgeId,
          };
          if (pendingOp.changes.properties !== undefined) {
            updateEntry.set = pendingOp.changes.properties;
          }
          if (pendingOp.changes.status !== undefined) {
            updateEntry.status = pendingOp.changes.status;
          }
          updates.push(updateEntry);
        } else if (pendingOp.op === 'DELETE_EDGE') {
          deletes.push(pendingOp.edgeId);
        }
      }

      await api.batchEdges(currentStoryId, { adds, updates, deletes });

      // Clear pending ops and refresh
      setPendingEdgeOps([]);
      if (selectedNodeId) {
        void selectNode(selectedNodeId);
      }
      // Refresh status to update edge count in stats
      void refreshStatus();
    } catch (err) {
      console.error('Failed to commit edge changes:', err);
    } finally {
      setEdgeCommitting(false);
    }
  }, [currentStoryId, pendingEdgeOps, selectedNodeId, selectNode, refreshStatus]);

  // Get selected node data for editor
  const selectedNode = useMemo(() => {
    if (!nodeRelations) return null;
    return nodeRelations.node;
  }, [nodeRelations]);

  // Convert full edges to interactive edge data for NodeRelations
  const interactiveEdges = useMemo(() => {
    if (!selectedNodeId || !nodeRelations) return { outgoing: [] as InteractiveEdgeData[], incoming: [] as InteractiveEdgeData[] };

    const outgoing: InteractiveEdgeData[] = nodeRelations.outgoing.map(rel => {
      const fullEdge = fullEdges.find(e => e.from === rel.source && e.to === rel.target && e.type === rel.type);
      const result: InteractiveEdgeData = { ...rel };
      if (fullEdge?.id !== undefined) {
        result.edgeId = fullEdge.id;
      }
      if (fullEdge?.properties !== undefined) {
        result.properties = fullEdge.properties;
      }
      if (fullEdge?.status !== undefined) {
        result.status = fullEdge.status;
      }
      return result;
    });

    const incoming: InteractiveEdgeData[] = nodeRelations.incoming.map(rel => {
      const fullEdge = fullEdges.find(e => e.from === rel.source && e.to === rel.target && e.type === rel.type);
      const result: InteractiveEdgeData = { ...rel };
      if (fullEdge?.id !== undefined) {
        result.edgeId = fullEdge.id;
      }
      if (fullEdge?.properties !== undefined) {
        result.properties = fullEdge.properties;
      }
      if (fullEdge?.status !== undefined) {
        result.status = fullEdge.status;
      }
      return result;
    });

    return { outgoing, incoming };
  }, [selectedNodeId, nodeRelations, fullEdges]);

  // Check if we have a cluster for the current selected node
  const hasClusterForNode = cluster && scopedNodeId === selectedNodeId;
  const canAccept = selectedMoveId && preview?.validation.valid;

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Contract tab to explore its nodes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Explore: {status?.name || currentStoryId}
        </h2>
      </div>

      <NodeTypeFilter
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        stats={status?.stats}
      />

      <div className={styles.content}>
        {/* Left: Node List */}
        <div className={styles.listPane}>
          {nodesLoading ? (
            <div className={styles.loading}>Loading nodes...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <NodeList
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={selectNode}
            />
          )}
        </div>

        {/* Center: Node Details + Actions OR Edit Mode */}
        <div className={styles.detailPane}>
          {isEditing && selectedNode ? (
            <div className={styles.editMode}>
              <NodeEditor
                node={selectedNode}
                onSave={handleSaveChanges}
                onCancel={handleCancelEdit}
                saving={committing}
              />
              {Object.keys(editChanges).length > 0 && (
                <>
                  <PatchBuilder
                    nodeId={selectedNode.id}
                    nodeType={selectedNode.type}
                    changes={editChanges}
                    originalData={selectedNode.data}
                  />
                  <LintPanel
                    violations={lint.violations}
                    fixes={lint.fixes}
                    errorCount={lint.errorCount}
                    warningCount={lint.warningCount}
                    isLinting={lint.isLinting}
                    lastCheckedAt={lint.lastCheckedAt}
                    scopeTruncated={lint.scopeTruncated}
                    onApplyFix={lint.applyFix}
                    onApplyAll={lint.applyAllFixes}
                    onRunFullLint={lint.runFullLint}
                  />
                  <CommitPanel
                    nodeType={selectedNode.type}
                    changes={editChanges}
                    onCommit={handleCommit}
                    onCancel={handleCancelEdit}
                    committing={committing}
                  />
                </>
              )}
            </div>
          ) : selectedNodeId && nodeRelations ? (
            <>
              <NodeDetailPanel
                relations={nodeRelations}
                loading={relationsLoading}
                onGenerate={() => { /* removed */ }}
                generating={false}
                onEdit={handleStartEdit}
                onDelete={handleDeleteNode}
                onEditEdge={handleEditEdge}
                onDeleteEdge={handleDeleteEdge}
                onAddEdge={handleAddEdge}
                onBulkAttach={handleBulkAttach}
                fullEdges={interactiveEdges}
              />
              {/* Edge pending changes preview */}
              {pendingEdgeOps.length > 0 && (
                <EdgePatchBuilder
                  operations={pendingEdgeOps}
                  onRemove={handleRemoveEdgeOp}
                  onCommit={handleCommitEdgeOps}
                  onDiscard={handleDiscardEdgeOps}
                  committing={edgeCommitting}
                />
              )}
            </>
          ) : (
            <div className={styles.noSelection}>
              <p>Select a node to view details</p>
            </div>
          )}
        </div>

        {/* Right pane reserved (cluster/move UI removed) */}
        <div className={styles.clusterPane} />
      </div>

      {/* Edge editing modals */}
      {editingEdge && (
        <EditEdgeModal
          edge={editingEdge}
          onSave={handleSaveEdge}
          onDelete={(edgeId) => {
            handleDeleteEdge(edgeId);
            setEditingEdge(null);
          }}
          onCancel={() => setEditingEdge(null)}
          saving={edgeCommitting}
        />
      )}

      {addEdgeDirection && selectedNode && (
        <AddRelationModal
          currentNode={selectedNode}
          direction={addEdgeDirection}
          availableNodes={allNodes}
          onAdd={handleAddNewEdge}
          onCancel={() => setAddEdgeDirection(null)}
          saving={edgeCommitting}
        />
      )}

      {/* Pre-commit lint modal */}
      <PreCommitModal
        isOpen={showPreCommitModal}
        violations={lint.violations}
        fixes={lint.fixes}
        errorCount={lint.errorCount}
        applying={lint.isLinting}
        onApplyFix={lint.applyFix}
        onApplyAll={lint.applyAllFixes}
        onClose={() => setShowPreCommitModal(false)}
        onProceed={!lint.hasBlockingErrors ? () => { void doCommit(); } : undefined}
      />

      {/* Bulk attach modal */}
      <BulkAttachModal
        isOpen={bulkAttach.isOpen}
        config={bulkAttach.config}
        storyId={currentStoryId ?? ''}
        selectedTargets={bulkAttach.selectedTargets}
        changes={bulkAttach.changes}
        isSaving={bulkAttach.isSaving}
        error={bulkAttach.error}
        onAddTarget={bulkAttach.addTarget}
        onRemoveTarget={bulkAttach.removeTarget}
        onReorderTargets={bulkAttach.reorderTargets}
        onSave={bulkAttach.save}
        onClose={bulkAttach.closeModal}
      />

      {/* Delete node modal */}
      {showDeleteModal && selectedNode && currentStoryId && (
        <DeleteNodeModal
          storyId={currentStoryId}
          node={selectedNode}
          onDeleted={handleNodeDeleted}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
