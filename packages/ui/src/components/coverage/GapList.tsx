import type { GapData, GapTier, GapType } from '../../api/types';
import { GapItem } from './GapItem';
import styles from './GapList.module.css';

interface GapListProps {
  gaps: GapData[];
  selectedTier: GapTier | null;
  /** Filter by gap type ('structural', 'narrative', or undefined for all) */
  gapType?: GapType | undefined;
  /** Callback when user clicks "Generate Solutions" on a narrative gap */
  onGenerateCluster?: ((gapId: string) => void) | undefined;
}

export function GapList({ gaps, selectedTier, gapType, onGenerateCluster }: GapListProps) {
  // Apply type filter if specified
  let filteredGaps = gaps;
  if (gapType) {
    filteredGaps = gaps.filter((g) => g.type === gapType);
  }

  // Group gaps by severity
  const blockers = filteredGaps.filter((g) => g.severity === 'blocker');
  const warnings = filteredGaps.filter((g) => g.severity === 'warn');
  const infos = filteredGaps.filter((g) => g.severity === 'info');

  if (filteredGaps.length === 0) {
    return (
      <div className={styles.empty}>
        {selectedTier
          ? `No gaps in ${selectedTier} tier`
          : gapType
            ? `No ${gapType} gaps found`
            : 'No gaps found - great work!'}
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {blockers.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Blockers ({blockers.length})</h4>
          {blockers.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
              onGenerateCluster={onGenerateCluster}
            />
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Warnings ({warnings.length})</h4>
          {warnings.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
              onGenerateCluster={onGenerateCluster}
            />
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Info ({infos.length})</h4>
          {infos.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
              onGenerateCluster={onGenerateCluster}
            />
          ))}
        </div>
      )}
    </div>
  );
}
