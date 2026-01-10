import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type {
  NodeData,
  NodeRelationsData,
  EdgeData,
  CreateEdgeRequest,
  EdgeProperties,
  EdgeStatus,
  EdgeType,
} from '../../api/types';
import { NodeDetailPanel } from '../explore/NodeDetailPanel';
import { NodeEditor } from '../explore/NodeEditor';
import { PatchBuilder } from '../explore/PatchBuilder';
import { CommitPanel } from '../explore/CommitPanel';
import { EditEdgeModal } from '../explore/EditEdgeModal';
import { AddRelationModal } from '../explore/AddRelationModal';
import { DeleteNodeModal } from '../explore/DeleteNodeModal';
import { EdgePatchBuilder, PendingEdgeOp } from '../explore/EdgePatchBuilder';
import { InteractiveEdgeData, BulkAttachConfig } from '../explore/NodeRelations';
import { useLint } from '../../hooks/useLint';
import { useBulkAttach } from '../../hooks/useBulkAttach';
import { LintPanel } from '../lint/LintPanel';
import { PreCommitModal } from '../lint/PreCommitModal';
import { BulkAttachModal } from '../bulk-attach';
import { EDGE_TEMPLATES } from '../../config/edgeTemplates';
import styles from './NodeDetailModal.module.css';

function isOrderedEdgeType(edgeType: EdgeType): boolean {
  const template = EDGE_TEMPLATES[edgeType];
  return !!template.properties.order;
}

interface NodeDetailModalProps {
  node: NodeData;
  allNodes: NodeData[];
  onClose: () => void;
  onNodeUpdated: () => void;
  onNodeDeleted: () => void;
}

