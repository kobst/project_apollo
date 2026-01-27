/**
 * ListEditor
 *
 * A reusable component for editing arrays of strings.
 * Used for thematicPillars, banned elements, etc.
 */

import { useState, useCallback } from 'react';
import styles from './ListEditor.module.css';

interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxItems?: number;
  /** Proposed items to show as highlighted (from staged package) */
  proposedItems?: string[];
}

export function ListEditor({
  label,
  items,
  onChange,
  placeholder = 'Add item...',
  disabled = false,
  maxItems,
  proposedItems = [],
}: ListEditorProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (maxItems && items.length >= maxItems) return;

    onChange([...items, trimmed]);
    setNewItem('');
  }, [newItem, items, onChange, maxItems]);

  const handleRemove = useCallback((index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  }, [items, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  const handleItemChange = useCallback((index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  }, [items, onChange]);

  const canAdd = !maxItems || items.length < maxItems;

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>
      <div className={styles.list}>
        {items.map((item, index) => (
          <div key={index} className={styles.item}>
            <input
              type="text"
              className={styles.itemInput}
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => handleRemove(index)}
              disabled={disabled}
              title="Remove item"
            >
              x
            </button>
          </div>
        ))}
        {/* Proposed items */}
        {proposedItems.map((item, index) => (
          <div key={`proposed-${index}`} className={`${styles.item} ${styles.proposedItem}`}>
            <span className={styles.proposedBadge}>+</span>
            <span className={styles.proposedText}>{item}</span>
          </div>
        ))}
      </div>
      {canAdd && (
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.addInput}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAdd}
            disabled={disabled || !newItem.trim()}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
