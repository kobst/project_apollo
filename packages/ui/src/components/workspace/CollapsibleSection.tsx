/**
 * CollapsibleSection - Reusable wrapper for Story Bible sections.
 * Features sticky header, collapse/expand animation, and localStorage persistence.
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  /** Unique ID for scroll-spy targeting and localStorage persistence */
  id: string;
  /** Section title */
  title: string;
  /** Optional icon displayed before title */
  icon?: ReactNode | undefined;
  /** Optional right-side actions (Edit All, + Add, etc.) */
  actions?: ReactNode | undefined;
  /** Summary displayed when collapsed */
  collapsedSummary?: ReactNode | undefined;
  /** Badge showing change counts */
  badge?: { additions: number; modifications: number } | undefined;
  /** Whether section is expanded by default */
  defaultExpanded?: boolean | undefined;
  /** Storage key prefix for collapse state persistence */
  storageKeyPrefix?: string | undefined;
  /** Child content */
  children: ReactNode;
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

export function CollapsibleSection({
  id,
  title,
  icon,
  actions,
  collapsedSummary,
  badge,
  defaultExpanded = true,
  storageKeyPrefix = 'apollo-bible-collapse',
  children,
}: CollapsibleSectionProps) {
  const storageKey = `${storageKeyPrefix}-${id}`;

  // Initialize state from localStorage or default
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return defaultExpanded;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
    return defaultExpanded;
  });

  // Persist collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded));
  }, [isExpanded, storageKey]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <section id={id} className={styles.section}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerButton}
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls={`${id}-content`}
        >
          <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
            {'\u25B6'}
          </span>
          {icon && <span className={styles.icon}>{icon}</span>}
          <h2 className={styles.title}>{title}</h2>
          {badge && <ChangeBadge additions={badge.additions} modifications={badge.modifications} />}
        </button>

        {isExpanded && actions && (
          <div className={styles.actions}>{actions}</div>
        )}
      </div>

      {!isExpanded && collapsedSummary && (
        <div className={styles.summary}>{collapsedSummary}</div>
      )}

      <div
        id={`${id}-content`}
        className={`${styles.content} ${isExpanded ? styles.contentExpanded : styles.contentCollapsed}`}
        aria-hidden={!isExpanded}
      >
        {isExpanded && children}
      </div>
    </section>
  );
}
