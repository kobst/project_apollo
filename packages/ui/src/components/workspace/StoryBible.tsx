/**
 * StoryBible - Main scrollable container for the unified workspace.
 * Contains all sections (Premise, Elements, Structure, Context) in a single scroll area.
 * Manages scroll-spy and smooth-scroll navigation.
 */

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { OutlineData } from '../../api/types';
import { computeDetailedStructureCounts } from '../../utils/stagingUtils';
import { ElementsSection } from './ElementsSection';
import { StructureSection } from './StructureSection';
import { ContextSection } from './ContextSection';
import { IdeasSection } from './IdeasSection';
import { TableOfContents } from './TableOfContents';
import type { ElementType } from './types';
import styles from './StoryBible.module.css';

interface StoryBibleProps {
  /** Callback when an element is clicked */
  onElementClick: (elementId: string, elementType: string, elementName?: string) => void;
  /** Callback when add element is requested */
  onAddElement: (type: ElementType) => void;
  /** Whether the TOC sidebar is collapsed */
  isTocCollapsed: boolean;
  /** Callback to toggle TOC collapse state */
  onToggleTocCollapse: () => void;
  /** Whether we're in node selection mode (for Expand) */
  nodeSelectionMode?: boolean;
}

const SECTION_IDS = ['elements', 'structure', 'context', 'ideas'];

export function StoryBible({
  onElementClick,
  onAddElement,
  isTocCollapsed,
  onToggleTocCollapse,
  nodeSelectionMode,
}: StoryBibleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { stagedPackage, sectionChangeCounts, detailedElementCounts } = useGeneration();
  const { currentStoryId, status } = useStory();

  // Fetch outline data for TOC navigation
  const [outline, setOutline] = useState<OutlineData | null>(null);

  useEffect(() => {
    if (!currentStoryId) return;

    const fetchOutline = async () => {
      try {
        const data = await api.getOutline(currentStoryId);
        setOutline(data);
      } catch {
        // Silently fail - outline data is optional for TOC
      }
    };

    void fetchOutline();
  }, [currentStoryId, status]);

  // Track active section via scroll-spy
  const activeSectionId = useScrollSpy(SECTION_IDS, scrollRef);

  // Handle navigation - smooth scroll to section
  const handleNavigate = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Most reliable method: native scrollIntoView on the element itself
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Build beat-to-act map from outline for detailed structure counts
  const beatToActMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!outline) return map;

    for (const act of outline.acts) {
      for (const beat of act.beats) {
        map.set(beat.id, act.act);
      }
    }
    return map;
  }, [outline]);

  // Compute detailed structure counts using the beat-to-act map
  const detailedStructureCounts = useMemo(
    () => computeDetailedStructureCounts(stagedPackage, beatToActMap),
    [stagedPackage, beatToActMap]
  );

  // Generate act data for TOC sub-navigation
  const actData = useMemo(() => {
    if (!outline) return [];

    return outline.acts.map((act) => {
      const filledBeats = act.beats.filter((b) => b.storyBeats.length > 0).length;
      const totalBeats = act.beats.length;
      const sceneCount = act.beats.reduce(
        (sum, b) => sum + b.storyBeats.reduce((s, pp) => s + pp.scenes.length, 0),
        0
      );

      return {
        id: `act-${act.act}`,
        actNumber: act.act,
        filledBeats,
        totalBeats,
        sceneCount,
      };
    });
  }, [outline]);

  // Calculate element counts for TOC
  const elementCounts = useMemo(() => {
    // These are derived from status.stats if available
    return {
      characters: status?.stats?.characters ?? 0,
      locations: status?.stats?.locations ?? 0,
      objects: status?.stats?.objects ?? 0,
    };
  }, [status]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (!outline) return { filled: 0, total: 0 };

    let filled = 0;
    let total = 0;

    for (const act of outline.acts) {
      for (const beat of act.beats) {
        total++;
        if (beat.storyBeats.length > 0) {
          filled++;
        }
      }
    }

    return { filled, total };
  }, [outline]);

  return (
    <div className={styles.container}>
      <TableOfContents
        activeSectionId={activeSectionId}
        onNavigate={handleNavigate}
        sectionChangeCounts={sectionChangeCounts}
        detailedElementCounts={detailedElementCounts}
        detailedStructureCounts={detailedStructureCounts}
        hasStagedPackage={stagedPackage !== null}
        isCollapsed={isTocCollapsed}
        onToggleCollapse={onToggleTocCollapse}
        actData={actData}
        elementCounts={elementCounts}
        progress={progress}
        hasContext={status?.hasStoryContext ?? false}
        ideasCount={status?.stats?.ideas ?? 0}
      />

      <div className={styles.scrollArea} ref={scrollRef} data-scroll-area>
        {nodeSelectionMode && (
          <div className={styles.selectionBanner}>
            <span className={styles.selectionBannerText}>
              <span className={styles.selectionBannerHighlight}>Selection Mode:</span> Click any element to select it for expansion
            </span>
          </div>
        )}
        <ElementsSection
          onElementClick={onElementClick}
          onAddElement={onAddElement}
        />

        <StructureSection
          onElementClick={onElementClick}
          nodeSelectionMode={nodeSelectionMode}
        />

        <ContextSection />

        <IdeasSection />
      </div>
    </div>
  );
}
