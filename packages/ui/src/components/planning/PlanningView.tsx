import { useState, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useStashContext, type StashIdeaItem } from '../../context/StashContext';
import { PlanningInventory } from './PlanningInventory';
import { PlanningCenter } from './PlanningCenter';
import { PlanningRightPanel } from './PlanningRightPanel';
import styles from './PlanningView.module.css';

export function PlanningView() {
  const { currentStoryId } = useStory();
  const { ideas } = useStashContext();
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'promoted' | 'dismissed'>('active');
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // Planning tab only shows abstract planning ideas (no suggestedType).
  // Concrete artifacts (Character, StoryBeat, Scene, etc.) live in the workspace stash.
  const planningIdeas = useMemo(() => {
    return ideas.filter((idea) => !idea.suggestedType);
  }, [ideas]);

  const selectedIdea = planningIdeas.find((i) => i.id === selectedIdeaId) ?? null;

  const handleSelectIdea = useCallback((idea: StashIdeaItem) => {
    setSelectedIdeaId(idea.id);
  }, []);

  const handleDeselectIdea = useCallback(() => {
    setSelectedIdeaId(null);
  }, []);

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Stories tab to begin planning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <PlanningInventory
          ideas={planningIdeas}
          selectedIdeaId={selectedIdeaId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onSelectIdea={handleSelectIdea}
        />

        <PlanningCenter
          ideas={planningIdeas}
          selectedIdea={selectedIdea}
          statusFilter={statusFilter}
          onSelectIdea={handleSelectIdea}
          onDeselectIdea={handleDeselectIdea}
        />

        <PlanningRightPanel
          isCollapsed={isRightPanelCollapsed}
          onToggleCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        />
      </div>
    </div>
  );
}