export function NodeDetailModal({
  node,
  allNodes,
  onClose,
  onNodeUpdated,
  onNodeDeleted,
}: NodeDetailModalProps) {
  const {
    currentStoryId,
    clusterLoading,
    generateScopedCluster,
    acceptMove,
    refreshStatus,
  } = useStory();

  // Node relations state
  const [nodeRelations, setNodeRelations] = useState<NodeRelationsData | null>(null);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [fullEdges, setFullEdges] = useState<EdgeData[]>([]);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editChanges, setEditChanges] = useState<Record<string, unknown>>({});
  const [committing, setCommitting] = useState(false);

  // Edge editing state
  const [editingEdge, setEditingEdge] = useState<EdgeData | null>(null);
  const [addEdgeDirection, setAddEdgeDirection] = useState<'outgoing' | 'incoming' | null>(null);
  const [pendingEdgeOps, setPendingEdgeOps] = useState<PendingEdgeOp[]>([]);
  const [edgeCommitting, setEdgeCommitting] = useState(false);

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
      void loadNodeData();
      void refreshStatus();
    },
  });

  // Keep acceptMove reference
  void acceptMove;

  // Fetch full edges for a node
  const fetchFullEdges = useCallback(async (nodeId: string): Promise<EdgeData[]> => {
    if (!currentStoryId) return [];

    try {
      const [outgoingEdges, incomingEdges] = await Promise.all([
        api.listEdges(currentStoryId, { from: nodeId }),
        api.listEdges(currentStoryId, { to: nodeId }),
      ]);

      const edgeMap = new Map<string, EdgeData>();
      outgoingEdges.edges.forEach(e => edgeMap.set(e.id, e));
      incomingEdges.edges.forEach(e => edgeMap.set(e.id, e));
      return Array.from(edgeMap.values());
    } catch (err) {
      console.error('Failed to load full edge data:', err);
      return [];
    }
  }, [currentStoryId]);

  // Load node data
  const loadNodeData = useCallback(async () => {
    if (!currentStoryId) return;

    setRelationsLoading(true);
    try {
      const [relationsData, edgesData] = await Promise.all([
        api.getNodeRelations(currentStoryId, node.id),
        fetchFullEdges(node.id),
      ]);
      setNodeRelations(relationsData);
      setFullEdges(edgesData);
    } catch (err) {
      console.error('Failed to load node data:', err);
    } finally {
      setRelationsLoading(false);
    }
  }, [currentStoryId, node.id, fetchFullEdges]);

  useEffect(() => {
    void loadNodeData();
  }, [loadNodeData]);

  // Generate handler
  const handleGenerate = useCallback(() => {
    void generateScopedCluster(node.id);
  }, [node.id, generateScopedCluster]);

  // Edit handlers
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditChanges({});
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditChanges({});
  }, []);

  const handleDeleteNode = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleNodeDeletedInternal = useCallback(() => {
    setShowDeleteModal(false);
    onNodeDeleted();
    onClose();
  }, [onNodeDeleted, onClose]);

  const handleSaveChanges = useCallback((changes: Record<string, unknown>) => {
    setEditChanges(changes);
    lint.markNodeTouched(node.id);
  }, [node.id, lint]);

  // Commit
  const doCommit = useCallback(async () => {
    if (!currentStoryId || Object.keys(editChanges).length === 0) {
      return;
    }

    setCommitting(true);
    try {
      await api.updateNode(currentStoryId, node.id, editChanges);
      const data = await api.getNodeRelations(currentStoryId, node.id);
      setNodeRelations(data);
      setIsEditing(false);
      setEditChanges({});
      lint.clearTouchedScope();
      onNodeUpdated();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to commit changes:', err);
      throw err;
    } finally {
      setCommitting(false);
    }
  }, [currentStoryId, node.id, editChanges, lint, onNodeUpdated, refreshStatus]);

  const handleCommit = useCallback(async () => {
    if (!currentStoryId || Object.keys(editChanges).length === 0) {
      return;
    }

    const result = await lint.checkPreCommit();
    if (result) {
      if (!result.canCommit || result.warningCount > 0) {
        setShowPreCommitModal(true);
        return;
      }
    }

    await doCommit();
  }, [currentStoryId, editChanges, lint, doCommit]);

  // Edge handlers
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

  const handleBulkAttach = useCallback((config: BulkAttachConfig) => {
    const ordered = isOrderedEdgeType(config.edgeType);
    const singleSelect = config.edgeType === 'LOCATED_AT' || config.edgeType === 'ALIGNS_WITH';

    bulkAttach.openModal({
      parentId: node.id,
      edgeType: config.edgeType,
      direction: config.direction,
      ordered,
      singleSelect,
      existingEdges: config.existingEdges,
    });
  }, [node.id, bulkAttach]);

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

      setPendingEdgeOps([]);
      void loadNodeData();
      void refreshStatus();
    } catch (err) {
      console.error('Failed to commit edge changes:', err);
    } finally {
      setEdgeCommitting(false);
    }
  }, [currentStoryId, pendingEdgeOps, loadNodeData, refreshStatus]);

  // Interactive edges
  const interactiveEdges = useMemo(() => {
    if (!nodeRelations) return { outgoing: [] as InteractiveEdgeData[], incoming: [] as InteractiveEdgeData[] };

    const outgoing: InteractiveEdgeData[] = nodeRelations.outgoing.map(rel => {
      const fullEdge = fullEdges.find(e => e.from === rel.source && e.to === rel.target && e.type === rel.type);
      const result: InteractiveEdgeData = { ...rel };
      if (fullEdge?.id !== undefined) result.edgeId = fullEdge.id;
      if (fullEdge?.properties !== undefined) result.properties = fullEdge.properties;
      if (fullEdge?.status !== undefined) result.status = fullEdge.status;
      return result;
    });

    const incoming: InteractiveEdgeData[] = nodeRelations.incoming.map(rel => {
      const fullEdge = fullEdges.find(e => e.from === rel.source && e.to === rel.target && e.type === rel.type);
      const result: InteractiveEdgeData = { ...rel };
      if (fullEdge?.id !== undefined) result.edgeId = fullEdge.id;
      if (fullEdge?.properties !== undefined) result.properties = fullEdge.properties;
      if (fullEdge?.status !== undefined) result.status = fullEdge.status;
      return result;
    });

    return { outgoing, incoming };
  }, [nodeRelations, fullEdges]);

  // Get the current node data (may have been updated)
  const currentNode = nodeRelations?.node ?? node;

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isEditing) {
      onClose();
    }
  }, [isEditing, onClose]);

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>{currentNode.label}</h2>
            <span className={styles.typeTag}>{currentNode.type}</span>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            disabled={isEditing}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {relationsLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : isEditing && nodeRelations ? (
            <div className={styles.editMode}>
              <NodeEditor
                node={currentNode}
                onSave={handleSaveChanges}
                onCancel={handleCancelEdit}
                saving={committing}
              />
              {Object.keys(editChanges).length > 0 && (
                <>
                  <PatchBuilder
                    nodeId={currentNode.id}
                    nodeType={currentNode.type}
                    changes={editChanges}
                    originalData={currentNode.data}
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
                    nodeType={currentNode.type}
                    changes={editChanges}
                    onCommit={handleCommit}
                    onCancel={handleCancelEdit}
                    committing={committing}
                  />
                </>
              )}
            </div>
          ) : nodeRelations ? (
            <>
              <NodeDetailPanel
                relations={nodeRelations}
                loading={relationsLoading}
                onGenerate={handleGenerate}
                generating={clusterLoading}
                onEdit={handleStartEdit}
                onDelete={handleDeleteNode}
                onEditEdge={handleEditEdge}
                onDeleteEdge={handleDeleteEdge}
                onAddEdge={handleAddEdge}
                onBulkAttach={handleBulkAttach}
                fullEdges={interactiveEdges}
              />
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
            <div className={styles.error}>Failed to load node data</div>
          )}
        </div>
      </div>

      {/* Nested modals */}
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

      {addEdgeDirection && currentNode && (
        <AddRelationModal
          currentNode={currentNode}
          direction={addEdgeDirection}
          availableNodes={allNodes}
          onAdd={handleAddNewEdge}
          onCancel={() => setAddEdgeDirection(null)}
          saving={edgeCommitting}
        />
      )}

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

      {showDeleteModal && currentStoryId && (
        <DeleteNodeModal
          storyId={currentStoryId}
          node={currentNode}
          onDeleted={handleNodeDeletedInternal}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
