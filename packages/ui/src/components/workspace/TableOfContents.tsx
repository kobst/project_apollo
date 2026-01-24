/**
 * TableOfContents - Anchor-based navigation for Story Bible.
 * Features scroll-spy highlighting, progress indicators, and act sub-navigation.
 */

import { useState, useCallback } from 'react';
import type { SectionChangeCounts, DetailedElementCounts, DetailedStructureCounts } from '../../utils/stagingUtils';
import styles from './TableOfContents.module.css';

interface ActData {
  id: string;
  actNumber: number;
  filledBeats: number;
  totalBeats: number;
  sceneCount: number;
}

interface ElementCounts {
  characters: number;
  locations: number;
  objects: number;
}

interface Progress {
  filled: number;
  total: number;
}

interface TableOfContentsProps {
  /** Currently active section ID from scroll-spy */
  activeSectionId: string;
  /** Callback when a nav item is clicked */
  onNavigate: (sectionId: string) => void;
  /** Section change counts for staged package */
  sectionChangeCounts?: SectionChangeCounts | undefined;
  /** Detailed element change counts (by type) */
  detailedElementCounts?: DetailedElementCounts | undefined;
  /** Detailed structure change counts (by act) */
  detailedStructureCounts?: DetailedStructureCounts | undefined;
  /** Whether a package is currently staged */
  hasStagedPackage?: boolean | undefined;
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
  /** Callback to toggle collapse state */
  onToggleCollapse: () => void;
  /** Act data for structure sub-navigation */
  actData?: ActData[] | undefined;
  /** Element counts for elements section */
  elementCounts?: ElementCounts | undefined;
  /** Overall progress */
  progress?: Progress | undefined;
  /** Whether premise section has content */
  hasPremise?: boolean | undefined;
  /** Whether context section has content */
  hasContext?: boolean | undefined;
  /** Ideas count */
  ideasCount?: number | undefined;
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

export function TableOfContents({
  activeSectionId,
  onNavigate,
  sectionChangeCounts,
  detailedElementCounts,
  detailedStructureCounts,
  hasStagedPackage,
  isCollapsed,
  onToggleCollapse,
  actData = [],
  elementCounts,
  progress,
  hasPremise,
  hasContext,
  ideasCount = 0,
}: TableOfContentsProps) {
  const [structureExpanded, setStructureExpanded] = useState(true);
  const [elementsExpanded, setElementsExpanded] = useState(false);

  const handleClick = useCallback(
    (sectionId: string) => {
      onNavigate(sectionId);
    },
    [onNavigate]
  );

  // Calculate total changes for collapsed badge
  const totalChanges = sectionChangeCounts
    ? Object.values(sectionChangeCounts).reduce(
        (sum, section) => sum + section.additions + section.modifications,
        0
      )
    : 0;

  // Check if Structure section is active
  const isStructureActive = activeSectionId === 'structure' || activeSectionId.startsWith('act-');

  // Calculate progress percentage
  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.filled / progress.total) * 100)
    : 0;

  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Expand table of contents"
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
    <nav className={styles.container} aria-label="Story Bible navigation">
      <div className={styles.header}>
        <h3 className={styles.title}>Story Bible</h3>
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Collapse table of contents"
        >
          {'\u25C0'}
        </button>
      </div>

      <ul className={styles.nav}>
        {/* Premise */}
        <li>
          <button
            className={`${styles.navItem} ${activeSectionId === 'premise' ? styles.active : ''}`}
            onClick={() => handleClick('premise')}
            type="button"
          >
            <span className={styles.navIcon}>{'\uD83D\uDCDD'}</span>
            <span className={styles.navLabel}>Premise</span>
            {hasPremise && <span className={styles.checkmark}>{'\u2713'}</span>}
            {hasStagedPackage && sectionChangeCounts?.premise && (
              <ChangeBadge
                additions={sectionChangeCounts.premise.additions}
                modifications={sectionChangeCounts.premise.modifications}
              />
            )}
          </button>
        </li>

        {/* Elements with sub-items */}
        <li>
          <button
            type="button"
            className={`${styles.navItem} ${activeSectionId === 'elements' ? styles.active : ''}`}
            onClick={() => handleClick('elements')}
          >
            <span
              role="button"
              className={styles.expandChevron}
              onClick={(e) => {
                e.stopPropagation();
                setElementsExpanded(!elementsExpanded);
              }}
            >
              {elementsExpanded ? '\u25BC' : '\u25B6'}
            </span>
            <span className={styles.navIcon}>{'\uD83D\uDC65'}</span>
            <span className={styles.navLabel}>Elements</span>
            {hasStagedPackage && sectionChangeCounts?.elements && (
              <ChangeBadge
                additions={sectionChangeCounts.elements.additions}
                modifications={sectionChangeCounts.elements.modifications}
              />
            )}
          </button>

          {elementsExpanded && (elementCounts || detailedElementCounts) && (
            <ul className={styles.subNav}>
              <li className={styles.subNavInfo}>
                <span>Characters</span>
                <span className={styles.countGroup}>
                  <span className={styles.count}>{elementCounts?.characters ?? 0}</span>
                  {hasStagedPackage && detailedElementCounts && detailedElementCounts.characters.additions > 0 && (
                    <span className={styles.proposedCount}>+{detailedElementCounts.characters.additions}</span>
                  )}
                </span>
              </li>
              <li className={styles.subNavInfo}>
                <span>Locations</span>
                <span className={styles.countGroup}>
                  <span className={styles.count}>{elementCounts?.locations ?? 0}</span>
                  {hasStagedPackage && detailedElementCounts && detailedElementCounts.locations.additions > 0 && (
                    <span className={styles.proposedCount}>+{detailedElementCounts.locations.additions}</span>
                  )}
                </span>
              </li>
              <li className={styles.subNavInfo}>
                <span>Objects</span>
                <span className={styles.countGroup}>
                  <span className={styles.count}>{elementCounts?.objects ?? 0}</span>
                  {hasStagedPackage && detailedElementCounts && detailedElementCounts.objects.additions > 0 && (
                    <span className={styles.proposedCount}>+{detailedElementCounts.objects.additions}</span>
                  )}
                </span>
              </li>
            </ul>
          )}
        </li>

        {/* Structure with act sub-navigation */}
        <li>
          <button
            type="button"
            className={`${styles.navItem} ${isStructureActive ? styles.active : ''}`}
            onClick={() => handleClick('structure')}
          >
            <span
              role="button"
              className={styles.expandChevron}
              onClick={(e) => {
                e.stopPropagation();
                setStructureExpanded(!structureExpanded);
              }}
            >
              {structureExpanded ? '\u25BC' : '\u25B6'}
            </span>
            <span className={styles.navIcon}>{'\uD83D\uDCCB'}</span>
            <span className={styles.navLabel}>Structure</span>
            {hasStagedPackage && sectionChangeCounts?.structure && (
              <ChangeBadge
                additions={sectionChangeCounts.structure.additions}
                modifications={sectionChangeCounts.structure.modifications}
              />
            )}
          </button>

          {structureExpanded && actData.length > 0 && (
            <ul className={styles.subNav}>
              {actData.map((act) => {
                const actChanges = detailedStructureCounts?.byAct.get(act.actNumber);
                const hasProposedChanges = hasStagedPackage && actChanges && (actChanges.additions > 0 || actChanges.modifications > 0);
                return (
                  <li key={act.id}>
                    <button
                      className={`${styles.subNavItem} ${activeSectionId === act.id ? styles.active : ''}`}
                      onClick={() => handleClick(act.id)}
                      type="button"
                    >
                      <span>Act {act.actNumber}</span>
                      <span className={styles.countGroup}>
                        <span className={`${styles.progress} ${act.filledBeats === act.totalBeats ? styles.complete : ''}`}>
                          {act.filledBeats}/{act.totalBeats}
                        </span>
                        {hasProposedChanges && actChanges.additions > 0 && (
                          <span className={styles.proposedCount}>+{actChanges.additions}</span>
                        )}
                        {hasProposedChanges && actChanges.modifications > 0 && (
                          <span className={styles.proposedModCount}>~{actChanges.modifications}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </li>

        {/* Context */}
        <li>
          <button
            className={`${styles.navItem} ${activeSectionId === 'context' ? styles.active : ''}`}
            onClick={() => handleClick('context')}
            type="button"
          >
            <span className={styles.navIcon}>{'\uD83D\uDCC4'}</span>
            <span className={styles.navLabel}>Context</span>
            {hasContext && <span className={styles.checkmark}>{'\u2713'}</span>}
            {hasStagedPackage && sectionChangeCounts?.storyContext && (
              <ChangeBadge
                additions={sectionChangeCounts.storyContext.additions}
                modifications={sectionChangeCounts.storyContext.modifications}
              />
            )}
          </button>
        </li>

        {/* Ideas */}
        <li>
          <button
            className={`${styles.navItem} ${activeSectionId === 'ideas' ? styles.active : ''}`}
            onClick={() => handleClick('ideas')}
            type="button"
          >
            <span className={styles.navIcon}>{'\uD83D\uDCA1'}</span>
            <span className={styles.navLabel}>Ideas</span>
            {ideasCount > 0 && (
              <span className={styles.count}>{ideasCount}</span>
            )}
          </button>
        </li>
      </ul>

      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div className={styles.footer}>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {progress.filled}/{progress.total} beats filled ({progressPercent}%)
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
