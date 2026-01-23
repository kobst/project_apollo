import { useState, useCallback, useMemo, useEffect } from 'react';
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
  onBackToCompose?: () => void;
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
    } else if (['storybeat', 'scene', 'beat', 'idea'].includes(type)) {
      outline.push(node);
    } else {
      other.push(node);
    }
  }

  return { storyElements, outline, other };
}

// Element key for tracking regenerate options
type ElementKey = `${PackageElementType}-${number}`;

// Escape special regex characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper to propagate character name changes to all text fields
const propagateNameChange = (
  pkg: NarrativePackage,
  oldName: string,
  newName: string,
  changedNodeId: string
): { updatedPkg: NarrativePackage; changeCount: number } => {
  if (!oldName || !newName || oldName === newName) {
    return { updatedPkg: pkg, changeCount: 0 };
  }

  let changeCount = 0;
  const updatedPkg = { ...pkg, changes: { ...pkg.changes } };

  // Helper to replace name in text (case-insensitive, word boundary)
  const replaceName = (text: string | undefined): string | undefined => {
    if (!text) return text;
    // Match whole word only (not "Kanesville" when replacing "Kane")
    const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'gi');
    if (regex.test(text)) {
      changeCount++;
      // Need to recreate regex since test() moves lastIndex
      return text.replace(new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'gi'), newName);
    }
    return text;
  };

  // Update nodes (skip the changed node itself)
  updatedPkg.changes.nodes = pkg.changes.nodes.map((node) => {
    if (node.node_id === changedNodeId) return node;

    const data = node.data as Record<string, unknown> | undefined;
    if (!data) return node;

    // Fields that commonly contain character name references
    const textFields = [
      'description',
      'summary',
      'scene_overview',
      'notable_dialogue',
      'rationale',
      'title',
      'content',
      'heading',
      'start_state',
      'end_state',
    ];

    let hasChanges = false;
    const newData = { ...data };

    for (const field of textFields) {
      if (typeof data[field] === 'string') {
        const updated = replaceName(data[field] as string);
        if (updated !== data[field]) {
          newData[field] = updated;
          hasChanges = true;
        }
      }
    }

    return hasChanges ? { ...node, data: newData } : node;
  });

  // Update edge names
  updatedPkg.changes.edges = pkg.changes.edges.map((edge) => {
    let updated = edge;
    const updatedFromName = replaceName(edge.from_name);
    const updatedToName = replaceName(edge.to_name);

    if (updatedFromName !== undefined && updatedFromName !== edge.from_name) {
      updated = { ...updated, from_name: updatedFromName };
    }
    if (updatedToName !== undefined && updatedToName !== edge.to_name) {
      updated = { ...updated, to_name: updatedToName };
    }
    return updated;
  });

  // Update story context
  if (pkg.changes.storyContext) {
    updatedPkg.changes.storyContext = pkg.changes.storyContext.map((ctx) => {
      const updatedContent = replaceName(ctx.content);
      return updatedContent !== ctx.content ? { ...ctx, content: updatedContent! } : ctx;
    });
  }

  return { updatedPkg, changeCount };
};

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
  onBackToCompose,
  loading = false,
  isSavedPackage = false,
  savedPackageData,
  onClose,
}: PackageDetailProps) {
  // storyId is passed for potential future use but not currently needed in component
  void _storyId;

  // For saved packages, maintain a local editable copy
  // For session packages, use the prop directly (edits go through API)
  const [localPackage, setLocalPackage] = useState<NarrativePackage>(pkg);

  // Reset local package when the source package changes
  useEffect(() => {
    setLocalPackage(pkg);
  }, [pkg]);

  // Use local package for saved packages, prop for session packages
  const editablePackage = isSavedPackage ? localPackage : pkg;

  const { storyElements, outline, other } = categorizeNodes(editablePackage.changes.nodes);
  const confidence = Math.round(editablePackage.confidence * 100);

  // Build node name lookup for edge display
  const nodeNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const node of editablePackage.changes.nodes) {
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
  }, [editablePackage.changes.nodes]);

  // Track regenerate options per element
  const [regenerateOptions, setRegenerateOptions] = useState<
    Record<ElementKey, Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>>
  >({});
  const [regeneratingElement, setRegeneratingElement] = useState<ElementKey | null>(null);

  // State for name propagation notification
  const [namePropagation, setNamePropagation] = useState<{
    oldName: string;
    newName: string;
    count: number;
  } | null>(null);

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
      const nodeId = editablePackage.changes.nodes[index]?.node_id;
      if (nodeId) {
        // Find edges that reference this node
        editablePackage.changes.edges.forEach((edge, edgeIdx) => {
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
    // For saved packages with local edits but no removals, still pass the edited package
    const hasLocalEdits = isSavedPackage && localPackage !== pkg;

    // Check if any elements removed
    if (removedElements.size === 0 && !hasLocalEdits) {
      onAccept(); // No filtering or edits needed
      return;
    }

    // Filter nodes
    const filteredNodes = editablePackage.changes.nodes.filter(
      (_, i) => !isElementRemoved('node', i)
    );

    // Filter edges
    const filteredEdges = editablePackage.changes.edges.filter(
      (_, i) => !isElementRemoved('edge', i)
    );

    // Filter story context
    const filteredStoryContext = (editablePackage.changes.storyContext ?? []).filter(
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

    // Build filtered package (uses editablePackage which has local edits for saved packages)
    const filteredPackage: NarrativePackage = {
      ...editablePackage,
      changes: {
        ...editablePackage.changes,
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
    editablePackage.changes.nodes.findIndex((n) => n.node_id === node.node_id);

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
          editablePackage.id,
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
    [editablePackage.id, onRegenerateElement]
  );

  // Handle selecting an option - for saved packages, update locally
  const handleSelectOption = useCallback(
    async (
      elementType: PackageElementType,
      elementIndex: number,
      option: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ) => {
      const key = getElementKey(elementType, elementIndex);

      if (isSavedPackage) {
        // For saved packages, update local state directly
        setLocalPackage((prev) => {
          const updated = { ...prev, changes: { ...prev.changes } };
          if (elementType === 'node') {
            updated.changes.nodes = [...prev.changes.nodes];
            updated.changes.nodes[elementIndex] = option as NodeChangeAI;
          } else if (elementType === 'edge') {
            updated.changes.edges = [...prev.changes.edges];
            updated.changes.edges[elementIndex] = option as EdgeChangeAI;
          } else if (elementType === 'storyContext') {
            updated.changes.storyContext = [...(prev.changes.storyContext ?? [])];
            updated.changes.storyContext[elementIndex] = option as StoryContextChange;
          }
          return updated;
        });
        // Clear options after selection
        setRegenerateOptions((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        // For session packages, call API
        try {
          await onApplyElementOption(editablePackage.id, elementType, elementIndex, option);
          // Clear options after selection
          setRegenerateOptions((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } catch {
          // Error handled by context
        }
      }
    },
    [editablePackage.id, onApplyElementOption, isSavedPackage]
  );

  // Handle manual edit - for saved packages, update locally; for session packages, call API
  const handleEdit = useCallback(
    async (
      elementType: PackageElementType,
      elementIndex: number,
      updated: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ): Promise<void> => {
      // Helper to check for character name change and apply propagation
      const applyWithPropagation = (
        pkg: NarrativePackage,
        oldNode: NodeChangeAI | undefined,
        newNode: NodeChangeAI
      ): NarrativePackage => {
        // Only propagate for character name changes
        if (newNode.node_type.toLowerCase() !== 'character') return pkg;

        const oldName = (oldNode?.data as Record<string, unknown>)?.name as string | undefined;
        const newName = (newNode.data as Record<string, unknown>)?.name as string | undefined;

        if (!oldName || !newName || oldName === newName) return pkg;

        // Propagate name change
        const { updatedPkg, changeCount } = propagateNameChange(
          pkg,
          oldName,
          newName,
          newNode.node_id
        );

        if (changeCount > 0) {
          setNamePropagation({ oldName, newName, count: changeCount });
        }

        return updatedPkg;
      };

      if (isSavedPackage) {
        // For saved packages, update local state directly (no API call)
        setLocalPackage((prev) => {
          let updatedPkg = { ...prev, changes: { ...prev.changes } };

          // Apply the direct edit
          if (elementType === 'node') {
            updatedPkg.changes.nodes = [...prev.changes.nodes];
            updatedPkg.changes.nodes[elementIndex] = updated as NodeChangeAI;
          } else if (elementType === 'edge') {
            updatedPkg.changes.edges = [...prev.changes.edges];
            updatedPkg.changes.edges[elementIndex] = updated as EdgeChangeAI;
          } else if (elementType === 'storyContext') {
            updatedPkg.changes.storyContext = [...(prev.changes.storyContext ?? [])];
            updatedPkg.changes.storyContext[elementIndex] = updated as StoryContextChange;
          }

          // Apply propagation for character name changes
          if (elementType === 'node') {
            const oldNode = prev.changes.nodes[elementIndex];
            updatedPkg = applyWithPropagation(updatedPkg, oldNode, updated as NodeChangeAI);
          }

          return updatedPkg;
        });
      } else {
        // For session packages: first call API for the direct edit
        await onUpdateElement(editablePackage.id, elementType, elementIndex, updated);

        // After API call, check if we need to propagate (for character name changes)
        if (elementType === 'node') {
          const oldNode = editablePackage.changes.nodes[elementIndex];
          const newNode = updated as NodeChangeAI;

          if (newNode.node_type.toLowerCase() === 'character') {
            const oldName = (oldNode?.data as Record<string, unknown>)?.name as
              | string
              | undefined;
            const newName = (newNode.data as Record<string, unknown>)?.name as
              | string
              | undefined;

            if (oldName && newName && oldName !== newName) {
              // Build package with the update applied
              const pkgWithUpdate = {
                ...editablePackage,
                changes: {
                  ...editablePackage.changes,
                  nodes: editablePackage.changes.nodes.map((n, i) =>
                    i === elementIndex ? newNode : n
                  ),
                },
              };

              // Propagate to other elements
              const { updatedPkg, changeCount } = propagateNameChange(
                pkgWithUpdate,
                oldName,
                newName,
                newNode.node_id
              );

              if (changeCount > 0) {
                setNamePropagation({ oldName, newName, count: changeCount });

                // Send each propagated element update to API
                for (let i = 0; i < updatedPkg.changes.nodes.length; i++) {
                  const updatedNode = updatedPkg.changes.nodes[i];
                  if (
                    updatedNode &&
                    i !== elementIndex &&
                    updatedNode !== editablePackage.changes.nodes[i]
                  ) {
                    await onUpdateElement(editablePackage.id, 'node', i, updatedNode);
                  }
                }
                for (let i = 0; i < updatedPkg.changes.edges.length; i++) {
                  const updatedEdge = updatedPkg.changes.edges[i];
                  if (updatedEdge && updatedEdge !== editablePackage.changes.edges[i]) {
                    await onUpdateElement(editablePackage.id, 'edge', i, updatedEdge);
                  }
                }
                if (updatedPkg.changes.storyContext) {
                  for (let i = 0; i < updatedPkg.changes.storyContext.length; i++) {
                    const updatedCtx = updatedPkg.changes.storyContext[i];
                    if (updatedCtx && updatedCtx !== editablePackage.changes.storyContext?.[i]) {
                      await onUpdateElement(editablePackage.id, 'storyContext', i, updatedCtx);
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    [editablePackage, onUpdateElement, isSavedPackage]
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        {onBackToCompose && !isSavedPackage && (
          <button
            className={styles.backLink}
            onClick={onBackToCompose}
            type="button"
          >
            ← Edit inputs
          </button>
        )}
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

      {/* Name propagation notification */}
      {namePropagation && (
        <div className={styles.propagationNotice}>
          <span className={styles.propagationIcon}>✓</span>
          <span>
            Updated {namePropagation.count} reference
            {namePropagation.count !== 1 ? 's' : ''} from "
            <strong>{namePropagation.oldName}</strong>" to "
            <strong>{namePropagation.newName}</strong>"
          </span>
          <button
            onClick={() => setNamePropagation(null)}
            className={styles.propagationDismiss}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>
        {/* Story Context */}
        {editablePackage.changes.storyContext && editablePackage.changes.storyContext.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Story Context</h3>
            <div className={styles.sectionContent}>
              {editablePackage.changes.storyContext.map((change, idx) => {
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
        {editablePackage.changes.edges.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Relationships</h3>
            <div className={styles.sectionContent}>
              {editablePackage.changes.edges.map((edge, idx) => {
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

