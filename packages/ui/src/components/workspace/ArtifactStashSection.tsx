/**
 * ArtifactStashSection - Displays unassigned concrete artifacts:
 * PlotPoints, Scenes, and Ideas with a suggestedType (Character, Location, etc.).
 * Abstract planning ideas (no suggestedType) live in the Planning tab instead.
 */

import { useState, useMemo } from 'react';
import type {
  StashItem,
  StashIdeaItem,
  StashPlotPointItem,
  StashSceneItem,
} from '../../context/StashContext';
import styles from './ArtifactStashSection.module.css';

interface ArtifactStashSectionProps {
  items: StashItem[];
}

type ArtifactFilter = 'all' | 'plotpoint' | 'scene' | 'Character' | 'Location' | 'Object';

const FILTER_OPTIONS: { value: ArtifactFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plotpoint', label: 'Story Beats' },
  { value: 'scene', label: 'Scenes' },
  { value: 'Character', label: 'Characters' },
  { value: 'Location', label: 'Locations' },
  { value: 'Object', label: 'Objects' },
];

const TYPE_ICONS: Record<string, string> = {
  plotpoint: '\uD83D\uDCCB',
  scene: '\uD83C\uDFAC',
  Character: '\uD83D\uDC64',
  Location: '\uD83C\uDF0D',
  Object: '\uD83D\uDCE6',
  PlotPoint:'\uD83D\uDCCB',
  Scene: '\uD83C\uDFAC',
};

function matchesFilter(item: StashItem, filter: ArtifactFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'plotpoint' || filter === 'scene') return item.kind === filter;
  // Character, Location, Object — match typed ideas
  return item.kind === 'idea' && item.suggestedType === filter;
}

export function ArtifactStashSection({ items }: ArtifactStashSectionProps) {
  const [filter, setFilter] = useState<ArtifactFilter>('all');

  const filtered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter]
  );

  // Compute counts per filter for badges
  const counts = useMemo(() => {
    const c: Record<ArtifactFilter, number> = {
      all: items.length,
      plotpoint: 0,
      scene: 0,
      Character: 0,
      Location: 0,
      Object: 0,
    };
    for (const item of items) {
      if (item.kind === 'plotpoint') c.plotpoint++;
      else if (item.kind === 'scene') c.scene++;
      else if (item.kind === 'idea' && item.suggestedType) {
        const st = item.suggestedType as ArtifactFilter;
        if (st in c) c[st]++;
      }
    }
    return c;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section id="artifacts" className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.icon}>{'\uD83D\uDCE6'}</span>
          Unassigned
          <span className={styles.count}>({filtered.length})</span>
        </h2>
      </div>

      <div className={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const c = counts[opt.value];
          // Hide filter tabs with 0 items (except "All")
          if (opt.value !== 'all' && c === 0) return null;
          return (
            <button
              key={opt.value}
              type="button"
              className={`${styles.filterTab} ${filter === opt.value ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value !== 'all' && <span className={styles.filterCount}>{c}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>No items match this filter.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => {
            switch (item.kind) {
              case 'plotpoint':
                return <PlotPointCard key={item.id} plotPoint={item} />;
              case 'scene':
                return <SceneCard key={item.id} scene={item} />;
              case 'idea':
                return <TypedIdeaCard key={item.id} idea={item} />;
            }
          })}
        </div>
      )}
    </section>
  );
}

function PlotPointCard({ plotPoint }: { plotPoint: StashPlotPointItem }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{TYPE_ICONS.plotpoint}</span>
        <span className={styles.cardTitle}>{plotPoint.title}</span>
        <span className={styles.typeBadge}>Story Beat</span>
        {plotPoint.priority && (
          <span className={styles.metaBadge}>{plotPoint.priority}</span>
        )}
      </div>
      {plotPoint.summary && (
        <p className={styles.cardDescription}>{plotPoint.summary}</p>
      )}
      {plotPoint.scenes.length > 0 && (
        <p className={styles.cardMeta}>
          {plotPoint.scenes.length} scene{plotPoint.scenes.length !== 1 ? 's' : ''} attached
        </p>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: StashSceneItem }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{TYPE_ICONS.scene}</span>
        <span className={styles.cardTitle}>{scene.heading}</span>
        <span className={styles.typeBadge}>Scene</span>
      </div>
      {scene.overview && <p className={styles.cardDescription}>{scene.overview}</p>}
    </div>
  );
}

function TypedIdeaCard({ idea }: { idea: StashIdeaItem }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          {TYPE_ICONS[idea.suggestedType ?? ''] ?? '\uD83D\uDCA1'}
        </span>
        <span className={styles.cardTitle}>{idea.title}</span>
        <span className={styles.typeBadge}>{idea.suggestedType}</span>
        <span className={styles.metaBadge}>{idea.source}</span>
      </div>
      {idea.description && (
        <p className={styles.cardDescription}>{idea.description}</p>
      )}
    </div>
  );
}
