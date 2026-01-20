import { useState, useCallback, useMemo } from 'react';
import type {
  NarrativePackage,
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
  PackageElementType,
  GenerationCount,
  SavedPackageData,
} from '../../api/types';
import { EditableElement } from './EditableElement';
import styles from './PackageDetail.module.css';

interface PackageDetailProps {
  package: NarrativePackage;
  storyId: string;
  onAccept: (filteredPackage?: NarrativePackage) => void;
  onRefine: () => void;
  onReject: () => void;
  onSave?: () => void;
  onRegenerateElement: (
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    guidance?: string,
    count?: GenerationCount
  ) => Promise<Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>>;
  onApplyElementOption: (
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    newElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
  ) => Promise<void>;
  onUpdateElement: (
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    updatedElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
  ) => Promise<void>;
  loading?: boolean;
  // Saved package mode
  isSavedPackage?: boolean;
  savedPackageData?: SavedPackageData;
  onClose?: () => void;
}

// Categorize nodes
function categorizeNodes(nodes: NodeChangeAI[]): {
  storyElements: NodeChangeAI[];
  outline: NodeChangeAI[];
  other: NodeChangeAI[];
} {
  const storyElements: NodeChangeAI[] = [];
  const outline: NodeChangeAI[] = [];
  const other: NodeChangeAI[] = [];

  for (const node of nodes) {
    const type = node.node_type.toLowerCase();
    if (['character', 'location', 'object', 'setting'].includes(type)) {
      storyElements.push(node);
    } else if (['plotpoint', 'scene', 'beat', 'idea'].includes(type)) {
      outline.push(node);
    } else {
      other.push(node);
    }
  }

  return { storyElements, outline, other };
}

// Element key for tracking regenerate options
type ElementKey = `${PackageElementType}-${number}`;

