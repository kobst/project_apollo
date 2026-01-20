/**
 * WorkspaceSidebar - Navigation sidebar for workspace views.
 * Contains nav items for Structure Board and Elements, plus Story Context action.
 */

import type { WorkspaceView } from './types';
import styles from './WorkspaceSidebar.module.css';

interface WorkspaceSidebarProps {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onStoryContextClick: () => void;
  hasStoryContext?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function WorkspaceSidebar({
  activeView,
  onViewChange,
  onStoryContextClick,
  hasStoryContext,
  isCollapsed,
  onToggleCollapse,
}: WorkspaceSidebarProps) {
  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Expand sidebar"
        >
          ▶
        </button>
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
          ◀
        </button>
      </div>

      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${activeView === 'premise' ? styles.active : ''}`}
          onClick={() => onViewChange('premise')}
          type="button"
        >
          <span className={styles.navIcon}>📝</span>
          <span className={styles.navLabel}>Premise</span>
        </button>

        <button
          className={`${styles.navItem} ${activeView === 'structure' ? styles.active : ''}`}
          onClick={() => onViewChange('structure')}
          type="button"
        >
          <span className={styles.navIcon}>📋</span>
          <span className={styles.navLabel}>Structure Board</span>
        </button>

        <button
          className={`${styles.navItem} ${activeView === 'elements' ? styles.active : ''}`}
          onClick={() => onViewChange('elements')}
          type="button"
        >
          <span className={styles.navIcon}>👥</span>
          <span className={styles.navLabel}>Elements</span>
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
          <span className={styles.contextIcon}>📄</span>
          <span>Open Editor</span>
          {hasStoryContext && <span className={styles.contextCheck}>✓</span>}
        </button>
      </div>
    </div>
  );
}
