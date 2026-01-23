import type { TierSummaryData, GapTier } from '../../api/types';
import styles from './PyramidPanel.module.css';

interface PyramidPanelProps {
  tiers: TierSummaryData[];
  selectedTier: GapTier | null;
  onSelectTier: (tier: GapTier | null) => void;
}

const TIER_ORDER: GapTier[] = [
  'premise',
  'foundations',
  'structure',
  'storyBeats',
  'scenes',
];

function getProgressColor(percent: number): string {
  if (percent >= 80) return '#4caf50'; // green
  if (percent >= 50) return '#ff9800'; // orange
  return '#f44336'; // red
}

export function PyramidPanel({
  tiers,
  selectedTier,
  onSelectTier,
}: PyramidPanelProps) {
  // Sort tiers in pyramid order (top to bottom)
  const orderedTiers = TIER_ORDER.map((tierKey) =>
    tiers.find((t) => t.tier === tierKey)
  ).filter((t): t is TierSummaryData => t !== undefined);

  const handleClick = (tier: GapTier) => {
    onSelectTier(selectedTier === tier ? null : tier);
  };

  const handleKeyDown = (tier: GapTier, event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(tier);
    }
  };

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Story Coverage</h3>
      <div className={styles.pyramid}>
        {orderedTiers.map((tier, index) => (
          <div
            key={tier.tier}
            className={`${styles.tierRow} ${selectedTier === tier.tier ? styles.selected : ''}`}
            style={{ width: `${60 + index * 10}%` }}
            onClick={() => handleClick(tier.tier)}
            onKeyDown={(e) => handleKeyDown(tier.tier, e)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.tierHeader}>
              <span className={styles.tierLabel}>{tier.label}</span>
              <span className={styles.tierStats}>
                {tier.covered}/{tier.total}
              </span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${tier.percent}%`,
                  backgroundColor: getProgressColor(tier.percent),
                }}
              />
            </div>
            <span className={styles.percent}>{tier.percent}%</span>
          </div>
        ))}
      </div>
      {selectedTier && (
        <button
          className={styles.clearFilter}
          onClick={() => onSelectTier(null)}
          type="button"
        >
          Show all gaps
        </button>
      )}
    </div>
  );
}