export function PackageDetail({
  package: pkg,
  storyId: _storyId,
  onAccept,
  onRefine,
  onReject,
  onSave,
  onRegenerateElement,
  onApplyElementOption,
  onUpdateElement,
  loading = false,
  isSavedPackage = false,
  savedPackageData,
  onClose,
}: PackageDetailProps) {
  // storyId is passed for potential future use but not currently needed in component
  void _storyId;

  const { storyElements, outline, other } = categorizeNodes(pkg.changes.nodes);
  const confidence = Math.round(pkg.confidence * 100);

  // Build node name lookup for edge display
  const nodeNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const node of pkg.changes.nodes) {
      const data = node.data ?? {};
      const name =
        (data.name as string) ??
        (data.title as string) ??
        (data.heading as string) ??
        null;
      if (name) {
        lookup.set(node.node_id, name);
      }
    }
    return lookup;
  }, [pkg.changes.nodes]);

  // Track regenerate options per element
  const [regenerateOptions, setRegenerateOptions] = useState<
    Record<ElementKey, Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>>
  >({});
  const [regeneratingElement, setRegeneratingElement] = useState<ElementKey | null>(null);

  // Track removed elements by type and index
  const [removedElements, setRemovedElements] = useState<Set<string>>(new Set());

  // Check if element is removed
  const isElementRemoved = (type: PackageElementType, index: number) =>
    removedElements.has(`${type}-${index}`);

  // Handle remove
  const handleRemove = (type: PackageElementType, index: number) => {
    const key = `${type}-${index}`;
    setRemovedElements((prev) => new Set([...prev, key]));

    // If removing a node, also remove dependent edges
    if (type === 'node') {
      const nodeId = pkg.changes.nodes[index]?.node_id;
      if (nodeId) {
        // Find edges that reference this node
        pkg.changes.edges.forEach((edge, edgeIdx) => {
          if (edge.from === nodeId || edge.to === nodeId) {
            const edgeKey = `edge-${edgeIdx}`;
            setRemovedElements((prev) => new Set([...prev, edgeKey]));
          }
        });
      }
    }
  };

  // Handle undo remove
  const handleUndoRemove = (type: PackageElementType, index: number) => {
    const key = `${type}-${index}`;
    setRemovedElements((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Build filtered package and accept
  const handleAcceptWithFiltering = () => {
    // Check if any elements removed
    if (removedElements.size === 0) {
      onAccept(); // No filtering needed
      return;
    }

    // Filter nodes
    const filteredNodes = pkg.changes.nodes.filter(
      (_, i) => !isElementRemoved('node', i)
    );

    // Filter edges
    const filteredEdges = pkg.changes.edges.filter(
      (_, i) => !isElementRemoved('edge', i)
    );

    // Filter story context
    const filteredStoryContext = (pkg.changes.storyContext ?? []).filter(
      (_, i) => !isElementRemoved('storyContext', i)
    );

    // Check if package would be empty
    if (
      filteredNodes.length === 0 &&
      filteredEdges.length === 0 &&
      filteredStoryContext.length === 0
    ) {
      // Package would be empty - don't allow
      return;
    }

    // Build filtered package
    const filteredPackage: NarrativePackage = {
      ...pkg,
      changes: {
        ...pkg.changes,
        nodes: filteredNodes,
        edges: filteredEdges,
        ...(filteredStoryContext.length > 0
          ? { storyContext: filteredStoryContext }
          : {}),
      },
    };

    onAccept(filteredPackage);
  };

  // Get element key
  const getElementKey = (type: PackageElementType, index: number): ElementKey =>
    `${type}-${index}`;

  // Get index within the category for node elements
  const getNodeIndex = (node: NodeChangeAI): number =>
    pkg.changes.nodes.findIndex((n) => n.node_id === node.node_id);

  // Handle regenerate for an element
  const handleRegenerate = useCallback(
    async (
      elementType: PackageElementType,
      elementIndex: number,
      guidance: string,
      count: GenerationCount
    ) => {
      const key = getElementKey(elementType, elementIndex);
      setRegeneratingElement(key);
      try {
        const options = await onRegenerateElement(
          pkg.id,
          elementType,
          elementIndex,
          guidance,
          count
        );
        setRegenerateOptions((prev) => ({ ...prev, [key]: options }));
      } catch {
        // Error handled by context
      } finally {
        setRegeneratingElement(null);
      }
    },
    [pkg.id, onRegenerateElement]
  );

  // Handle selecting an option
  const handleSelectOption = useCallback(
    async (
      elementType: PackageElementType,
      elementIndex: number,
      option: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ) => {
      const key = getElementKey(elementType, elementIndex);
      try {
        await onApplyElementOption(pkg.id, elementType, elementIndex, option);
        // Clear options after selection
        setRegenerateOptions((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch {
        // Error handled by context
      }
    },
    [pkg.id, onApplyElementOption]
  );

  // Handle manual edit
  const handleEdit = useCallback(
    async (
      elementType: PackageElementType,
      elementIndex: number,
      updated: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ) => {
      try {
        await onUpdateElement(pkg.id, elementType, elementIndex, updated);
      } catch {
        // Error handled by context
      }
    },
    [pkg.id, onUpdateElement]
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h2 className={styles.title}>{pkg.title}</h2>
          <div
            className={`${styles.confidence} ${
              confidence >= 80
                ? styles.high
                : confidence >= 60
                  ? styles.medium
                  : styles.low
            }`}
          >
            {confidence}%
          </div>
        </div>
        <p className={styles.rationale}>{pkg.rationale}</p>
        {pkg.style_tags.length > 0 && (
          <div className={styles.tags}>
            {pkg.style_tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {/* Saved package info */}
        {isSavedPackage && savedPackageData && (
          <div className={styles.savedInfo}>
            <span className={styles.savedLabel}>
              Saved {new Date(savedPackageData.savedAt).toLocaleDateString()}
            </span>
            <span className={styles.savedVersion}>
              v{savedPackageData.sourceVersionLabel}
            </span>
            {savedPackageData.compatibility.status === 'outdated' && (
              <span className={styles.savedOutdated}>
                {savedPackageData.compatibility.versionsBehind} versions behind
              </span>
            )}
          </div>
        )}
        {/* Conflicts warning for saved packages */}
        {isSavedPackage &&
          savedPackageData?.compatibility.status === 'conflicting' &&
          savedPackageData.compatibility.conflicts.length > 0 && (
            <div className={styles.conflictsWarning}>
              <div className={styles.conflictsTitle}>
                ⚠ This package has conflicts with the current graph:
              </div>
              <ul className={styles.conflictsList}>
                {savedPackageData.compatibility.conflicts.map((conflict, i) => (
                  <li key={i} className={styles.conflictItem}>
                    {conflict.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Story Context */}
        {pkg.changes.storyContext && pkg.changes.storyContext.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Story Context</h3>
            <div className={styles.sectionContent}>
              {pkg.changes.storyContext.map((change, idx) => {
                const key = getElementKey('storyContext', idx);
                return (
                  <EditableElement
                    key={idx}
                    elementType="storyContext"
                    elementIndex={idx}
                    element={change}
                    onEdit={(updated) =>
                      handleEdit('storyContext', idx, updated)
                    }
                    onRegenerate={(guidance, count) =>
                      handleRegenerate('storyContext', idx, guidance, count)
                    }
                    loading={regeneratingElement === key || loading}
                    regenerateOptions={regenerateOptions[key] as StoryContextChange[] | undefined}
                    onSelectOption={(opt) =>
                      handleSelectOption('storyContext', idx, opt)
                    }
                    onRemove={() => handleRemove('storyContext', idx)}
                    isRemoved={isElementRemoved('storyContext', idx)}
                    onUndoRemove={() => handleUndoRemove('storyContext', idx)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Story Elements */}
        {storyElements.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Story Elements</h3>
            <div className={styles.sectionContent}>
              {storyElements.map((node) => {
                const nodeIndex = getNodeIndex(node);
                const key = getElementKey('node', nodeIndex);
                return (
                  <EditableElement
                    key={node.node_id}
                    elementType="node"
                    elementIndex={nodeIndex}
                    element={node}
                    onEdit={(updated) =>
                      handleEdit('node', nodeIndex, updated)
                    }
                    onRegenerate={(guidance, count) =>
                      handleRegenerate('node', nodeIndex, guidance, count)
                    }
                    loading={regeneratingElement === key || loading}
                    regenerateOptions={regenerateOptions[key] as NodeChangeAI[] | undefined}
                    onSelectOption={(opt) =>
                      handleSelectOption('node', nodeIndex, opt)
                    }
                    onRemove={() => handleRemove('node', nodeIndex)}
                    isRemoved={isElementRemoved('node', nodeIndex)}
                    onUndoRemove={() => handleUndoRemove('node', nodeIndex)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Outline */}
        {outline.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Outline</h3>
            <div className={styles.sectionContent}>
              {outline.map((node) => {
                const nodeIndex = getNodeIndex(node);
                const key = getElementKey('node', nodeIndex);
                return (
                  <EditableElement
                    key={node.node_id}
                    elementType="node"
                    elementIndex={nodeIndex}
                    element={node}
                    onEdit={(updated) =>
                      handleEdit('node', nodeIndex, updated)
                    }
                    onRegenerate={(guidance, count) =>
                      handleRegenerate('node', nodeIndex, guidance, count)
                    }
                    loading={regeneratingElement === key || loading}
                    regenerateOptions={regenerateOptions[key] as NodeChangeAI[] | undefined}
                    onSelectOption={(opt) =>
                      handleSelectOption('node', nodeIndex, opt)
                    }
                    onRemove={() => handleRemove('node', nodeIndex)}
                    isRemoved={isElementRemoved('node', nodeIndex)}
                    onUndoRemove={() => handleUndoRemove('node', nodeIndex)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Other */}
        {other.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Other</h3>
            <div className={styles.sectionContent}>
              {other.map((node) => {
                const nodeIndex = getNodeIndex(node);
                const key = getElementKey('node', nodeIndex);
                return (
                  <EditableElement
                    key={node.node_id}
                    elementType="node"
                    elementIndex={nodeIndex}
                    element={node}
                    onEdit={(updated) =>
                      handleEdit('node', nodeIndex, updated)
                    }
                    onRegenerate={(guidance, count) =>
                      handleRegenerate('node', nodeIndex, guidance, count)
                    }
                    loading={regeneratingElement === key || loading}
                    regenerateOptions={regenerateOptions[key] as NodeChangeAI[] | undefined}
                    onSelectOption={(opt) =>
                      handleSelectOption('node', nodeIndex, opt)
                    }
                    onRemove={() => handleRemove('node', nodeIndex)}
                    isRemoved={isElementRemoved('node', nodeIndex)}
                    onUndoRemove={() => handleUndoRemove('node', nodeIndex)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Edges (standalone) */}
        {pkg.changes.edges.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Relationships</h3>
            <div className={styles.sectionContent}>
              {pkg.changes.edges.map((edge, idx) => {
                const key = getElementKey('edge', idx);
                return (
                  <EditableElement
                    key={`${edge.edge_type}-${edge.from}-${edge.to}`}
                    elementType="edge"
                    elementIndex={idx}
                    element={edge}
                    onEdit={(updated) =>
                      handleEdit('edge', idx, updated)
                    }
                    onRegenerate={(guidance, count) =>
                      handleRegenerate('edge', idx, guidance, count)
                    }
                    loading={regeneratingElement === key || loading}
                    regenerateOptions={regenerateOptions[key] as EdgeChangeAI[] | undefined}
                    onSelectOption={(opt) =>
                      handleSelectOption('edge', idx, opt)
                    }
                    onRemove={() => handleRemove('edge', idx)}
                    isRemoved={isElementRemoved('edge', idx)}
                    onUndoRemove={() => handleUndoRemove('edge', idx)}
                    nodeNameLookup={nodeNameLookup}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Impact */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Impact</h3>
          <div className={styles.impactContent}>
            {pkg.impact.fulfills_gaps.length > 0 && (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>✓</span>
                <span className={styles.impactLabel}>Fulfills:</span>
                <span className={styles.impactValue}>
                  {pkg.impact.fulfills_gaps.join(', ')}
                </span>
              </div>
            )}
            {pkg.impact.creates_gaps.length > 0 && (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>→</span>
                <span className={styles.impactLabel}>Creates:</span>
                <span className={styles.impactValue}>
                  {pkg.impact.creates_gaps.join(', ')}
                </span>
              </div>
            )}
            {pkg.impact.conflicts.length > 0 ? (
              <div className={styles.conflicts}>
                {pkg.impact.conflicts.map((conflict, idx) => (
                  <div key={idx} className={styles.conflictItem}>
                    <span className={styles.conflictIcon}>⚠</span>
                    <span className={styles.conflictType}>{conflict.type}:</span>
                    <span className={styles.conflictDesc}>
                      {conflict.description}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>✓</span>
                <span className={styles.impactValue}>No conflicts</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Removed Summary */}
      {removedElements.size > 0 && (
        <div className={styles.removedSummary}>
          <span>
            {removedElements.size} element
            {removedElements.size !== 1 ? 's' : ''} removed
          </span>
          <button
            onClick={() => setRemovedElements(new Set())}
            type="button"
          >
            Restore All
          </button>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {isSavedPackage ? (
          // Saved package actions
          <>
            {onClose && (
              <button
                className={styles.closeBtn}
                onClick={onClose}
                disabled={loading}
                type="button"
              >
                Back
              </button>
            )}
            <button
              className={styles.rejectBtn}
              onClick={onReject}
              disabled={loading}
              type="button"
            >
              Delete
            </button>
            <button
              className={`${styles.acceptBtn} ${
                savedPackageData?.compatibility.status === 'conflicting'
                  ? styles.warningBtn
                  : ''
              }`}
              onClick={handleAcceptWithFiltering}
              disabled={loading}
              type="button"
            >
              {loading
                ? 'Applying...'
                : savedPackageData?.compatibility.status === 'conflicting'
                  ? 'Apply Anyway'
                  : 'Apply'}
            </button>
          </>
        ) : (
          // Session package actions
          <>
            <button
              className={styles.rejectBtn}
              onClick={onReject}
              disabled={loading}
              type="button"
            >
              Reject
            </button>
            {onSave && (
              <button
                className={styles.saveBtn}
                onClick={onSave}
                disabled={loading}
                type="button"
              >
                Save for Later
              </button>
            )}
            <button
              className={styles.refineBtn}
              onClick={onRefine}
              disabled={loading}
              type="button"
            >
              Refine...
            </button>
            <button
              className={styles.acceptBtn}
              onClick={handleAcceptWithFiltering}
              disabled={loading}
              type="button"
            >
              {loading ? 'Accepting...' : 'Accept'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

