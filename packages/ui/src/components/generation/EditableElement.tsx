import { useState, useEffect } from 'react';
import type {
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
  StoryContextChangeOperation,
  PackageElementType,
  GenerationCount,
} from '../../api/types';
import styles from './EditableElement.module.css';

/**
 * Get display label for a story context operation type.
 */
function getOperationLabel(op: StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return `Set ${op.field}`;
    case 'addThematicPillar':
      return 'Add Pillar';
    case 'removeThematicPillar':
      return 'Remove Pillar';
    case 'setThematicPillars':
      return 'Set Pillars';
    case 'addBanned':
      return 'Add Banned';
    case 'removeBanned':
      return 'Remove Banned';
    case 'setBanned':
      return 'Set Banned';
    case 'addHardRule':
      return 'Add Rule';
    case 'updateHardRule':
      return 'Update Rule';
    case 'removeHardRule':
      return 'Remove Rule';
    case 'addGuideline':
      return 'Add Guideline';
    case 'updateGuideline':
      return 'Update Guideline';
    case 'removeGuideline':
      return 'Remove Guideline';
    case 'setWorkingNotes':
      return 'Set Notes';
    default:
      return 'Unknown';
  }
}

/**
 * Get display content for a story context operation.
 */
function getOperationContent(op: StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return op.value;
    case 'addThematicPillar':
      return op.pillar;
    case 'removeThematicPillar':
      return `Index ${op.index}`;
    case 'setThematicPillars':
      return op.pillars.join(', ');
    case 'addBanned':
      return op.item;
    case 'removeBanned':
      return `Index ${op.index}`;
    case 'setBanned':
      return op.banned.join(', ');
    case 'addHardRule':
      return op.rule.text;
    case 'updateHardRule':
      return op.text;
    case 'removeHardRule':
      return op.id;
    case 'addGuideline':
      return op.guideline.text;
    case 'updateGuideline':
      return op.changes.text ?? `ID: ${op.id}`;
    case 'removeGuideline':
      return op.id;
    case 'setWorkingNotes':
      return op.content;
    default:
      return '';
  }
}

/**
 * Get the operation category for display styling.
 */
function getOperationCategory(op: StoryContextChangeOperation): 'add' | 'modify' | 'delete' {
  if (op.type.startsWith('add') || op.type.startsWith('set')) {
    return 'add';
  }
  if (op.type.startsWith('update')) {
    return 'modify';
  }
  if (op.type.startsWith('remove')) {
    return 'delete';
  }
  return 'add';
}

interface EditableElementProps {
  elementType: PackageElementType;
  elementIndex: number;
  element: NodeChangeAI | EdgeChangeAI | StoryContextChange;
  onEdit: (updated: NodeChangeAI | EdgeChangeAI | StoryContextChange) => Promise<void>;
  onRegenerate: (guidance: string, count: GenerationCount) => void;
  loading?: boolean | undefined;
  regenerateOptions?: Array<NodeChangeAI | EdgeChangeAI | StoryContextChange> | undefined;
  onSelectOption?: ((option: NodeChangeAI | EdgeChangeAI | StoryContextChange) => void) | undefined;
  onRemove?: () => void;
  isRemoved?: boolean;
  onUndoRemove?: () => void;
  /** Lookup map from node IDs to human-readable names (for edge display) */
  nodeNameLookup?: Map<string, string>;
}

// Get operation display
function getOpDisplay(op: string): { icon: string; className: string } {
  switch (op) {
    case 'add':
      return { icon: '+', className: styles.opAdd ?? '' };
    case 'modify':
      return { icon: '~', className: styles.opModify ?? '' };
    case 'delete':
      return { icon: '-', className: styles.opDelete ?? '' };
    default:
      return { icon: '?', className: '' };
  }
}

/**
 * Format an edge relationship in human-readable form.
 * Instead of "HAS_CHARACTER: Scene → Character", shows "Character in Scene"
 */
