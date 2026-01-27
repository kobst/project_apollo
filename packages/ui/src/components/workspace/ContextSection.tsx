/**
 * ContextSection - Story Context editor wrapped in CollapsibleSection.
 * Embeds StoryContextEditor for structured context editing.
 * Proposed changes are shown inline in the editor with green highlighting.
 */

import { useGeneration } from '../../context/GenerationContext';
import { CollapsibleSection } from './CollapsibleSection';
import { StoryContextEditor } from '../context/StoryContextEditor';
import styles from './ContextSection.module.css';

export function ContextSection() {
  const { sectionChangeCounts } = useGeneration();

  // Get badge counts
  const contextCounts = sectionChangeCounts?.storyContext;
  const badge = contextCounts && (contextCounts.additions > 0 || contextCounts.modifications > 0)
    ? { additions: contextCounts.additions, modifications: contextCounts.modifications }
    : undefined;

  return (
    <CollapsibleSection
      id="context"
      title="Story Context"
      icon={'\uD83D\uDCC4'}
      badge={badge}
      defaultExpanded={false}
    >
      <div className={styles.container}>
        {/* Story Context Editor - proposed changes shown inline with highlighting */}
        <StoryContextEditor compact />
      </div>
    </CollapsibleSection>
  );
}
