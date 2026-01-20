/**
 * ElementsBoard - Grid view of all story elements grouped by type.
 * Displays Characters, Locations, and Objects as cards in responsive grids.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import type { ElementType } from './types';
import { ElementCard } from './ElementCard';
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
}

export function ElementsBoard({ onElementClick, onAddElement }: ElementsBoardProps) {
  const { currentStoryId, status } = useStory();
  const [sections, setSections] = useState<ElementSection[]>([
    { type: 'Character', label: 'Characters', icon: '👤', nodes: [] },
    { type: 'Location', label: 'Locations', icon: '📍', nodes: [] },
    { type: 'Object', label: 'Objects', icon: '📦', nodes: [] },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);

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

      setSections([
        { type: 'Character', label: 'Characters', icon: '👤', nodes: charactersRes.nodes },
        { type: 'Location', label: 'Locations', icon: '📍', nodes: locationsRes.nodes },
        { type: 'Object', label: 'Objects', icon: '📦', nodes: objectsRes.nodes },
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
        {sections.map((section) => (
        <div key={section.type} className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>{section.icon}</span>
              <h3 className={styles.sectionLabel}>{section.label}</h3>
              <span className={styles.sectionCount}>({section.nodes.length})</span>
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

          {section.nodes.length === 0 ? (
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
        ))}
      </div>
    </div>
  );
}
