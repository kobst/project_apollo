/**
 * InlineEditor - Expandable editor for proposed nodes in workspace views.
 * Displays a compact view of proposed changes with expand/collapse and inline editing.
 */

import { useState, useCallback } from 'react';
import type { MergedNode } from '../../utils/stagingUtils';
import styles from './InlineEditor.module.css';

interface InlineEditorProps {
  /** The merged node data to display/edit */
  node: MergedNode;
  /** Called when a field is edited */
  onEdit: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  /** Called when the node is removed from staging */
  onRemove?: ((nodeId: string) => void) | undefined;
  /** Whether this node is marked for removal */
  isRemoved?: boolean | undefined;
  /** Called to undo removal */
  onUndoRemove?: ((nodeId: string) => void) | undefined;
  /** Whether editing is disabled */
  disabled?: boolean | undefined;
}

// Node type field configurations
interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  rows?: number;
}

const NODE_FIELD_CONFIGS: Record<string, FieldConfig[]> = {
  Character: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
    { key: 'arc_summary', label: 'Arc Summary', type: 'textarea', rows: 2 },
  ],
  Location: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
  ],
  Object: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
  ],
  Scene: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'scene_overview', label: 'Overview', type: 'textarea', rows: 3 },
    { key: 'mood', label: 'Mood', type: 'text' },
    {
      key: 'int_ext',
      label: 'Int/Ext',
      type: 'select',
      options: [
        { value: 'INT', label: 'Interior' },
        { value: 'EXT', label: 'Exterior' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
  ],
  StoryBeat: [
    { key: 'title', label: 'Title', type: 'text' },
    {
      key: 'intent',
      label: 'Intent',
      type: 'select',
      options: [
        { value: 'plot', label: 'Plot' },
        { value: 'character', label: 'Character' },
        { value: 'tone', label: 'Tone' },
      ],
    },
    { key: 'summary', label: 'Summary', type: 'textarea', rows: 3 },
  ],
  Beat: [
    { key: 'beat_type', label: 'Beat Type', type: 'text' },
    {
      key: 'act',
      label: 'Act',
      type: 'select',
      options: [
        { value: '1', label: 'Act 1' },
        { value: '2', label: 'Act 2' },
        { value: '3', label: 'Act 3' },
        { value: '4', label: 'Act 4' },
        { value: '5', label: 'Act 5' },
      ],
    },
    { key: 'guidance', label: 'Guidance', type: 'textarea', rows: 2 },
  ],
};

// Get operation display
function getOpDisplay(op: string): { icon: string; label: string; className: string } {
  switch (op) {
    case 'add':
      return { icon: '+', label: 'New', className: styles.opAdd ?? '' };
    case 'modify':
      return { icon: '~', label: 'Modified', className: styles.opModify ?? '' };
    case 'delete':
      return { icon: '-', label: 'Removing', className: styles.opDelete ?? '' };
    default:
      return { icon: '', label: '', className: '' };
  }
}

// Get display label for a node
function getNodeLabel(node: MergedNode): string {
  const data = node.data;
  const name = data.name as string | undefined;
  const title = data.title as string | undefined;
  const heading = data.heading as string | undefined;
  const beatType = data.beat_type as string | undefined;
  return name ?? title ?? heading ?? beatType ?? node.type;
}

// Get description for a node
function getNodeDescription(node: MergedNode): string | null {
  const data = node.data;
  return (
    (data.description as string) ??
    (data.summary as string) ??
    (data.scene_overview as string) ??
    (data.text as string) ??
    null
  );
}

export function InlineEditor({
  node,
  onEdit,
  onRemove,
  isRemoved = false,
  onUndoRemove,
  disabled = false,
}: InlineEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState<Record<string, unknown>>({ ...node.data });

  const { icon, label, className: opClassName } = getOpDisplay(node._operation);
  const nodeLabel = getNodeLabel(node);
  const description = getNodeDescription(node);
  const fieldConfigs = NODE_FIELD_CONFIGS[node.type] ?? [];

  // Handle field change
  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const newData = { ...localData, [key]: value };
      setLocalData(newData);
      onEdit(node.id, { [key]: value });
    },
    [localData, node.id, onEdit]
  );

  // Handle remove click
  const handleRemove = useCallback(() => {
    onRemove?.(node.id);
  }, [node.id, onRemove]);

  // Handle undo remove
  const handleUndoRemove = useCallback(() => {
    onUndoRemove?.(node.id);
  }, [node.id, onUndoRemove]);

  // Removed state overlay
  if (isRemoved) {
    return (
      <div className={`${styles.container} ${styles.removed}`}>
        <div className={styles.removedContent}>
          <span className={styles.removedIcon}>{'\u2715'}</span>
          <span className={styles.removedLabel}>
            {node.type}: {nodeLabel} - will not be added
          </span>
          {onUndoRemove && (
            <button
              className={styles.undoButton}
              onClick={handleUndoRemove}
              type="button"
            >
              Undo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${opClassName}`}>
      {/* Header - always visible */}
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className={styles.opBadge}>
          <span className={styles.opIcon}>{icon}</span>
          <span className={styles.opLabel}>{label}</span>
        </span>
        <span className={styles.nodeType}>{node.type}</span>
        <span className={styles.nodeLabel}>{nodeLabel}</span>
        <span className={styles.expandIcon}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {/* Collapsed preview */}
      {!isExpanded && description && (
        <p className={styles.preview}>
          {description.length > 100 ? `${description.slice(0, 100)}...` : description}
        </p>
      )}

      {/* Expanded editor */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Show previous data for modifications */}
          {node._operation === 'modify' && node._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {getNodeLabel({ ...node, data: node._previousData })}
              </span>
            </div>
          )}

          {/* Field editors */}
          <div className={styles.fields}>
            {fieldConfigs.map((field) => (
              <div key={field.key} className={styles.field}>
                <label className={styles.fieldLabel}>{field.label}</label>
                {field.type === 'text' && (
                  <input
                    type="text"
                    className={styles.input}
                    value={(localData[field.key] as string) ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    disabled={disabled}
                  />
                )}
                {field.type === 'textarea' && (
                  <textarea
                    className={styles.textarea}
                    value={(localData[field.key] as string) ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    rows={field.rows ?? 3}
                    disabled={disabled}
                  />
                )}
                {field.type === 'select' && (
                  <select
                    className={styles.select}
                    value={(localData[field.key] as string) ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    disabled={disabled}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          {onRemove && node._operation === 'add' && (
            <div className={styles.actions}>
              <button
                className={styles.removeButton}
                onClick={handleRemove}
                disabled={disabled}
                type="button"
              >
                Remove from package
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
