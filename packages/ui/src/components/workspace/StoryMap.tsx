import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { GapsData, GapTier, GapSeverity } from '../../api/types';
import styles from './StoryMap.module.css';

export type StoryMapCategory =
  // Foundations
  | 'premise'
  | 'genreTone'
  | 'setting'
  | 'characters'
  | 'conflicts'
  | 'themes'
  // Outline
  | 'board'
  | 'plotPoints'
  | 'scenes';

interface CategoryConfig {
  id: StoryMapCategory;
  label: string;
  tier?: GapTier;
  statKey?: string;
  expectedCount?: number;
}

const FOUNDATIONS_CATEGORIES: CategoryConfig[] = [
  { id: 'premise', label: 'Premise', tier: 'premise', statKey: 'premises', expectedCount: 1 },
  { id: 'genreTone', label: 'Genre/Tone', statKey: 'genreTones', expectedCount: 1 },
  { id: 'setting', label: 'Setting', statKey: 'settings', expectedCount: 1 },
  { id: 'characters', label: 'Characters', tier: 'foundations', statKey: 'characters' },
  { id: 'conflicts', label: 'Conflicts', tier: 'foundations', statKey: 'conflicts' },
  { id: 'themes', label: 'Themes/Motifs', statKey: 'themes' },
];

const OUTLINE_CATEGORIES: CategoryConfig[] = [
  { id: 'board', label: 'Structure Board', tier: 'structure' },
  { id: 'plotPoints', label: 'Plot Points', tier: 'plotPoints', statKey: 'plotPoints' },
  { id: 'scenes', label: 'Scenes', tier: 'scenes', statKey: 'scenes' },
];

interface CategoryRowData {
  id: StoryMapCategory;
  label: string;
  count: number;
  total: number;
  percent: number;
  severity: GapSeverity | null;
  gapCount: number;
}

interface StoryMapProps {
  selectedCategory: StoryMapCategory;
  onSelectCategory: (category: StoryMapCategory) => void;
}

export function StoryMap({ selectedCategory, onSelectCategory }: StoryMapProps) {
  const { currentStoryId, status } = useStory();
  const [gapsData, setGapsData] = useState<GapsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch gaps data for status indicators
  const fetchGaps = useCallback(async () => {
    if (!currentStoryId) return;
    setLoading(true);
    try {
      const data = await api.getGaps(currentStoryId);
      setGapsData(data);
    } catch (err) {
      console.error('Failed to fetch gaps:', err);
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchGaps();
  }, [fetchGaps]);

  // Build row data from stats and gaps
  const buildCategoryData = (config: CategoryConfig): CategoryRowData => {
    const stats = status?.stats;

    // Get count from stats
    let count = 0;
    if (config.statKey && stats) {
      const statValue = stats[config.statKey as keyof typeof stats];
      if (typeof statValue === 'number') {
        count = statValue;
      }
    }

    // For themes, combine themes + motifs
    if (config.id === 'themes' && stats) {
      count = stats.themes + stats.motifs;
    }

    // Expected count for progress calculation
    let total = config.expectedCount ?? 0;

    // For categories without fixed expected count, use gaps data or estimate
    if (!config.expectedCount && gapsData) {
      const tierData = gapsData.summary.find(t => t.tier === config.tier);
      if (tierData) {
        total = tierData.total;
      }
    }

    // Special case for board - use beats
    if (config.id === 'board' && stats) {
      count = stats.beats;
      total = 15; // Save the Cat has 15 beats
    }

    // Calculate percent
    const percent = total > 0 ? Math.round((count / total) * 100) : (count > 0 ? 100 : 0);

    // Find gaps for this category to determine severity
    let severity: GapSeverity | null = null;
    let gapCount = 0;

    if (gapsData) {
      const categoryGaps = gapsData.gaps.filter(gap => {
        // Match gaps to categories
        if (config.tier && gap.tier === config.tier) return true;
        // Special matching for non-tier categories
        if (config.id === 'genreTone' && gap.title.toLowerCase().includes('genretone')) return true;
        if (config.id === 'setting' && gap.title.toLowerCase().includes('setting')) return true;
        if (config.id === 'themes' && (gap.title.toLowerCase().includes('theme') || gap.title.toLowerCase().includes('motif'))) return true;
        return false;
      });

      gapCount = categoryGaps.length;

      // Determine highest severity
      if (categoryGaps.some(g => g.severity === 'blocker')) {
        severity = 'blocker';
      } else if (categoryGaps.some(g => g.severity === 'warn')) {
        severity = 'warn';
      } else if (categoryGaps.length > 0) {
        severity = 'info';
      }
    }

    return {
      id: config.id,
      label: config.label,
      count,
      total,
      percent: Math.min(percent, 100),
      severity,
      gapCount,
    };
  };

  const foundationsData = FOUNDATIONS_CATEGORIES.map(buildCategoryData);
  const outlineData = OUTLINE_CATEGORIES.map(buildCategoryData);

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Select a story</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Foundations</h3>
        <div className={styles.categoryList}>
          {foundationsData.map(row => (
            <CategoryRow
              key={row.id}
              data={row}
              isSelected={selectedCategory === row.id}
              onClick={() => onSelectCategory(row.id)}
            />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Outline</h3>
        <div className={styles.categoryList}>
          {outlineData.map(row => (
            <CategoryRow
              key={row.id}
              data={row}
              isSelected={selectedCategory === row.id}
              onClick={() => onSelectCategory(row.id)}
            />
          ))}
        </div>
      </div>

      {loading && <div className={styles.loading}>Updating...</div>}
    </div>
  );
}

interface CategoryRowProps {
  data: CategoryRowData;
  isSelected: boolean;
  onClick: () => void;
}

function CategoryRow({ data, isSelected, onClick }: CategoryRowProps) {
  const progressColor = getProgressColor(data.percent);
  const severityClass = data.severity ? styles[data.severity] : '';

  return (
    <div
      className={`${styles.categoryRow} ${isSelected ? styles.selected : ''} ${severityClass}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.rowHeader}>
        <span className={styles.categoryLabel}>{data.label}</span>
        <span className={styles.categoryStats}>
          {data.total > 0 ? `${data.count}/${data.total}` : data.count > 0 ? data.count.toString() : '-'}
        </span>
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{
            width: `${data.percent}%`,
            backgroundColor: progressColor,
          }}
        />
      </div>
      <div className={styles.rowFooter}>
        <span className={styles.percent}>{data.percent}%</span>
        {data.severity && (
          <span className={`${styles.severityBadge} ${styles[data.severity]}`}>
            {data.severity === 'blocker' ? '!' : data.severity === 'warn' ? '?' : 'i'}
            {data.gapCount > 1 && <span className={styles.gapCount}>{data.gapCount}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return '#4caf50'; // green
  if (percent >= 50) return '#ff9800'; // orange
  if (percent === 0) return '#666'; // gray for empty
  return '#f44336'; // red
}
