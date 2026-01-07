import styles from './StoryCard.module.css';

interface StoryCardProps {
  storyId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function StoryCard({ storyId, isSelected, onSelect }: StoryCardProps) {
  const handleClick = () => {
    onSelect(storyId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(storyId);
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.name}>{storyId}</div>
      <div className={styles.meta}>
        <span className={styles.badge}>Click to load</span>
      </div>
    </div>
  );
}
