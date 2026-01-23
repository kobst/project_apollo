/**
 * useScrollSpy - Custom hook for tracking which section is currently visible.
 * Uses IntersectionObserver for performance-optimized scroll tracking.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

interface UseScrollSpyOptions {
  /** Threshold for considering a section visible (0-1) */
  threshold?: number;
  /** Root margin to offset the detection area */
  rootMargin?: string;
}

/**
 * Hook to track which section is currently visible during scroll.
 *
 * @param sectionIds - Array of section IDs to observe
 * @param scrollRef - Ref to the scrollable container
 * @param options - Configuration options
 * @returns The ID of the currently active section
 */
export function useScrollSpy(
  sectionIds: string[],
  scrollRef: RefObject<HTMLElement | null>,
  options: UseScrollSpyOptions = {}
): string {
  const { threshold = 0.1, rootMargin = '0px 0px -60% 0px' } = options;
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');
  const visibleSectionsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const sectionIdsRef = useRef(sectionIds);

  // Keep sectionIds ref up to date
  sectionIdsRef.current = sectionIds;

  // Determine active section from visible sections
  const updateActiveSection = useCallback(() => {
    const visibleMap = visibleSectionsRef.current;

    // Find the first visible section in document order
    for (const id of sectionIdsRef.current) {
      const entry = visibleMap.get(id);
      if (entry && entry.isIntersecting) {
        setActiveId(id);
        return;
      }
    }

    // If none are intersecting, find the one closest to the top
    let closestId = sectionIdsRef.current[0] ?? '';
    let closestDistance = Infinity;

    for (const id of sectionIdsRef.current) {
      const entry = visibleMap.get(id);
      if (entry) {
        const distance = Math.abs(entry.boundingClientRect.top);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      }
    }

    if (closestId) {
      setActiveId(closestId);
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || sectionIds.length === 0) return;

    // Create new observer
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          visibleSectionsRef.current.set(id, entry);
        }
        updateActiveSection();
      },
      {
        root: scrollContainer,
        rootMargin,
        threshold: [0, threshold, 0.25, 0.5, 0.75, 1],
      }
    );

    // Observe all sections
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
      visibleSectionsRef.current.clear();
    };
  }, [sectionIds, scrollRef, threshold, rootMargin, updateActiveSection]);

  return activeId;
}
