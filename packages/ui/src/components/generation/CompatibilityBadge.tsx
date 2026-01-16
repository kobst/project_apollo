import type { PackageCompatibility } from '../../api/types';
import styles from './CompatibilityBadge.module.css';

interface CompatibilityBadgeProps {
  compatibility: PackageCompatibility;
  showDetails?: boolean;
}

export function CompatibilityBadge({
  compatibility,
  showDetails = false,
}: CompatibilityBadgeProps) {
  const { status, versionsBehind, conflicts } = compatibility;

  const statusConfig = {
    compatible: {
      label: 'Compatible',
      className: styles.compatible,
      icon: '\u2713',
    },
    outdated: {
      label: `${versionsBehind} version${versionsBehind === 1 ? '' : 's'} behind`,
      className: styles.outdated,
      icon: '\u26A0',
    },
    conflicting: {
      label: 'Conflicts',
      className: styles.conflicting,
      icon: '\u2717',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${styles.badge} ${config.className}`}>
      <span className={styles.icon}>{config.icon}</span>
      <span className={styles.label}>{config.label}</span>
      {showDetails && status === 'conflicting' && conflicts.length > 0 && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTitle}>Conflicts:</div>
          {conflicts.map((conflict, i) => (
            <div key={i} className={styles.tooltipItem}>
              {conflict.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
