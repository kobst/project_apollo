import type { GapData, GapTier, GapType } from '../../api/types';
import { GapItem } from './GapItem';
import styles from './GapList.module.css';

interface GapListProps {
  gaps: GapData[];
  selectedTier: GapTier | null;
  /** Filter by gap type ('structural', 'narrative', or undefined for all) */
  gapType?: GapType | undefined;
}

export function GapList({ gaps, selectedTier, gapType }: GapListProps) {
  // Apply type filter if specified
  let filteredGaps = gaps;
  if (gapType) {
    filteredGaps = gaps.filter((g) => g.type === gapType);
  }

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

  // Group by type (structural vs narrative)
  const structural = filteredGaps.filter((g) => g.type === 'structural');
  const narrative = filteredGaps.filter((g) => g.type === 'narrative');

  return (
    <div className={styles.list}>
      {structural.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Structural ({structural.length})</h4>
          {structural.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
            />
          ))}
        </div>
      )}

      {narrative.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Narrative ({narrative.length})</h4>
          {narrative.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
