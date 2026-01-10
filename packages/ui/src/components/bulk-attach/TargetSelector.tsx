/**
 * TargetSelector - Multi-select list with search and filter.
 * Left panel of the BulkAttachModal.
 */

import { useState, useMemo, useCallback } from 'react';
import type { NodeData, EdgeData, EdgeType } from '../../api/types';
import styles from './BulkAttachModal.module.css';

// Edge types where parent is the target (not the source)
// Currently empty - all remaining edge types have parent as source
const PARENT_IS_TARGET_EDGE_TYPES: EdgeType[] = [];

interface TargetSelectorProps {
  nodes: NodeData[];
  selectedIds: Set<string>;
  allowedTypes: string[];
  edgeType: EdgeType;
  parentId: string;
  allEdges: EdgeData[];
  singleSelect: boolean;
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
}

export function TargetSelector({
  nodes,
  selectedIds,
  allowedTypes,
  edgeType,
  parentId,
  allEdges,
  singleSelect,
  onSelect,
  onDeselect,
}: TargetSelectorProps) {
  const [search, setSearch] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  // Determine if parent is target or source for this edge type
  const parentIsTarget = PARENT_IS_TARGET_EDGE_TYPES.includes(edgeType);

  // Build a map of which nodes are assigned to other parents
  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>(); // nodeId -> parentId
    for (const edge of allEdges) {
      if (edge.type !== edgeType) continue;
      const edgeParent = parentIsTarget ? edge.to : edge.from;
      const edgeChild = parentIsTarget ? edge.from : edge.to;
      // Only track assignments to OTHER parents
      if (edgeParent !== parentId) {
        map.set(edgeChild, edgeParent);
      }
    }
    return map;
  }, [allEdges, edgeType, parentId, parentIsTarget]);

  // Filter nodes by allowed types
  const filteredByType = useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return nodes;
    }
    return nodes.filter((node) => allowedTypes.includes(node.type));
  }, [nodes, allowedTypes]);

  // Further filter by search query
  const filteredBySearch = useMemo(() => {
    if (!search.trim()) {
      return filteredByType;
    }
    const query = search.toLowerCase();
    return filteredByType.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query)
    );
  }, [filteredByType, search]);

  // Apply "unassigned only" filter
  const filteredNodes = useMemo(() => {
    if (!showUnassignedOnly) {
      return filteredBySearch;
    }
    return filteredBySearch.filter((node) => !assignmentMap.has(node.id));
  }, [filteredBySearch, showUnassignedOnly, assignmentMap]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      if (selectedIds.has(nodeId)) {
        onDeselect(nodeId);
      } else {
        onSelect(nodeId);
      }
    },
    [selectedIds, onSelect, onDeselect]
  );

  return (
    <>
      <div className={styles.searchWrapper}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.filterToggle}>
        <input
          type="checkbox"
          id="showUnassigned"
          checked={showUnassignedOnly}
          onChange={(e) => setShowUnassignedOnly(e.target.checked)}
        />
        <label htmlFor="showUnassigned">Show unassigned only</label>
      </div>

      <div className={styles.panelContent}>
        {filteredNodes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyText}>
              {search ? 'No matching items' : 'No items available'}
            </div>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedIds.has(node.id);
            const assignedTo = assignmentMap.get(node.id);
            const isDisabled = singleSelect && selectedIds.size > 0 && !isSelected;

            return (
              <div
                key={node.id}
                className={`${styles.targetItem} ${isSelected ? styles.targetItemSelected : ''} ${isDisabled ? styles.targetItemDisabled : ''}`}
                onClick={() => !isDisabled && handleToggle(node.id)}
              >
                <input
                  type="checkbox"
                  className={styles.targetCheckbox}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => handleToggle(node.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className={styles.targetInfo}>
                  <span className={styles.targetLabel}>
                    {node.label}
                    <span className={styles.targetType}>{node.type}</span>
                  </span>
                  {assignedTo && (
                    <div className={styles.targetAssigned}>
                      Attached elsewhere
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
