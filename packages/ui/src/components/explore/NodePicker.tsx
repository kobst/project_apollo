/**
 * Searchable dropdown for selecting a node.
 * Filters nodes by allowed types.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { NodeData } from '../../api/types';
import styles from './NodePicker.module.css';

interface NodePickerProps {
  nodes: NodeData[];
  selectedId?: string | undefined;
  allowedTypes?: string[] | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  onChange: (node: NodeData | null) => void;
}

export function NodePicker({
  nodes,
  selectedId,
  allowedTypes,
  placeholder = 'Select a node...',
  disabled = false,
  onChange,
}: NodePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter nodes by allowed types
  const filteredByType = useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return nodes;
    }
    return nodes.filter((node) => allowedTypes.includes(node.type));
  }, [nodes, allowedTypes]);

  // Further filter by search query
  const filteredNodes = useMemo(() => {
    if (!search.trim()) {
      return filteredByType;
    }
    const query = search.toLowerCase();
    return filteredByType.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    );
  }, [filteredByType, search]);

  // Get selected node
  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedId);
  }, [nodes, selectedId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  }, [disabled, isOpen]);

  const handleSelect = useCallback(
    (node: NodeData) => {
      onChange(node);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearch('');
    },
    [onChange]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={`${styles.trigger} ${disabled ? styles.disabled : ''} ${isOpen ? styles.open : ''}`}
        onClick={handleToggle}
      >
        {selectedNode ? (
          <div className={styles.selected}>
            <span className={styles.selectedLabel}>{selectedNode.label}</span>
            <span className={styles.selectedType}>{selectedNode.type}</span>
            {!disabled && (
              <button
                className={styles.clearBtn}
                onClick={handleClear}
                type="button"
                aria-label="Clear selection"
              >
                &times;
              </button>
            )}
          </div>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.nodeList}>
            {filteredNodes.length === 0 ? (
              <div className={styles.noResults}>
                {search ? 'No matching nodes' : 'No nodes available'}
              </div>
            ) : (
              filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className={`${styles.nodeItem} ${node.id === selectedId ? styles.nodeItemSelected : ''}`}
                  onClick={() => handleSelect(node)}
                >
                  <span className={styles.nodeLabel}>{node.label}</span>
                  <span className={styles.nodeType}>{node.type}</span>
                </div>
              ))
            )}
          </div>

          {allowedTypes && allowedTypes.length > 0 && (
            <div className={styles.allowedTypes}>
              Allowed: {allowedTypes.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
