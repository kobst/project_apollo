/**
 * WorkspaceView - Main workspace with Story Bible layout:
 * 1. PremiseHeader (top) - Story title only
 * 2. TableOfContents (left) - Scroll-spy navigation
 * 3. StoryBible (center) - Unified scrollable document with all sections
 * 4. GenerationPanel (right) - AI generation controls
 */

import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { PremiseHeader } from './PremiseHeader';
import { StoryBible } from './StoryBible';
import { GenerationPanel } from './GenerationPanel';
import { ElementDetailModal } from './ElementDetailModal';
import { AddElementModal, type AddElementType } from './AddElementModal';
import type { ElementType, ElementModalState } from './types';
import styles from './WorkspaceView.module.css';

// Selected node info for Expand mode
export interface SelectedNodeInfo {
  id: string;
  type: string;
  name: string;
}

export function WorkspaceView() {
  const { currentStoryId } = useStory();

  // TOC collapse state (replaces sidebar collapse)
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);

  // Generation panel collapse state
  const [isGenPanelCollapsed, setIsGenPanelCollapsed] = useState(false);

  // Element detail modal state
  const [elementModal, setElementModal] = useState<ElementModalState | null>(null);

  // Add element modal state
  const [addElementType, setAddElementType] = useState<AddElementType | null>(null);

  // Selected node for Expand mode
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);

  // Whether we're in node selection mode (Expand mode with "Selected Node" target)
  const [nodeSelectionMode, setNodeSelectionMode] = useState(false);

  // Handle element click - open detail modal OR select for expand
  const handleElementClick = useCallback((elementId: string, elementType: string, elementName?: string) => {
    if (nodeSelectionMode) {
      // In selection mode, select the node instead of opening modal
      setSelectedNode({
        id: elementId,
        type: elementType,
        name: elementName ?? elementId,
      });
    } else {
      // Normal mode - open detail modal (only for Character, Location, Object)
      const modalTypes = ['Character', 'Location', 'Object'];
      if (modalTypes.includes(elementType)) {
        setElementModal({ elementId, elementType: elementType as ElementType });
      }
      // StoryBeat and Scene have their own edit panel in StructureSection
    }
  }, [nodeSelectionMode]);

  // Handle close element detail modal
  const handleCloseElementModal = useCallback(() => {
    setElementModal(null);
  }, []);

  // Handle add element - open add element modal
  const handleAddElement = useCallback((type: ElementType) => {
    setAddElementType(type as AddElementType);
  }, []);

  // Handle close add element modal
  const handleCloseAddElement = useCallback(() => {
    setAddElementType(null);
  }, []);

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Stories tab to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top: Premise Header */}
      <PremiseHeader />

      {/* Main Area: TOC + Story Bible + Generation Panel */}
      <div className={styles.mainArea}>
        <StoryBible
          onElementClick={handleElementClick}
          onAddElement={handleAddElement}
          isTocCollapsed={isTocCollapsed}
          onToggleTocCollapse={() => setIsTocCollapsed(!isTocCollapsed)}
          nodeSelectionMode={nodeSelectionMode}
        />

        <GenerationPanel
          isCollapsed={isGenPanelCollapsed}
          onToggleCollapse={() => setIsGenPanelCollapsed(!isGenPanelCollapsed)}
          selectedNode={selectedNode}
          onClearSelectedNode={() => setSelectedNode(null)}
          onNodeSelectionModeChange={setNodeSelectionMode}
        />
      </div>

      {/* Modals */}
      {elementModal && (
        <ElementDetailModal
          elementId={elementModal.elementId}
          elementType={elementModal.elementType}
          onClose={handleCloseElementModal}
          onElementClick={handleElementClick}
        />
      )}

      {addElementType && (
        <AddElementModal
          elementType={addElementType}
          onClose={handleCloseAddElement}
          onSuccess={handleCloseAddElement}
        />
      )}
    </div>
  );
}
