/**
 * AllChangesView - Consolidated view of all proposed changes from the staged package.
 * Groups changes by type (nodes, edges, story context) for easy review.
 */

import { useMemo, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import type { MergedNode, MergedEdge, MergedStoryContextChange } from '../../utils/stagingUtils';
import { InlineEditor } from './InlineEditor';
import styles from './AllChangesView.module.css';

export function AllChangesView() {
  const { currentStoryId } = useStory();
  const {
    stagedPackage,
    staging,
    updateEditedNode,
    removeProposedNode,
    acceptPackage,
    clearStaging,
    loading,
  } = useGeneration();

  // Compute all proposed changes organized by category
  const proposedChanges = useMemo(() => {
    if (!stagedPackage) {
      return {
        nodes: [] as MergedNode[],
        edges: [] as MergedEdge[],
        storyContext: [] as MergedStoryContextChange[],
      };
    }

    // Compute nodes
    const nodes: MergedNode[] = stagedPackage.changes.nodes
      .filter((nodeChange) => {
        const isRemoved = staging.removedNodeIds.has(nodeChange.node_id);
        return !isRemoved || nodeChange.operation !== 'add';
      })
      .map((nodeChange) => {
        const localEdits = staging.editedNodes.get(nodeChange.node_id);
        const data = { ...nodeChange.data, ...localEdits };
        return {
          id: nodeChange.node_id,
          type: nodeChange.node_type,
          label:
            (data.name as string) ??
            (data.title as string) ??
            (data.heading as string) ??
            nodeChange.node_type,
          data,
          _isProposed: true,
          _packageId: stagedPackage.id,
          _operation: nodeChange.operation,
          _previousData: nodeChange.previous_data,
        };
      });

    // Compute edges
    const edges: MergedEdge[] = stagedPackage.changes.edges.map((edgeChange) => ({
      id: `${edgeChange.edge_type}:${edgeChange.from}:${edgeChange.to}`,
      type: edgeChange.edge_type,
      from: edgeChange.from,
      to: edgeChange.to,
      fromName: edgeChange.from_name,
      toName: edgeChange.to_name,
      _isProposed: true,
      _packageId: stagedPackage.id,
      _operation: edgeChange.operation,
    }));

    // Compute story context changes
    const storyContext: MergedStoryContextChange[] = (
      stagedPackage.changes.storyContext ?? []
    ).map((change) => ({
      section: change.section,
      content: change.content,
      _isProposed: true,
      _packageId: stagedPackage.id,
      _operation: change.operation,
      _previousContent: change.previous_content,
    }));

    return { nodes, edges, storyContext };
  }, [stagedPackage, staging.editedNodes, staging.removedNodeIds]);

  // Handlers
  const handleEditNode = useCallback(
    (nodeId: string, updates: Partial<Record<string, unknown>>) => {
      updateEditedNode(nodeId, updates);
    },
    [updateEditedNode]
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      removeProposedNode(nodeId);
    },
    [removeProposedNode]
  );

  const handleAccept = useCallback(async () => {
    if (!currentStoryId || !stagedPackage) return;
    await acceptPackage(currentStoryId, stagedPackage.id);
  }, [currentStoryId, stagedPackage, acceptPackage]);

  const handleReject = useCallback(() => {
    clearStaging();
  }, [clearStaging]);

  // No package staged
  if (!stagedPackage) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>All Changes</h2>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>{'\u2728'}</div>
          <h3>No Package Staged</h3>
          <p>
            Generate proposals using the AI panel, then select a package to stage
            its changes for review.
          </p>
        </div>
      </div>
    );
  }

  const totalChanges =
    proposedChanges.nodes.length +
    proposedChanges.edges.length +
    proposedChanges.storyContext.length;

  // Group nodes by type for organized display
  const nodesByType = useMemo(() => {
    const groups: Record<string, MergedNode[]> = {};
    for (const node of proposedChanges.nodes) {
      if (!groups[node.type]) {
        groups[node.type] = [];
      }
      const nodeGroup = groups[node.type];
      if (nodeGroup) {
        nodeGroup.push(node);
      }
    }
    return groups;
  }, [proposedChanges.nodes]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>All Changes</h2>
          <span className={styles.packageName}>{stagedPackage.title}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.changeCount}>{totalChanges} changes</span>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Package Info */}
        <div className={styles.packageInfo}>
          <div className={styles.packageRationale}>
            <span className={styles.rationaleLabel}>Rationale:</span>
            <span className={styles.rationaleText}>{stagedPackage.rationale}</span>
          </div>
          <div className={styles.packageMeta}>
            <span className={styles.confidence}>
              {Math.round(stagedPackage.confidence * 100)}% confidence
            </span>
            {stagedPackage.style_tags && stagedPackage.style_tags.length > 0 && (
              <div className={styles.tags}>
                {stagedPackage.style_tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Story Context Changes */}
        {proposedChanges.storyContext.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>{'\uD83D\uDCC4'}</span>
              Story Context ({proposedChanges.storyContext.length})
            </h3>
            <div className={styles.changeList}>
              {proposedChanges.storyContext.map((change) => (
                <div key={change.section} className={styles.contextChange}>
                  <div className={styles.contextHeader}>
                    <span className={styles.contextSection}>{change.section}</span>
                    <span className={`${styles.opBadge} ${styles[change._operation]}`}>
                      {change._operation}
                    </span>
                  </div>
                  <p className={styles.contextContent}>{change.content}</p>
                  {change._previousContent && (
                    <p className={styles.contextPrevious}>
                      <span className={styles.previousLabel}>Previous:</span>{' '}
                      {change._previousContent}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Changes by Type */}
        {Object.entries(nodesByType).map(([nodeType, nodes]) => (
          <div key={nodeType} className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>
                {nodeType === 'Character'
                  ? '\uD83D\uDC64'
                  : nodeType === 'Location'
                  ? '\uD83D\uDCCD'
                  : nodeType === 'Scene'
                  ? '\uD83C\uDFAC'
                  : nodeType === 'PlotPoint'
                  ? '\uD83D\uDCCB'
                  : nodeType === 'Beat'
                  ? '\uD83C\uDFB5'
                  : '\uD83D\uDCE6'}
              </span>
              {nodeType}s ({nodes.length})
            </h3>
            <div className={styles.changeList}>
              {nodes.map((node) => (
                <InlineEditor
                  key={node.id}
                  node={node}
                  onEdit={handleEditNode}
                  onRemove={
                    node._operation === 'add' ? handleRemoveNode : undefined
                  }
                  isRemoved={staging.removedNodeIds.has(node.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Edge Changes */}
        {proposedChanges.edges.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>{'\u2194'}</span>
              Connections ({proposedChanges.edges.length})
            </h3>
            <div className={styles.edgeList}>
              {proposedChanges.edges.map((edge) => (
                <div key={edge.id} className={styles.edgeChange}>
                  <span className={`${styles.opBadge} ${styles[edge._operation]}`}>
                    {edge._operation === 'add' ? '+' : '-'}
                  </span>
                  <span className={styles.edgeType}>{edge.type}</span>
                  <span className={styles.edgeNodes}>
                    {edge.fromName ?? edge.from} {'\u2192'} {edge.toName ?? edge.to}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className={styles.footer}>
        <button
          className={styles.rejectButton}
          onClick={handleReject}
          disabled={loading}
          type="button"
        >
          Reject Package
        </button>
        <button
          className={styles.acceptButton}
          onClick={handleAccept}
          disabled={loading}
          type="button"
        >
          {loading ? 'Applying...' : 'Accept & Apply'}
        </button>
      </div>
    </div>
  );
}
