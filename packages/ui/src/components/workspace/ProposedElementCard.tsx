/**
 * ProposedElementCard - Displays a proposed element (Character, Location, Object)
 * with inline editing capability and proposed styling.
 */

import { useState, useCallback } from 'react';
import type { MergedNode } from '../../utils/stagingUtils';
import type { ElementType } from './types';
import styles from './ProposedElementCard.module.css';
import { useStory } from '../../context/StoryContext';
import { useStashContext } from '../../context/StashContext';

interface ProposedElementCardProps {
  element: MergedNode;
  elementType: ElementType;
  onEdit: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  onRemove?: ((nodeId: string) => void) | undefined;
  isRemoved?: boolean | undefined;
  onUndoRemove?: ((nodeId: string) => void) | undefined;
}

const TYPE_CONFIG = {
  Character: { icon: '\uD83D\uDC64', label: 'CHARACTER', colorClass: 'character' },
  Location: { icon: '\uD83D\uDCCD', label: 'LOCATION', colorClass: 'location' },
  Object: { icon: '\uD83D\uDCE6', label: 'OBJECT', colorClass: 'object' },
} as const;

// Field configurations by element type
const FIELD_CONFIGS: Record<ElementType, Array<{ key: string; label: string; type: 'text' | 'textarea' }>> = {
  Character: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  Location: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  Object: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
};

export function ProposedElementCard({
  element,
  elementType,
  onEdit,
  onRemove,
  isRemoved = false,
  onUndoRemove,
}: ProposedElementCardProps) {
  const { currentStoryId } = useStory();
  const { createIdea } = useStashContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState<Record<string, unknown>>({ ...element.data });

  const config = TYPE_CONFIG[elementType];
  const fields = FIELD_CONFIGS[elementType];

  // Get name and description from data
  const name = (localData.name as string) || (localData.label as string) || element.label || element.id;
  const description = (localData.description as string) || (localData.bio as string) || (localData.summary as string) || '';

  const operationClass =
    element._operation === 'add'
      ? styles.opAdd
      : element._operation === 'modify'
      ? styles.opModify
      : styles.opDelete;

  const operationLabel =
    element._operation === 'add'
      ? 'NEW'
      : element._operation === 'modify'
      ? 'MODIFIED'
      : 'REMOVING';

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      onEdit(element.id, { [key]: value });
    },
    [element.id, onEdit]
  );

  const handleRemove = useCallback(() => {
    onRemove?.(element.id);
  }, [element.id, onRemove]);

  const handleUndoRemove = useCallback(() => {
    onUndoRemove?.(element.id);
  }, [element.id, onUndoRemove]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Removed state
  if (isRemoved) {
    return (
      <div className={`${styles.card} ${styles.removed}`}>
        <div className={styles.removedContent}>
          <span className={styles.removedIcon}>{'\u2715'}</span>
          <span className={styles.removedLabel}>
            {elementType}: {name} - will not be added
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
    <div className={`${styles.card} ${styles[config.colorClass]} ${operationClass}`}>
      {/* Operation badge */}
      <span className={`${styles.operationBadge} ${operationClass}`}>+ {operationLabel}</span>

      {/* Header - clickable to expand */}
      <button
        className={styles.header}
        onClick={toggleExpand}
        type="button"
      >
        <div className={styles.typeBadge}>
          <span className={styles.typeIcon}>{config.icon}</span>
          <span className={styles.typeLabel}>{config.label}</span>
        </div>

        <h4 className={styles.name}>{name}</h4>

        <span className={styles.expandIcon}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {/* Collapsed: show description preview */}
      {!isExpanded && description && (
        <p className={styles.description}>
          {description.length > 100 ? `${description.slice(0, 100)}...` : description}
        </p>
      )}

      {/* Expanded: inline editor */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Show previous data for modifications */}
          {element._operation === 'modify' && element._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {(element._previousData.name as string) ?? 'Unnamed'}
              </span>
            </div>
          )}

          {/* Fields */}
          <div className={styles.fields}>
            {fields.map((field) => (
              <div key={field.key} className={styles.field}>
                <label className={styles.fieldLabel}>{field.label}</label>
                {field.type === 'text' ? (
                  <input
                    type="text"
                    className={styles.input}
                    value={(localData[field.key] as string) ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    className={styles.textarea}
                    value={(localData[field.key] as string) ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    rows={3}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.doneButton}
              onClick={toggleExpand}
              type="button"
            >
              Done
            </button>
            <button
              className={styles.saveButton}
              onClick={async () => {
                if (!currentStoryId) return;
                const title = `${elementType}: ${name}`;
                const desc = String(localData.description ?? localData.summary ?? '');
                const suggestedType = elementType as any;
                await createIdea(title, desc, suggestedType, 'ai');
              }}
              type="button"
            >
              Send to Stash
            </button>
            {onRemove && element._operation === 'add' && (
              <button
                className={styles.removeButton}
                onClick={handleRemove}
                type="button"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
