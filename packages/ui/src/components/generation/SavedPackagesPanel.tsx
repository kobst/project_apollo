import { useState } from 'react';
import type { SavedPackageData } from '../../api/types';
import { CompatibilityBadge } from './CompatibilityBadge';
import styles from './SavedPackagesPanel.module.css';

interface SavedPackagesPanelProps {
  packages: SavedPackageData[];
  loading?: boolean;
  onApply: (savedPackageId: string) => void;
  onDelete: (savedPackageId: string) => void;
  onView: (savedPkg: SavedPackageData) => void;
  viewingPackageId?: string | null | undefined;
}

export function SavedPackagesPanel({
  packages,
  loading: _loading = false,
  onApply: _onApply,
  onDelete: _onDelete,
  onView,
  viewingPackageId,
}: SavedPackagesPanelProps) {
  // These props are kept for API compatibility but actions are now in the main view
  void _loading;
  void _onApply;
  void _onDelete;
  const [isOpen, setIsOpen] = useState(false);

  if (packages.length === 0) {
    return null;
  }

  const handleClick = (pkg: SavedPackageData) => {
    onView(pkg);
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={styles.headerTitle}>
          Saved Packages ({packages.length})
        </span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          {'\u25B6'}
        </span>
      </button>

      {isOpen && (
        <div className={styles.list}>
          {packages.map((pkg) => {
            const isViewing = viewingPackageId === pkg.id;
            const confidence = Math.round(pkg.package.confidence * 100);
            const hasIssue = pkg.compatibility.status !== 'compatible';
            return (
              <button
                key={pkg.id}
                className={`${styles.item} ${isViewing ? styles.itemViewing : ''}`}
                onClick={() => handleClick(pkg)}
                type="button"
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemIndicator}>
                    {isViewing ? '●' : '○'}
                  </span>
                  <span className={styles.itemTitle}>
                    {pkg.package.title.length > 18
                      ? `${pkg.package.title.slice(0, 18)}...`
                      : pkg.package.title}
                  </span>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.confidence}>{confidence}%</span>
                  {hasIssue && (
                    <CompatibilityBadge compatibility={pkg.compatibility} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
