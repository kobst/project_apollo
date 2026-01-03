import styles from './EmptyBeatSlot.module.css';

interface EmptyBeatSlotProps {
  beatId: string;
  beatType: string;
}

export function EmptyBeatSlot({ beatId, beatType }: EmptyBeatSlotProps) {
  const handleClick = () => {
    // TODO: Navigate to Explore view to generate scenes for this beat
    console.log('Generate scenes for beat:', beatId, beatType);
  };

  return (
    <div className={styles.container} onClick={handleClick}>
      <div className={styles.icon}>+</div>
      <div className={styles.text}>No scenes</div>
      <div className={styles.hint}>Click to add</div>
    </div>
  );
}
