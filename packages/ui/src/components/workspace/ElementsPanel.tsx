/**
 * ElementsPanel - Collapsible left sidebar showing story elements.
 * Contains expandable sections for Characters, Locations, Objects,
 * plus Story Context link.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import styles from './ElementsPanel.module.css';

interface ElementsPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNodeClick: (nodeId: string) => void;
  onStoryContextClick: () => void;
  onAddElement?: (type: 'Character' | 'Location' | 'Object') => void;
}

interface ElementSection {
  type: 'Character' | 'Location' | 'Object';
  label: string;
  nodes: NodeData[];
  expanded: boolean;
}

export function ElementsPanel({
  isCollapsed,
  onToggleCollapse,
  onNodeClick,
  onStoryContextClick,
  onAddElement,
}: ElementsPanelProps) {
  const { currentStoryId, status } = useStory();
  const [sections, setSections] = useState<ElementSection[]>([
    { type: 'Character', label: 'Characters', nodes: [], expanded: true },
    { type: 'Location', label: 'Locations', nodes: [], expanded: false },
    { type: 'Object', label: 'Objects', nodes: [], expanded: false },
  ]);
  const [loading, setLoading] = useState(false);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);

  // Fetch all element types
  const fetchElements = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    try {
      const [charactersRes, locationsRes, objectsRes] = await Promise.all([
        api.listNodes(currentStoryId, 'Character', 50),
        api.listNodes(currentStoryId, 'Location', 50),
        api.listNodes(currentStoryId, 'Object', 50),
      ]);

      setSections((prev) => {
        const char = prev[0];
        const loc = prev[1];
        const obj = prev[2];
        return [
          { type: char?.type ?? 'Character', label: char?.label ?? 'Characters', expanded: char?.expanded ?? true, nodes: charactersRes.nodes },
          { type: loc?.type ?? 'Location', label: loc?.label ?? 'Locations', expanded: loc?.expanded ?? false, nodes: locationsRes.nodes },
          { type: obj?.type ?? 'Object', label: obj?.label ?? 'Objects', expanded: obj?.expanded ?? false, nodes: objectsRes.nodes },
        ];
      });
    } catch (err) {
      console.error('Failed to fetch elements:', err);
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

  const toggleSection = (index: number) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, expanded: !section.expanded } : section
      )
    );
  };

  const getNodeName = (node: NodeData): string => {
    const data = node.data;
    return (data.name as string) || (data.label as string) || node.label || node.id;
  };

  const handleAddClick = (type: 'Character' | 'Location' | 'Object') => {
    setAddDropdownOpen(false);
    onAddElement?.(type);
  };

  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Expand panel"
        >
          &#9654;
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Elements</h3>
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Collapse panel"
        >
          &#9664;
        </button>
      </div>

      <div className={styles.content}>
        {/* Element Sections */}
        <div className={styles.sections}>
          {sections.map((section, index) => (
            <div key={section.type} className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection(index)}
                type="button"
              >
                <span className={styles.chevron}>
                  {section.expanded ? '▼' : '▶'}
                </span>
                <span className={styles.sectionLabel}>{section.label}</span>
                <span className={styles.sectionCount}>({section.nodes.length})</span>
              </button>

              {section.expanded && (
                <div className={styles.sectionContent}>
                  {section.nodes.length === 0 ? (
                    <div className={styles.emptySection}>
                      No {section.label.toLowerCase()} yet
                    </div>
                  ) : (
                    <ul className={styles.itemList}>
                      {section.nodes.map((node) => (
                        <li key={node.id}>
                          <button
                            className={styles.itemButton}
                            onClick={() => onNodeClick(node.id)}
                            type="button"
                          >
                            <span className={styles.itemDot}>•</span>
                            <span className={styles.itemName}>{getNodeName(node)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Element Button */}
        <div className={styles.addElementWrapper}>
          <button
            className={styles.addElementButton}
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
                Character
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleAddClick('Location')}
                type="button"
              >
                Location
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleAddClick('Object')}
                type="button"
              >
                Object
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Story Context Section */}
        <div className={styles.contextSection}>
          <h4 className={styles.contextTitle}>Story Context</h4>
          <button
            className={styles.contextButton}
            onClick={onStoryContextClick}
            type="button"
          >
            <span className={styles.contextIcon}>📄</span>
            <span>Open Editor</span>
            {status?.hasStoryContext && (
              <span className={styles.contextCheck}>✓</span>
            )}
          </button>
        </div>

      </div>

      {loading && <div className={styles.loadingOverlay}>Loading...</div>}
    </div>
  );
}
