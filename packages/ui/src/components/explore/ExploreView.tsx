import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData, NodeRelationsData } from '../../api/types';
import { NodeTypeFilter, type NodeTypeOption } from './NodeTypeFilter';
import { NodeList } from './NodeList';
import { NodeDetailPanel } from './NodeDetailPanel';
import { NodeEditor } from './NodeEditor';
import { PatchBuilder } from './PatchBuilder';
import { CommitPanel } from './CommitPanel';
import { ClusterCard } from '../clusters/ClusterCard';
import { PatchPreview } from '../preview/PatchPreview';
import { ValidationStatus } from '../preview/ValidationStatus';
import { InputPanel } from '../input/InputPanel';
import styles from './ExploreView.module.css';

export function ExploreView() {
  const {
    currentStoryId,
    status,
    cluster,
    clusterLoading,
    scopedNodeId,
    selectedMoveId,
    preview,
    generateScopedCluster,
    acceptMove,
    rejectAll,
    loading,
  } = useStory();

  // Local explore state
  const [selectedType, setSelectedType] = useState<NodeTypeOption>('Beat');
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

  // Fetch relations when node selected
  const selectNode = useCallback(async (nodeId: string | null) => {
    setSelectedNodeId(nodeId);

    if (!nodeId || !currentStoryId) {
      setNodeRelations(null);
      return;
    }

    setRelationsLoading(true);

    try {
      const data = await api.getNodeRelations(currentStoryId, nodeId);
      setNodeRelations(data);
    } catch (err) {
      console.error('Failed to load relations:', err);
      setNodeRelations(null);
    } finally {
      setRelationsLoading(false);
    }
  }, [currentStoryId]);

  // Handle generate for selected node
  const handleGenerate = useCallback(() => {
    if (selectedNodeId) {
      void generateScopedCluster(selectedNodeId);
    }
  }, [selectedNodeId, generateScopedCluster]);

  // Handle accept
  const handleAccept = useCallback(() => {
    void acceptMove();
  }, [acceptMove]);

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

  // Handle saving node changes
  const handleSaveChanges = useCallback((changes: Record<string, unknown>) => {
    setEditChanges(changes);
  }, []);

  // Handle committing changes
  const handleCommit = useCallback(async () => {
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
      // Refresh node list to show updated label
      void fetchNodes();
    } catch (err) {
      console.error('Failed to commit changes:', err);
      throw err; // Let CommitPanel handle the error
    } finally {
      setCommitting(false);
    }
  }, [currentStoryId, selectedNodeId, editChanges, fetchNodes]);

  // Get selected node data for editor
  const selectedNode = useMemo(() => {
    if (!nodeRelations) return null;
    return nodeRelations.node;
  }, [nodeRelations]);

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
            <NodeDetailPanel
              relations={nodeRelations}
              loading={relationsLoading}
              onGenerate={handleGenerate}
              generating={clusterLoading}
              onEdit={handleStartEdit}
            />
          ) : (
            <div className={styles.noSelection}>
              <p>Select a node to view details</p>
            </div>
          )}
        </div>

        {/* Right: Input Panel + Cluster + Preview */}
        <div className={styles.clusterPane}>
          {/* Input Panel for freeform extraction */}
          <InputPanel />

          {/* Cluster results when available */}
          {hasClusterForNode ? (
            <div className={styles.clusterContent}>
              <div className={styles.clusterHeader}>
                <h3>Generated Moves</h3>
                <button
                  className={styles.rejectBtn}
                  onClick={rejectAll}
                  type="button"
                >
                  Clear
                </button>
              </div>

              {/* Use context-based ClusterCard which renders MoveCards internally */}
              <ClusterCard />

              {selectedMoveId && (
                <div className={styles.previewSection}>
                  <PatchPreview />
                  <ValidationStatus />
                  <button
                    className={styles.acceptBtn}
                    onClick={handleAccept}
                    disabled={!canAccept || loading}
                    type="button"
                  >
                    {loading ? 'Accepting...' : 'Accept Move'}
                  </button>
                </div>
              )}
            </div>
          ) : clusterLoading ? (
            <div className={styles.loading}>Generating moves...</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