function formatEdgeRelationship(
  edgeType: string,
  fromName: string,
  toName: string
): { label: string; description: string } {
  switch (edgeType) {
    case 'HAS_CHARACTER':
      return {
        label: `${toName} in ${fromName}`,
        description: 'Character appears in scene',
      };
    case 'LOCATED_AT':
      return {
        label: `${fromName} at ${toName}`,
        description: 'Scene takes place at location',
      };
    case 'FEATURES_OBJECT':
      return {
        label: `${toName} in ${fromName}`,
        description: 'Object appears in scene',
      };
    case 'SATISFIED_BY':
      return {
        label: `${fromName} realized by ${toName}`,
        description: 'StoryBeat realized by scene',
      };
    case 'ALIGNS_WITH':
      return {
        label: `${fromName} aligns with ${toName}`,
        description: 'StoryBeat aligns with beat',
      };
    case 'PRECEDES':
      return {
        label: `${fromName} before ${toName}`,
        description: 'Causal ordering of plot points',
      };
    case 'ADVANCES':
      return {
        label: `${fromName} advances ${toName}`,
        description: 'StoryBeat advances character arc',
      };
    case 'PART_OF':
      return {
        label: `${fromName} part of ${toName}`,
        description: 'Location is part of setting',
      };
    case 'SET_IN':
      return {
        label: `${fromName} set in ${toName}`,
        description: 'Scene set in setting',
      };
    case 'HAS_ARC':
      return {
        label: `${toName} for ${fromName}`,
        description: 'Character has arc',
      };
    default:
      return {
        label: `${fromName} → ${toName}`,
        description: edgeType,
      };
  }
}

export function EditableElement({
  elementType,
  element,
  onEdit,
  onRegenerate,
  loading = false,
  regenerateOptions,
  onSelectOption,
  onRemove,
  isRemoved = false,
  onUndoRemove,
  nodeNameLookup,
}: EditableElementProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'regenerate'>('view');
  const [editedElement, setEditedElement] = useState(element);
  const [guidance, setGuidance] = useState('');
  const [count, setCount] = useState<GenerationCount>('few');
  const [saving, setSaving] = useState(false);

  // Sync editedElement with element prop when prop changes (e.g., after API update)
  useEffect(() => {
    setEditedElement(element);
  }, [element]);

  // Get operation display - handle both string operations (node/edge) and structured operations (storyContext)
  const opDisplayInfo = (() => {
    if (elementType === 'storyContext') {
      const ctx = element as StoryContextChange;
      const category = getOperationCategory(ctx.operation);
      return getOpDisplay(category);
    }
    // For nodes and edges, operation is a string
    const op = (element as NodeChangeAI | EdgeChangeAI).operation;
    return getOpDisplay(op);
  })();
  const { icon, className } = opDisplayInfo;

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await onEdit(editedElement);
      setMode('view');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedElement(element);
    setMode('view');
  };

  const handleStartRegenerate = () => {
    onRegenerate(guidance, count);
  };

  const handleSelectOption = (option: NodeChangeAI | EdgeChangeAI | StoryContextChange) => {
    onSelectOption?.(option);
    setMode('view');
  };

  // Render based on element type
  if (elementType === 'storyContext') {
    return renderStoryContextElement(
      element as StoryContextChange,
      editedElement as StoryContextChange,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      saving,
      regenerateOptions as StoryContextChange[] | undefined,
      icon,
      className,
      onRemove,
      isRemoved,
      onUndoRemove
    );
  }

  if (elementType === 'node') {
    return renderNodeElement(
      element as NodeChangeAI,
      editedElement as NodeChangeAI,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      saving,
      regenerateOptions as NodeChangeAI[] | undefined,
      icon,
      className,
      onRemove,
      isRemoved,
      onUndoRemove
    );
  }

  if (elementType === 'edge') {
    return renderEdgeElement(
      element as EdgeChangeAI,
      editedElement as EdgeChangeAI,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      saving,
      regenerateOptions as EdgeChangeAI[] | undefined,
      icon,
      className,
      onRemove,
      isRemoved,
      onUndoRemove,
      nodeNameLookup
    );
  }

  return null;
}

