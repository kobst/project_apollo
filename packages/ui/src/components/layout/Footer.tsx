import styles from './Footer.module.css';
import { ActionBar } from '../actions/ActionBar';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <ActionBar />
    </footer>
  );
}
