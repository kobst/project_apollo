/**
 * PackageCarousel - Two-tier horizontal carousel for navigating packages.
 * Root packages (no parent) show in the main row.
 * When a root package with children is active, a variations sub-row appears.
 */

import { useRef, useCallback, useMemo } from 'react';
import type { NarrativePackage } from '../../api/types';
import { PackageMiniCard } from './PackageMiniCard';
import styles from './PackageCarousel.module.css';

interface PackageCarouselProps {
  packages: NarrativePackage[];
  activePackageId: string | null;
  onSelectPackage: (packageId: string) => void;
  onAcceptPackage?: () => void;
  onRejectPackage?: () => void;
  onSavePackage?: () => void;
  loading?: boolean;
}

export function PackageCarousel({
  packages,
  activePackageId,
  onSelectPackage,
  onAcceptPackage,
  onRejectPackage,
  onSavePackage,
  loading = false,
}: PackageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const variationsScrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -160, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 160, behavior: 'smooth' });
    }
  }, []);

  // Separate root packages from children
  const rootPackages = useMemo(
    () => packages.filter(p => !p.parent_package_id),
    [packages]
  );

  // Count children per root package
  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const pkg of packages) {
      if (pkg.parent_package_id) {
        map.set(pkg.parent_package_id, (map.get(pkg.parent_package_id) || 0) + 1);
      }
    }
    return map;
  }, [packages]);

  // Determine active root: if activePackageId is a child, resolve to its parent
  const activePackage = packages.find(p => p.id === activePackageId);
  const activeRootId = activePackage?.parent_package_id ?? activePackageId;

  // Get variations for the active root
  const variations = useMemo(
    () => activeRootId ? packages.filter(p => p.parent_package_id === activeRootId) : [],
    [packages, activeRootId]
  );

  if (packages.length === 0) {
    return null;
  }

  const showNavigation = rootPackages.length > 2;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Proposals ({rootPackages.length})</h4>
        {showNavigation && (
          <div className={styles.navigation}>
            <button
              className={styles.navButton}
              onClick={scrollLeft}
              type="button"
              aria-label="Scroll left"
            >
              {'\u25C0'}
            </button>
            <button
              className={styles.navButton}
              onClick={scrollRight}
              type="button"
              aria-label="Scroll right"
            >
              {'\u25B6'}
            </button>
          </div>
        )}
      </div>

      {/* Main row: root packages only */}
      <div className={styles.carouselWrapper}>
        <div ref={scrollRef} className={styles.carousel}>
          {rootPackages.map((pkg, index) => (
            <PackageMiniCard
              key={pkg.id}
              package={pkg}
              index={index}
              isActive={pkg.id === activeRootId}
              onClick={() => onSelectPackage(pkg.id)}
              childCount={childCountMap.get(pkg.id) ?? 0}
            />
          ))}
        </div>
      </div>

      {/* Variations sub-row (only when active root has children) */}
      {variations.length > 0 && (
        <div className={styles.variationsRow}>
          <span className={styles.variationsLabel}>Variations ({variations.length})</span>
          <div ref={variationsScrollRef} className={styles.carousel}>
            {variations.map((pkg, index) => (
              <PackageMiniCard
                key={pkg.id}
                package={pkg}
                index={index}
                isActive={pkg.id === activePackageId}
                onClick={() => onSelectPackage(pkg.id)}
                isRefinement
              />
            ))}
          </div>
        </div>
      )}

      {activePackageId && (
        <div className={styles.actions}>
          {onAcceptPackage && (
            <button
              className={styles.acceptButton}
              onClick={onAcceptPackage}
              disabled={loading}
              type="button"
            >
              {loading ? 'Accepting...' : 'Accept'}
            </button>
          )}
          {onRejectPackage && (
            <button
              className={styles.rejectButton}
              onClick={onRejectPackage}
              disabled={loading}
              type="button"
            >
              Reject
            </button>
          )}
          {onSavePackage && (
            <button
              className={styles.saveButton}
              onClick={onSavePackage}
              disabled={loading}
              type="button"
            >
              Save for Later
            </button>
          )}
        </div>
      )}
    </div>
  );
}