// Story Context Element Renderer
function renderStoryContextElement(
  element: StoryContextChange,
  _editedElement: StoryContextChange,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  _setEditedElement: (e: StoryContextChange) => void,
  _handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: StoryContextChange) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  _saving: boolean,
  regenerateOptions: StoryContextChange[] | undefined,
  icon: string,
  className: string,
  onRemove?: () => void,
  isRemoved?: boolean,
  onUndoRemove?: () => void
) {
  // Extract display info from structured operation
  const operationLabel = getOperationLabel(element.operation);
  const operationContent = getOperationContent(element.operation);

  return (
    <div className={`${styles.container} ${className} ${isRemoved ? styles.removed : ''}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type}>{operationLabel}</span>
        <div className={styles.actions}>
          {mode === 'view' && !isRemoved && (
            <>
              {/* Edit disabled for structured operations - use StoryContextEditor instead */}
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
              {onRemove && (
                <button
                  className={styles.removeBtn}
                  onClick={onRemove}
                  disabled={loading}
                  type="button"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isRemoved && (
        <div className={styles.removedOverlay}>
          <span>Will not be applied</span>
          {onUndoRemove && (
            <button onClick={onUndoRemove} type="button">
              Undo
            </button>
          )}
        </div>
      )}

      {mode === 'view' && !isRemoved && (
        <p className={styles.content}>"{operationContent}"</p>
      )}

      {/* Edit mode - show read-only for structured operations */}
      {mode === 'edit' && (
        <div className={styles.editForm}>
          <p className={styles.description}>
            Edit story context changes directly in the Story Context Editor.
          </p>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              type="button"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <p className={styles.optionContent}>"{getOperationContent(opt.operation)}"</p>
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Node Element Renderer
function renderNodeElement(
  element: NodeChangeAI,
  editedElement: NodeChangeAI,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  setEditedElement: (e: NodeChangeAI) => void,
  handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: NodeChangeAI) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  saving: boolean,
  regenerateOptions: NodeChangeAI[] | undefined,
  icon: string,
  className: string,
  onRemove?: () => void,
  isRemoved?: boolean,
  onUndoRemove?: () => void
) {
  const label = getNodeLabel(element);
  const description = getNodeDescription(element);

  return (
    <div className={`${styles.container} ${className} ${isRemoved ? styles.removed : ''}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type}>{element.node_type}:</span>
        <span className={styles.label}>{label}</span>
        <div className={styles.actions}>
          {mode === 'view' && !isRemoved && (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('edit')}
                disabled={loading}
                type="button"
              >
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
              {onRemove && (
                <button
                  className={styles.removeBtn}
                  onClick={onRemove}
                  disabled={loading}
                  type="button"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isRemoved && (
        <div className={styles.removedOverlay}>
          <span>Will not be added</span>
          {onUndoRemove && (
            <button onClick={onUndoRemove} type="button">
              Undo
            </button>
          )}
        </div>
      )}

      {mode === 'view' && !isRemoved && description && (
        <p className={styles.description}>{description}</p>
      )}

      {mode === 'edit' && (
        <div className={styles.editForm}>
          {renderNodeEditFields(element, editedElement, setEditedElement, saving)}
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance (e.g., 'make more sympathetic')..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <div className={styles.optionHeader}>
                <span className={styles.optionLabel}>{getNodeLabel(opt)}</span>
              </div>
              {getNodeDescription(opt) && (
                <p className={styles.optionDescription}>
                  {getNodeDescription(opt)}
                </p>
              )}
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Edge Element Renderer
function renderEdgeElement(
  element: EdgeChangeAI,
  editedElement: EdgeChangeAI,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  setEditedElement: (e: EdgeChangeAI) => void,
  handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: EdgeChangeAI) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  saving: boolean,
  regenerateOptions: EdgeChangeAI[] | undefined,
  icon: string,
  className: string,
  onRemove?: () => void,
  isRemoved?: boolean,
  onUndoRemove?: () => void,
  nodeNameLookup?: Map<string, string>
) {
  // Convert camelCase/PascalCase to Title Case (e.g., "FunAndGames" → "Fun And Games")
  const formatCamelCase = (str: string): string => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capitals
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Handle consecutive caps
      .replace(/^./, (c) => c.toUpperCase()); // Capitalize first letter
  };

  // Extract readable name from node ID (e.g., "pp_1768500123_introduction" → "Introduction")
  const extractNameFromId = (nodeId: string): string => {
    // Try to extract the last segment after underscore (often the name)
    const parts = nodeId.split('_');
    if (parts.length >= 2) {
      // Get the last part
      const name = parts[parts.length - 1];
      if (name && !/^\d+$/.test(name)) {
        // Not purely numeric, format and use it as name
        return formatCamelCase(name);
      }
      // If last part is numeric, try second-to-last
      if (parts.length >= 3) {
        const altName = parts[parts.length - 2];
        if (altName && !/^\d+$/.test(altName)) {
          return formatCamelCase(altName);
        }
      }
    }
    return nodeId; // Fallback to original
  };

  // Resolve human-readable names: prefer nodeNameLookup (reflects current edits in package),
  // then fall back to edge's stored names, then extract from ID
  const fromName = nodeNameLookup?.get(element.from) ?? element.from_name ?? extractNameFromId(element.from);
  const toName = nodeNameLookup?.get(element.to) ?? element.to_name ?? extractNameFromId(element.to);
  const { label: edgeLabel, description: edgeDescription } = formatEdgeRelationship(
    element.edge_type,
    fromName,
    toName
  );

  return (
    <div className={`${styles.container} ${className} ${isRemoved ? styles.removed : ''}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type} title={edgeDescription}>{element.edge_type}:</span>
        <span className={styles.label} title={`${fromName} → ${toName}`}>
          {edgeLabel}
        </span>
        <div className={styles.actions}>
          {mode === 'view' && !isRemoved && (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('edit')}
                disabled={loading}
                type="button"
              >
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
              {onRemove && (
                <button
                  className={styles.removeBtn}
                  onClick={onRemove}
                  disabled={loading}
                  type="button"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isRemoved && (
        <div className={styles.removedOverlay}>
          <span>Will not be added</span>
          {onUndoRemove && (
            <button onClick={onUndoRemove} type="button">
              Undo
            </button>
          )}
        </div>
      )}

      {mode === 'edit' && !isRemoved && (
        <div className={styles.editForm}>
          <div className={styles.formRow}>
            <label>From:</label>
            <input
              type="text"
              value={editedElement.from}
              onChange={(e) =>
                setEditedElement({ ...editedElement, from: e.target.value })
              }
              disabled={saving}
            />
          </div>
          <div className={styles.formRow}>
            <label>To:</label>
            <input
              type="text"
              value={editedElement.to}
              onChange={(e) =>
                setEditedElement({ ...editedElement, to: e.target.value })
              }
              disabled={saving}
            />
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <span className={styles.optionLabel}>
                {opt.from_name ?? opt.from} → {opt.to_name ?? opt.to}
              </span>
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Helper to render node edit fields based on type
function renderNodeEditFields(
  element: NodeChangeAI,
  editedElement: NodeChangeAI,
  setEditedElement: (e: NodeChangeAI) => void,
  saving: boolean
) {
  const data = (editedElement.data ?? {}) as Record<string, unknown>;
  const nodeType = element.node_type.toLowerCase();

  const updateData = (field: string, value: unknown) => {
    setEditedElement({
      ...editedElement,
      data: { ...data, [field]: value },
    });
  };

  // Common fields based on node type
  if (nodeType === 'character') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Name:</label>
          <input
            type="text"
            value={(data.name as string) ?? ''}
            onChange={(e) => updateData('name', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Role:</label>
          <input
            type="text"
            value={(data.role as string) ?? ''}
            onChange={(e) => updateData('role', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Description:</label>
          <textarea
            rows={3}
            value={(data.description as string) ?? ''}
            onChange={(e) => updateData('description', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Arc Summary:</label>
          <textarea
            rows={2}
            value={(data.arc_summary as string) ?? ''}
            onChange={(e) => updateData('arc_summary', e.target.value)}
            disabled={saving}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'storybeat') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Title:</label>
          <input
            type="text"
            value={(data.title as string) ?? ''}
            onChange={(e) => updateData('title', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Intent:</label>
          <select
            value={(data.intent as string) ?? 'plot'}
            onChange={(e) => updateData('intent', e.target.value)}
            disabled={saving}
          >
            <option value="plot">Plot</option>
            <option value="character">Character</option>
            <option value="tone">Tone</option>
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Summary:</label>
          <textarea
            rows={3}
            value={(data.summary as string) ?? ''}
            onChange={(e) => updateData('summary', e.target.value)}
            disabled={saving}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'scene') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Heading:</label>
          <input
            type="text"
            value={(data.heading as string) ?? ''}
            onChange={(e) => updateData('heading', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Overview:</label>
          <textarea
            rows={3}
            value={(data.scene_overview as string) ?? ''}
            onChange={(e) => updateData('scene_overview', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Tone:</label>
          <input
            type="text"
            value={(data.tone as string) ?? ''}
            onChange={(e) => updateData('tone', e.target.value)}
            disabled={saving}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'location') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Name:</label>
          <input
            type="text"
            value={(data.name as string) ?? ''}
            onChange={(e) => updateData('name', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Description:</label>
          <textarea
            rows={3}
            value={(data.description as string) ?? ''}
            onChange={(e) => updateData('description', e.target.value)}
            disabled={saving}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'beat') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Type:</label>
          <input
            type="text"
            value={(data.beat_type as string) ?? ''}
            onChange={(e) => updateData('beat_type', e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={styles.formRow}>
          <label>Act:</label>
          <select
            value={(data.act as number) ?? 1}
            onChange={(e) => updateData('act', parseInt(e.target.value, 10))}
            disabled={saving}
          >
            <option value={1}>Act 1</option>
            <option value={2}>Act 2</option>
            <option value={3}>Act 3</option>
            <option value={4}>Act 4</option>
            <option value={5}>Act 5</option>
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Guidance:</label>
          <textarea
            rows={2}
            value={(data.guidance as string) ?? ''}
            onChange={(e) => updateData('guidance', e.target.value)}
            disabled={saving}
          />
        </div>
      </>
    );
  }

  // Fallback: generic JSON editor
  return (
    <div className={styles.formRow}>
      <label>Data (JSON):</label>
      <textarea
        rows={6}
        value={JSON.stringify(data, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            setEditedElement({ ...editedElement, data: parsed });
          } catch {
            // Invalid JSON, ignore
          }
        }}
        className={styles.jsonEditor}
        disabled={saving}
      />
    </div>
  );
}

// Helper functions
function getNodeLabel(node: NodeChangeAI): string {
  const data = node.data ?? {};
  return (
    (data.name as string) ??
    (data.title as string) ??
    (data.heading as string) ??
    node.node_id
  );
}

function getNodeDescription(node: NodeChangeAI): string | null {
  const data = node.data ?? {};
  return (
    (data.description as string) ??
    (data.summary as string) ??
    (data.scene_overview as string) ??
    null
  );
}
