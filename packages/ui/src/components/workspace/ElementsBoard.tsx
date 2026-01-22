/**
 * ElementsBoard - Grid view of all story elements grouped by type.
 * Displays Characters, Locations, and Objects as cards in responsive grids.
 * Proposed elements from staged packages are merged inline with existing elements.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import type { ElementType } from './types';
import type { MergedNode } from '../../utils/stagingUtils';
import { ElementCard } from './ElementCard';
import { ProposedElementCard } from './ProposedElementCard';
import styles from './ElementsBoard.module.css';

interface ElementsBoardProps {
  onElementClick: (elementId: string, elementType: ElementType) => void;
  onAddElement?: (type: ElementType) => void;
}

interface ElementSection {
  type: ElementType;
  label: string;
  icon: string;
  nodes: NodeData[];
  proposedNodes: MergedNode[];
}

// Element node types
const ELEMENT_NODE_TYPES = ['Character', 'Location', 'Object'];

export function ElementsBoard({ onElementClick, onAddElement }: ElementsBoardProps) {
  const { currentStoryId, status } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode } = useGeneration();
  const [baseSections, setBaseSections] = useState<Omit<ElementSection, 'proposedNodes'>[]>([
    { type: 'Character', label: 'Characters', icon: '\uD83D\uDC64', nodes: [] },
    { type: 'Location', label: 'Locations', icon: '\uD83D\uDCCD', nodes: [] },
    { type: 'Object', label: 'Objects', icon: '\uD83D\uDCE6', nodes: [] },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);

  // Compute proposed element nodes grouped by type
  const proposedElementsByType = useMemo((): Map<string, MergedNode[]> => {
    const byType = new Map<string, MergedNode[]>();
    if (!stagedPackage) return byType;

    for (const nodeChange of stagedPackage.changes.nodes) {
      if (ELEMENT_NODE_TYPES.includes(nodeChange.node_type)) {
        const localEdits = staging.editedNodes.get(nodeChange.node_id);
        const isRemoved = staging.removedNodeIds.has(nodeChange.node_id);
        if (!isRemoved || nodeChange.operation !== 'add') {
          const data = { ...nodeChange.data, ...localEdits };
          const node: MergedNode = {
            id: nodeChange.node_id,
            type: nodeChange.node_type,
            label: (data.name as string) ?? nodeChange.node_type,
            data,
            _isProposed: true,
            _packageId: stagedPackage.id,
            _operation: nodeChange.operation,
            _previousData: nodeChange.previous_data,
          };

          const existing = byType.get(nodeChange.node_type) ?? [];
          existing.push(node);
          byType.set(nodeChange.node_type, existing);
        }
      }
    }
    return byType;
  }, [stagedPackage, staging.editedNodes, staging.removedNodeIds]);

  // Merge proposed elements into sections
  const sections = useMemo((): ElementSection[] => {
    return baseSections.map((section) => ({
      ...section,
      proposedNodes: proposedElementsByType.get(section.type) ?? [],
    }));
  }, [baseSections, proposedElementsByType]);

  const handleEditProposedNode = useCallback((nodeId: string, updates: Partial<Record<string, unknown>>) => {
    updateEditedNode(nodeId, updates);
  }, [updateEditedNode]);

  const handleRemoveProposedNode = useCallback((nodeId: string) => {
    removeProposedNode(nodeId);
  }, [removeProposedNode]);

  const handleAddClick = (type: ElementType) => {
    setAddDropdownOpen(false);
    onAddElement?.(type);
  };

  const fetchElements = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);
    try {
      const [charactersRes, locationsRes, objectsRes] = await Promise.all([
        api.listNodes(currentStoryId, 'Character', 100),
        api.listNodes(currentStoryId, 'Location', 100),
        api.listNodes(currentStoryId, 'Object', 100),
      ]);

      setBaseSections([
        { type: 'Character', label: 'Characters', icon: '\uD83D\uDC64', nodes: charactersRes.nodes },
        { type: 'Location', label: 'Locations', icon: '\uD83D\uDCCD', nodes: locationsRes.nodes },
        { type: 'Object', label: 'Objects', icon: '\uD83D\uDCE6', nodes: objectsRes.nodes },
      ]);
    } catch (err) {
      console.error('Failed to fetch elements:', err);
      setError('Failed to load elements');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchElements();
  }, [fetchElements]);

  // Refresh when status changes (indicates data changes)
  useEffect(() => {
    if (status) {
      void fetchElements();
    }
  }, [status, fetchElements]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.viewTitle}>Elements</h2>
        </div>
        <div className={styles.loading}>Loading elements...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.viewTitle}>Elements</h2>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with title and add button */}
      <div className={styles.header}>
        <h2 className={styles.viewTitle}>Elements</h2>
        {onAddElement && (
          <div className={styles.addWrapper}>
            <button
              className={styles.addDropdownButton}
              onClick={() => setAddDropdownOpen(!addDropdownOpen)}
              type="button"
            >
              + Add Element
              <span className={styles.dropdownChevron}>{addDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {addDropdownOpen && (
              <div className={styles.addDropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleAddClick('Character')}
                  type="button"
                >
                  👤 Character
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleAddClick('Location')}
                  type="button"
                >
                  📍 Location
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleAddClick('Object')}
                  type="button"
                >
                  📦 Object
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className={styles.content}>
        {sections.map((section) => {
          const totalCount = section.nodes.length + section.proposedNodes.length;
          const hasProposed = section.proposedNodes.length > 0;

          return (
            <div key={section.type} className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>{section.icon}</span>
                  <h3 className={styles.sectionLabel}>{section.label}</h3>
                  <span className={`${styles.sectionCount} ${hasProposed ? styles.sectionCountHasProposed : ''}`}>
                    ({totalCount})
                    {hasProposed && (
                      <span className={styles.proposedIndicator}> +{section.proposedNodes.length} proposed</span>
                    )}
                  </span>
                </div>
                {onAddElement && (
                  <button
                    className={styles.addButton}
                    onClick={() => onAddElement(section.type)}
                    type="button"
                  >
                    + Add
                  </button>
                )}
              </div>

              {totalCount === 0 ? (
                <div className={styles.emptySection}>
                  <p>No {section.label.toLowerCase()} yet.</p>
                  {onAddElement && (
                    <button
                      className={styles.addEmptyButton}
                      onClick={() => onAddElement(section.type)}
                      type="button"
                    >
                      + Add {section.type}
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.grid}>
                  {/* Proposed elements first with special styling */}
                  {section.proposedNodes.map((node) => (
                    <ProposedElementCard
                      key={node.id}
                      element={node}
                      elementType={section.type}
                      onEdit={handleEditProposedNode}
                      onRemove={node._operation === 'add' ? handleRemoveProposedNode : undefined}
                      isRemoved={staging.removedNodeIds.has(node.id)}
                    />
                  ))}
                  {/* Existing elements */}
                  {section.nodes.map((node) => (
                    <ElementCard
                      key={node.id}
                      element={node}
                      elementType={section.type}
                      onClick={() => onElementClick(node.id, section.type)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
