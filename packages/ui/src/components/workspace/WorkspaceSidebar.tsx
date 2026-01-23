/**
 * WorkspaceSidebar - Navigation sidebar for workspace views.
 * Contains nav items for Structure Board and Elements, plus Story Context action.
 * Displays badges for staged changes when a package is staged.
 */

import type { WorkspaceView } from './types';
import type { SectionChangeCounts } from '../../utils/stagingUtils';
import styles from './WorkspaceSidebar.module.css';

interface WorkspaceSidebarProps {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onStoryContextClick: () => void;
  hasStoryContext?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Section change counts for staged package */
  sectionChangeCounts?: SectionChangeCounts;
  /** Whether a package is currently staged */
  hasStagedPackage?: boolean;
}

// Helper to render change badge
function ChangeBadge({ additions, modifications }: { additions: number; modifications: number }) {
  const total = additions + modifications;
  if (total === 0) return null;

  return (
    <span className={styles.changeBadge}>
      {additions > 0 && (
        <span className={styles.additionBadge}>+{additions}</span>
      )}
      {modifications > 0 && (
        <span className={styles.modificationBadge}>~{modifications}</span>
      )}
    </span>
  );
}

export function WorkspaceSidebar({
  activeView,
  onViewChange,
  onStoryContextClick,
  hasStoryContext,
  isCollapsed,
  onToggleCollapse,
  sectionChangeCounts,
  hasStagedPackage,
}: WorkspaceSidebarProps) {
  // Compute total changes for "All Changes" badge
  const totalChanges = sectionChangeCounts
    ? (sectionChangeCounts.premise.additions + sectionChangeCounts.premise.modifications +
       sectionChangeCounts.structure.additions + sectionChangeCounts.structure.modifications +
       sectionChangeCounts.elements.additions + sectionChangeCounts.elements.modifications +
       sectionChangeCounts.storyContext.additions + sectionChangeCounts.storyContext.modifications)
    : 0;

  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Expand sidebar"
        >
          {'\u25B6'}
        </button>
        {hasStagedPackage && totalChanges > 0 && (
          <div className={styles.collapsedBadge}>{totalChanges}</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Workspace</h3>
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Collapse sidebar"
        >
          {'\u25C0'}
        </button>
      </div>

      <nav className={styles.nav}>
        {/* All Changes - only shown when staging */}
        {hasStagedPackage && (
          <button
            className={`${styles.navItem} ${styles.allChangesItem} ${activeView === 'allChanges' ? styles.active : ''}`}
            onClick={() => onViewChange('allChanges')}
            type="button"
          >
            <span className={styles.navIcon}>{'\u2728'}</span>
            <span className={styles.navLabel}>All Changes</span>
            {totalChanges > 0 && (
              <span className={styles.totalBadge}>{totalChanges}</span>
            )}
          </button>
        )}

        <button
          className={`${styles.navItem} ${activeView === 'premise' ? styles.active : ''}`}
          onClick={() => onViewChange('premise')}
          type="button"
        >
          <span className={styles.navIcon}>{'\uD83D\uDCDD'}</span>
          <span className={styles.navLabel}>Premise</span>
          {sectionChangeCounts && (
            <ChangeBadge
              additions={sectionChangeCounts.premise.additions}
              modifications={sectionChangeCounts.premise.modifications}
            />
          )}
        </button>

        <button
          className={`${styles.navItem} ${activeView === 'structure' ? styles.active : ''}`}
          onClick={() => onViewChange('structure')}
          type="button"
        >
          <span className={styles.navIcon}>{'\uD83D\uDCCB'}</span>
          <span className={styles.navLabel}>Structure Board</span>
          {sectionChangeCounts && (
            <ChangeBadge
              additions={sectionChangeCounts.structure.additions}
              modifications={sectionChangeCounts.structure.modifications}
            />
          )}
        </button>

        <button
          className={`${styles.navItem} ${activeView === 'elements' ? styles.active : ''}`}
          onClick={() => onViewChange('elements')}
          type="button"
        >
          <span className={styles.navIcon}>{'\uD83D\uDC65'}</span>
          <span className={styles.navLabel}>Elements</span>
          {sectionChangeCounts && (
            <ChangeBadge
              additions={sectionChangeCounts.elements.additions}
              modifications={sectionChangeCounts.elements.modifications}
            />
          )}
        </button>
      </nav>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Story Context</h4>
        <button
          className={styles.contextButton}
          onClick={onStoryContextClick}
          type="button"
        >
          <span className={styles.contextIcon}>{'\uD83D\uDCC4'}</span>
          <span>Open Editor</span>
          {hasStoryContext && <span className={styles.contextCheck}>{'\u2713'}</span>}
          {sectionChangeCounts && sectionChangeCounts.storyContext.additions + sectionChangeCounts.storyContext.modifications > 0 && (
            <ChangeBadge
              additions={sectionChangeCounts.storyContext.additions}
              modifications={sectionChangeCounts.storyContext.modifications}
            />
          )}
        </button>
      </div>
    </div>
  );
}
