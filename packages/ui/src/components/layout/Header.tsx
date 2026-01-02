import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Apollo Contract UI</h1>
      <span className={styles.subtitle}>Screenplay Knowledge Graph</span>
    </header>
  );
}
