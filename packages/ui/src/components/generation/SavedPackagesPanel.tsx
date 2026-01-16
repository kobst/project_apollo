import { useState } from 'react';
import type { SavedPackageData } from '../../api/types';
import { CompatibilityBadge } from './CompatibilityBadge';
import styles from './SavedPackagesPanel.module.css';

interface SavedPackagesPanelProps {
  packages: SavedPackageData[];
  loading?: boolean;
  onApply: (savedPackageId: string) => void;
  onDelete: (savedPackageId: string) => void;
}

export function SavedPackagesPanel({
  packages,
  loading = false,
  onApply,
  onDelete,
}: SavedPackagesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (packages.length === 0) {
    return null;
  }

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`${styles.item} ${expandedId === pkg.id ? styles.itemExpanded : ''}`}
            >
              <button
                className={styles.itemHeader}
                onClick={() => toggleExpanded(pkg.id)}
                type="button"
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>
                    {pkg.package.title.length > 30
                      ? `${pkg.package.title.slice(0, 30)}...`
                      : pkg.package.title}
                  </span>
                  <span className={styles.itemMeta}>
                    v{pkg.sourceVersionLabel}
                  </span>
                </div>
                <CompatibilityBadge
                  compatibility={pkg.compatibility}
                  showDetails={expandedId === pkg.id}
                />
              </button>

              {expandedId === pkg.id && (
                <div className={styles.itemDetails}>
                  <p className={styles.description}>
                    {pkg.package.rationale}
                  </p>
                  {pkg.userNote && (
                    <p className={styles.note}>
                      <strong>Note:</strong> {pkg.userNote}
                    </p>
                  )}
                  <div className={styles.itemMeta}>
                    Saved {new Date(pkg.savedAt).toLocaleDateString()}
                    {pkg.compatibility.status === 'outdated' && (
                      <span> | {pkg.compatibility.versionsBehind} versions behind</span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => onDelete(pkg.id)}
                      disabled={loading}
                      type="button"
                    >
                      Delete
                    </button>
                    <button
                      className={`${styles.applyBtn} ${
                        pkg.compatibility.status === 'conflicting'
                          ? styles.applyBtnWarning
                          : ''
                      }`}
                      onClick={() => onApply(pkg.id)}
                      disabled={loading}
                      type="button"
                    >
                      {pkg.compatibility.status === 'conflicting'
                        ? 'Apply Anyway'
                        : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
