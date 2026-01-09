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

    // Find gaps for this category
    let categoryGaps: GapsData['gaps'] = [];
    if (gapsData) {
      categoryGaps = gapsData.gaps.filter(gap => {
        // Match gaps to categories by checking title content
        const titleLower = gap.title.toLowerCase();
        switch (config.id) {
          case 'premise':
            return gap.tier === 'premise' || titleLower.includes('premise');
          case 'genreTone':
            return titleLower.includes('genretone') || titleLower.includes('genre');
          case 'setting':
            return titleLower.includes('setting');
          case 'characters':
            return titleLower.includes('character') || gap.domain === 'CHARACTER';
          case 'conflicts':
            return titleLower.includes('conflict') || gap.domain === 'CONFLICT';
          case 'themes':
            return titleLower.includes('theme') || titleLower.includes('motif') || gap.domain === 'THEME_MOTIF';
          case 'board':
            return gap.tier === 'structure' || titleLower.includes('beat');
          case 'plotPoints':
            return gap.tier === 'plotPoints' || titleLower.includes('plotpoint') || titleLower.includes('plot point');
          case 'scenes':
            return gap.tier === 'scenes' || titleLower.includes('scene');
          default:
            return false;
        }
      });
    }

    // Calculate total and covered based on category type
    let total: number;
    let covered: number;

    if (config.id === 'board') {
      // Board: use coverage tier data (beats)
      total = 15; // Save the Cat has 15 beats
      covered = stats?.beats ?? 0;
    } else if (config.id === 'plotPoints' || config.id === 'scenes') {
      // Plot Points and Scenes: use coverage tier data
      if (gapsData) {
        const tierData = gapsData.summary.find(t => t.tier === config.tier);
        if (tierData) {
          total = tierData.total;
          covered = tierData.covered;
        } else {
          total = Math.max(1, count);
          covered = count;
        }
      } else {
        total = Math.max(1, count);
        covered = count;
      }
    } else {
      // Foundation categories (premise, genreTone, setting, characters, conflicts, themes):
      // - total = at least 1 expected, or count if more exist
      // - covered = items without gaps
      total = Math.max(1, count);

      // Count unique nodes that have gaps
      const nodesWithGaps = new Set<string>();
      for (const gap of categoryGaps) {
        const nodeIds = gap.scopeRefs?.nodeIds ?? [];
        nodeIds.forEach(id => nodesWithGaps.add(id));
      }

      // Covered = total items minus items with gaps
      // But we need to be careful: if count is 0, covered is 0
      if (count === 0) {
        covered = 0;
      } else {
        // Items without gaps = count - nodes with gaps (but at least 0)
        covered = Math.max(0, count - nodesWithGaps.size);
      }
    }

    // Calculate percent
    const percent = total > 0 ? Math.round((covered / total) * 100) : 0;

    // Determine severity from gaps
    let severity: GapSeverity | null = null;
    const gapCount = categoryGaps.length;

    if (categoryGaps.some(g => g.severity === 'blocker')) {
      severity = 'blocker';
    } else if (categoryGaps.some(g => g.severity === 'warn')) {
      severity = 'warn';
    } else if (categoryGaps.length > 0) {
      severity = 'info';
    }

    return {
      id: config.id,
      label: config.label,
      count: covered,
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
