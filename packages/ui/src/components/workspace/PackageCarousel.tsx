/**
 * PackageCarousel - Horizontal carousel for navigating between packages.
 * Allows selecting a package to stage for review.
 */

import { useRef, useCallback } from 'react';
import type { NarrativePackage } from '../../api/types';
import { PackageMiniCard } from './PackageMiniCard';
import styles from './PackageCarousel.module.css';

interface PackageCarouselProps {
  packages: NarrativePackage[];
  activeIndex: number;
  onSelectPackage: (index: number) => void;
  onAcceptPackage?: () => void;
  onRejectPackage?: () => void;
  onSavePackage?: () => void;
  loading?: boolean;
}

export function PackageCarousel({
  packages,
  activeIndex,
  onSelectPackage,
  onAcceptPackage,
  onRejectPackage,
  onSavePackage,
  loading = false,
}: PackageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  if (packages.length === 0) {
    return null;
  }

  const showNavigation = packages.length > 2;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Proposals ({packages.length})</h4>
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

      <div className={styles.carouselWrapper}>
        <div ref={scrollRef} className={styles.carousel}>
          {packages.map((pkg, index) => (
            <PackageMiniCard
              key={pkg.id}
              package={pkg}
              index={index}
              isActive={index === activeIndex}
              onClick={() => onSelectPackage(index)}
            />
          ))}
        </div>
      </div>

      {activeIndex >= 0 && activeIndex < packages.length && (
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
