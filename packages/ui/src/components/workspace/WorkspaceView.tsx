/**
 * WorkspaceView - Main workspace with 3-zone layout:
 * 1. PremiseHeader (top) - Story title, logline, genre/tone, setting
 * 2. ElementsPanel (left) - Characters, Locations, Objects + extraction
 * 3. StructureBoard (main) - Always-visible outline with inline expansion
 */

import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { PremiseHeader } from './PremiseHeader';
import { PremiseEditModal } from './PremiseEditModal';
import { ElementsPanel } from './ElementsPanel';
import { StructureBoard } from './StructureBoard';
import { StoryContextModal } from '../context/StoryContextModal';
import styles from './WorkspaceView.module.css';

export function WorkspaceView() {
  const { currentStoryId, refreshStatus } = useStory();

  // Panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Modal states
  const [premiseModalOpen, setPremiseModalOpen] = useState(false);
  const [storyContextModalOpen, setStoryContextModalOpen] = useState(false);

  // Handle node click from ElementsPanel
  // TODO: Implement node detail modal - for now just log
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log('Node clicked:', nodeId);
    // Future: Open a simplified node detail modal or inline editor
  }, []);

  // Handle save from modals (refresh data)
  const handlePremiseSave = useCallback(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Handle add element (placeholder - could open a create modal)
  const handleAddElement = useCallback((type: 'Character' | 'Location' | 'Object') => {
    // For now, just log - could open a create modal in future
    console.log('Add element:', type);
    // TODO: Open a create modal for the specific type
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

      {/* Main Area: Elements Panel + Structure Board */}
      <div className={styles.mainArea}>
        <ElementsPanel
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
          onNodeClick={handleNodeClick}
          onStoryContextClick={() => setStoryContextModalOpen(true)}
          onAddElement={handleAddElement}
        />
        <StructureBoard />
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
    </div>
  );
}
