import { useState } from 'react';
import type { GapData } from '../../api/types';
import styles from './GapItem.module.css';

interface GapItemProps {
  gap: GapData;
  onGenerateCluster?: ((gapId: string) => void) | undefined;
}

export function GapItem({ gap, onGenerateCluster }: GapItemProps) {
  const [expanded, setExpanded] = useState(false);

  const severityClass = {
    blocker: styles.blocker,
    warn: styles.warning,
    info: styles.info,
  }[gap.severity];

  // Map type to human-readable label
  const typeLabel = {
    structural: 'Structural',
    narrative: 'Narrative',
  }[gap.type];

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpanded(!expanded);
    }
  };

  const handleGenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenerateCluster?.(gap.id);
  };

  return (
    <div className={`${styles.item} ${severityClass}`}>
      <div
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className={styles.expandIcon}>{expanded ? '-' : '+'}</span>
        <span className={styles.title}>{gap.title}</span>
        <span className={styles.badges}>
          <span className={styles.typeBadge}>{typeLabel}</span>
          <span className={styles.tierBadge}>{gap.tier}</span>
          {gap.domain && <span className={styles.domainBadge}>{gap.domain}</span>}
        </span>
      </div>

      {expanded && (
        <div className={styles.details}>
          <p className={styles.message}>{gap.description}</p>
          {gap.scopeRefs.nodeIds && gap.scopeRefs.nodeIds.length > 0 && (
            <div className={styles.refs}>
              <span className={styles.refsLabel}>Related nodes:</span>
              {gap.scopeRefs.nodeIds.map((id) => (
                <span key={id} className={styles.nodeRef}>
                  {id}
                </span>
              ))}
            </div>
          )}
          <div className={styles.meta}>
            <span className={styles.source}>Source: {gap.source}</span>
            {gap.phase && <span className={styles.phase}>Phase: {gap.phase}</span>}
          </div>
          {/* Only narrative gaps can generate clusters */}
          {gap.type === 'narrative' && onGenerateCluster && (
            <button
              className={styles.generateButton}
              onClick={handleGenerate}
              type="button"
            >
              Generate Solutions
            </button>
          )}
        </div>
      )}
    </div>
  );
}
