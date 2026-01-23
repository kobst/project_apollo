/**
 * WorkspaceView - Main workspace with sidebar navigation + main content layout:
 * 1. PremiseHeader (top) - Story title only
 * 2. WorkspaceSidebar (left) - Navigation: Premise, Structure Board, Elements, Story Context
 * 3. Main content (right) - PremisePanel, StructureBoard, or ElementsBoard based on selection
 */

import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { PremiseHeader } from './PremiseHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { StructureBoard } from './StructureBoard';
import { ElementsBoard } from './ElementsBoard';
import { PremisePanel } from './PremisePanel';
import { GenerationPanel } from './GenerationPanel';
import { AllChangesView } from './AllChangesView';
import { ElementDetailModal } from './ElementDetailModal';
import { AddElementModal, type AddElementType } from './AddElementModal';
import { StoryContextModal } from '../context/StoryContextModal';
import type { WorkspaceView as WorkspaceViewType, ElementType, ElementModalState } from './types';
import styles from './WorkspaceView.module.css';

export function WorkspaceView() {
  const { currentStoryId, status } = useStory();
  const { stagedPackage, sectionChangeCounts } = useGeneration();

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Generation panel collapse state
  const [isGenPanelCollapsed, setIsGenPanelCollapsed] = useState(false);

  // Workspace view state (structure or elements)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceViewType>('structure');

  // Element detail modal state
  const [elementModal, setElementModal] = useState<ElementModalState | null>(null);

  // Other modal states
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

      {/* Main Area: Sidebar + Main Content */}
      <div className={styles.mainArea}>
        <WorkspaceSidebar
          activeView={workspaceView}
          onViewChange={setWorkspaceView}
          onStoryContextClick={() => setStoryContextModalOpen(true)}
          hasStoryContext={status?.hasStoryContext ?? false}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          sectionChangeCounts={sectionChangeCounts}
          hasStagedPackage={stagedPackage !== null}
        />

        <div className={styles.mainContent}>
          {workspaceView === 'premise' ? (
            <PremisePanel />
          ) : workspaceView === 'structure' ? (
            <StructureBoard />
          ) : workspaceView === 'elements' ? (
            <ElementsBoard
              onElementClick={handleElementClick}
              onAddElement={handleAddElement}
            />
          ) : workspaceView === 'allChanges' ? (
            <AllChangesView />
          ) : null}
        </div>

        <GenerationPanel
          isCollapsed={isGenPanelCollapsed}
          onToggleCollapse={() => setIsGenPanelCollapsed(!isGenPanelCollapsed)}
        />
      </div>

      {/* Modals */}
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
