/**
 * BulkAttachModal - Main modal for bulk attaching entities.
 *
 * Features:
 * - Two-panel layout: Available (left) and Selected (right)
 * - Multi-select with search and filter
 * - Drag-to-reorder for ordered relations
 * - Change summary before save
 */

import { useCallback, useMemo, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { NodeData, EdgeData, EdgeType, BulkAttachData } from '../../api/types';
import type { SelectedTarget, BulkAttachModalConfig } from '../../hooks/useBulkAttach';
import { EDGE_TEMPLATES } from '../../config/edgeTemplates';
import { TargetSelector } from './TargetSelector';
import { OrderableList } from './OrderableList';
import styles from './BulkAttachModal.module.css';

// Edge types where parent is the target (not the source)
const PARENT_IS_TARGET_EDGE_TYPES: EdgeType[] = ['FULFILLS', 'EXPRESSED_IN', 'APPEARS_IN'];

interface BulkAttachModalProps {
  isOpen: boolean;
  config: BulkAttachModalConfig | null;
  storyId: string;
  selectedTargets: SelectedTarget[];
  changes: {
    toAdd: SelectedTarget[];
    toUpdate: SelectedTarget[];
    toRemove: string[];
    hasChanges: boolean;
  };
  isSaving: boolean;
  error: string | null;
  onAddTarget: (target: SelectedTarget) => void;
  onRemoveTarget: (targetId: string) => void;
  onReorderTargets: (orderedIds: string[]) => void;
  onSave: (detachOthers?: boolean) => Promise<BulkAttachData | null>;
  onClose: () => void;
}

export function BulkAttachModal({
  isOpen,
  config,
  storyId,
  selectedTargets,
  changes,
  isSaving,
  error,
  onAddTarget,
  onRemoveTarget,
  onReorderTargets,
  onSave,
  onClose,
}: BulkAttachModalProps) {
  // Fetch available nodes for selection
  const [availableNodes, setAvailableNodes] = useState<NodeData[]>([]);
  const [allEdges, setAllEdges] = useState<EdgeData[]>([]);
  const [loading, setLoading] = useState(false);

  // Determine target types based on edge type and parent position
  const targetTypes = useMemo(() => {
    if (!config?.edgeType) return [];
    const template = EDGE_TEMPLATES[config.edgeType];
    const parentIsTarget = PARENT_IS_TARGET_EDGE_TYPES.includes(config.edgeType);
    // If parent is target, we're selecting sources; otherwise targets
    return parentIsTarget ? template.sourceTypes : template.targetTypes;
  }, [config?.edgeType]);

  // Fetch nodes when modal opens
  useEffect(() => {
    if (!isOpen || !config) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all nodes for target types
        const nodePromises = targetTypes.map((type) =>
          api.listNodes(storyId, type, 100)
        );
        const nodeResults = await Promise.all(nodePromises);
        const allNodes = nodeResults.flatMap((r) => r.nodes);
        setAvailableNodes(allNodes);

        // Fetch all edges of this type for assignment info
        const edgesResult = await api.listEdges(storyId, { type: config.edgeType });
        setAllEdges(edgesResult.edges);
      } catch (err) {
        console.error('Failed to fetch nodes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, storyId, config, targetTypes]);

  // Build node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    for (const node of availableNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [availableNodes]);

  // Selected IDs set
  const selectedIds = useMemo(() => {
    return new Set(selectedTargets.map((t) => t.id));
  }, [selectedTargets]);

  // Handle select
  const handleSelect = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      onAddTarget({ id: nodeId });
    },
    [nodeMap, onAddTarget]
  );

  // Handle deselect
  const handleDeselect = useCallback(
    (nodeId: string) => {
      onRemoveTarget(nodeId);
    },
    [onRemoveTarget]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    await onSave(true); // detachOthers = true for sync mode
  }, [onSave]);

  // Modal title
  const title = useMemo(() => {
    if (!config) return 'Bulk Attach';
    const template = EDGE_TEMPLATES[config.edgeType];
    return `Manage: ${template.label}`;
  }, [config]);

  if (!isOpen || !config) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {title}
            <span className={styles.subtitle}>{config.edgeType}</span>
          </h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {/* Left panel - Available items */}
          <div className={`${styles.panel} ${styles.panelLeft}`}>
            <div className={styles.panelHeader}>
              <h4 className={styles.panelTitle}>Available</h4>
              <span className={styles.panelCount}>
                {availableNodes.length}
              </span>
            </div>
            {loading ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>Loading...</div>
              </div>
            ) : (
              <TargetSelector
                nodes={availableNodes}
                selectedIds={selectedIds}
                allowedTypes={targetTypes}
                edgeType={config.edgeType}
                parentId={config.parentId}
                allEdges={allEdges}
                singleSelect={config.singleSelect ?? false}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
              />
            )}
          </div>

          {/* Right panel - Selected items */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h4 className={styles.panelTitle}>Selected</h4>
              <span className={styles.panelCount}>
                {selectedTargets.length}
              </span>
            </div>
            <div className={styles.panelContent}>
              <OrderableList
                items={selectedTargets}
                nodes={nodeMap}
                ordered={config.ordered ?? false}
                onReorder={onReorderTargets}
                onRemove={handleDeselect}
              />
            </div>
          </div>
        </div>

        {/* Change summary */}
        <div className={styles.summary}>
          <div className={styles.changeSummary}>
            <span className={`${styles.changeItem} ${changes.toAdd.length > 0 ? styles.adding : ''}`}>
              <span className={styles.changeCount}>+{changes.toAdd.length}</span> adding
            </span>
            <span className={`${styles.changeItem} ${changes.toUpdate.length > 0 ? styles.updating : ''}`}>
              <span className={styles.changeCount}>~{changes.toUpdate.length}</span> updating
            </span>
            <span className={`${styles.changeItem} ${changes.toRemove.length > 0 ? styles.removing : ''}`}>
              <span className={styles.changeCount}>-{changes.toRemove.length}</span> removing
            </span>
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>{error}</div>
        )}

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!changes.hasChanges || isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
