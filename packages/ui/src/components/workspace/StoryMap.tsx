import { useStory } from '../../context/StoryContext';
import styles from './StoryMap.module.css';

export type StoryMapCategory =
  // Premise (umbrella)
  | 'storyContext'
  | 'logline'
  | 'genreTone'
  | 'setting'
  // Story Elements
  | 'characters'
  | 'locations'
  | 'objects'
  // Outline
  | 'board'
  | 'storyBeats'
  | 'scenes'
  | 'unassigned';

interface CategoryConfig {
  id: StoryMapCategory;
  label: string;
  statKey?: string;
  /** If true, this is a singleton category (show ✓/○ instead of count) */
  singleton?: boolean;
  /** For special categories that don't map to nodes */
  special?: boolean;
}

const PREMISE_CATEGORIES: CategoryConfig[] = [
  { id: 'storyContext', label: 'Story Context', special: true },
  { id: 'logline', label: 'Logline', statKey: 'loglines', singleton: true },
  { id: 'genreTone', label: 'Genre/Tone', statKey: 'genreTones', singleton: true },
  { id: 'setting', label: 'Setting', statKey: 'settings', singleton: true },
];

const STORY_ELEMENTS_CATEGORIES: CategoryConfig[] = [
  { id: 'characters', label: 'Characters', statKey: 'characters' },
  { id: 'locations', label: 'Locations', statKey: 'locations' },
  { id: 'objects', label: 'Objects', statKey: 'objects' },
];

const OUTLINE_CATEGORIES: CategoryConfig[] = [
  { id: 'board', label: 'Structure Board', special: true },
  { id: 'storyBeats', label: 'Story Beats', statKey: 'storyBeats' },
  { id: 'scenes', label: 'Scenes', statKey: 'scenes' },
  { id: 'unassigned', label: 'Unassigned', special: true },
];

interface CategoryRowData {
  id: StoryMapCategory;
  label: string;
  count: number;
  /** If true, show ✓/○ instead of count */
  singleton: boolean;
  /** If true, this category has content */
  hasContent: boolean;
}

interface StoryMapProps {
  selectedCategory: StoryMapCategory;
  onSelectCategory: (category: StoryMapCategory) => void;
}

export function StoryMap({ selectedCategory, onSelectCategory }: StoryMapProps) {
  const { currentStoryId, status } = useStory();

  // Build row data from stats
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

    // For board, use beats count
    if (config.id === 'board' && stats) {
      count = stats.beats;
    }

    // For storyContext, check if it has content
    if (config.id === 'storyContext') {
      const hasContext = status?.hasStoryContext ?? false;
      return {
        id: config.id,
        label: config.label,
        count: hasContext ? 1 : 0,
        singleton: true,
        hasContent: hasContext,
      };
    }

    // For unassigned, show staging count (storyBeats + scenes not in structure)
    // For now, just show 0 since we don't track this yet
    if (config.id === 'unassigned') {
      return {
        id: config.id,
        label: config.label,
        count: 0,
        singleton: false,
        hasContent: false,
      };
    }

    return {
      id: config.id,
      label: config.label,
      count,
      singleton: config.singleton ?? false,
      hasContent: count > 0,
    };
  };

  const premiseData = PREMISE_CATEGORIES.map(buildCategoryData);
  const storyElementsData = STORY_ELEMENTS_CATEGORIES.map(buildCategoryData);
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
        <h3 className={styles.sectionTitle}>Premise</h3>
        <div className={styles.categoryList}>
          {premiseData.map(row => (
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
        <h3 className={styles.sectionTitle}>Story Elements</h3>
        <div className={styles.categoryList}>
          {storyElementsData.map(row => (
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
    </div>
  );
}

interface CategoryRowProps {
  data: CategoryRowData;
  isSelected: boolean;
  onClick: () => void;
}

function CategoryRow({ data, isSelected, onClick }: CategoryRowProps) {
  return (
    <div
      className={`${styles.categoryRow} ${isSelected ? styles.selected : ''}`}
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
      <span className={styles.categoryLabel}>{data.label}</span>
      <span className={styles.categoryIndicator}>
        {data.singleton ? (
          // Presence indicator for singletons
          <span className={data.hasContent ? styles.present : styles.absent}>
            {data.hasContent ? '✓' : '○'}
          </span>
        ) : (
          // Count for collections
          <span className={styles.count}>{data.count}</span>
        )}
      </span>
    </div>
  );
}
