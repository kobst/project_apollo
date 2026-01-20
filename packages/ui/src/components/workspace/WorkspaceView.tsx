/**
 * WorkspaceView - Main workspace with sidebar navigation + main content layout:
 * 1. PremiseHeader (top) - Story title, logline, genre/tone, setting
 * 2. WorkspaceSidebar (left) - Navigation: Structure Board, Elements, Story Context
 * 3. Main content (right) - Structure Board or Elements Board based on selection
 */

import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { PremiseHeader } from './PremiseHeader';
import { PremiseEditModal } from './PremiseEditModal';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { StructureBoard } from './StructureBoard';
import { ElementsBoard } from './ElementsBoard';
import { ElementDetailModal } from './ElementDetailModal';
import { AddElementModal, type AddElementType } from './AddElementModal';
import { StoryContextModal } from '../context/StoryContextModal';
import type { WorkspaceView as WorkspaceViewType, ElementType, ElementModalState } from './types';
import styles from './WorkspaceView.module.css';

export function WorkspaceView() {
  const { currentStoryId, refreshStatus, status } = useStory();

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Workspace view state (structure or elements)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceViewType>('structure');

  // Element detail modal state
  const [elementModal, setElementModal] = useState<ElementModalState | null>(null);

  // Other modal states
  const [premiseModalOpen, setPremiseModalOpen] = useState(false);
  const [storyContextModalOpen, setStoryContextModalOpen] = useState(false);
  const [addElementType, setAddElementType] = useState<AddElementType | null>(null);

  // Handle element click - open detail modal
  const handleElementClick = useCallback((elementId: string, elementType: ElementType) => {
    setElementModal({ elementId, elementType });
  }, []);

  // Handle close element detail modal
  const handleCloseElementModal = useCallback(() => {
    setElementModal(null);
  }, []);

  // Handle save from modals (refresh data)
  const handlePremiseSave = useCallback(() => {
    void refreshStatus();
  }, [refreshStatus]);

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
      <PremiseHeader onEditPremise={() => setPremiseModalOpen(true)} />

      {/* Main Area: Sidebar + Main Content */}
      <div className={styles.mainArea}>
        <WorkspaceSidebar
          activeView={workspaceView}
          onViewChange={setWorkspaceView}
          onStoryContextClick={() => setStoryContextModalOpen(true)}
          hasStoryContext={status?.hasStoryContext ?? false}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div className={styles.mainContent}>
          {workspaceView === 'structure' ? (
            <StructureBoard />
          ) : (
            <ElementsBoard
              onElementClick={handleElementClick}
              onAddElement={handleAddElement}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {premiseModalOpen && (
        <PremiseEditModal
          onClose={() => setPremiseModalOpen(false)}
          onSave={handlePremiseSave}
        />
      )}

      {storyContextModalOpen && (
        <StoryContextModal onClose={() => setStoryContextModalOpen(false)} />
      )}

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
