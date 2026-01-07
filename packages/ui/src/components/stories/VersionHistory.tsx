import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { VersionData } from '../../api/types';
import styles from './VersionHistory.module.css';

interface VersionHistoryProps {
  storyId: string;
  currentVersionId: string;
  onVersionChange: () => void;
}

export function VersionHistory({
  storyId,
  currentVersionId,
  onVersionChange,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const data = await api.getLog(storyId, 20);
      setVersions(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVersions();
  }, [storyId, currentVersionId]);

  const handleCheckout = async (versionId: string) => {
    if (versionId === currentVersionId) return;

    setSwitching(versionId);
    setError(null);
    try {
      await api.checkout(storyId, versionId);
      onVersionChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkout version');
    } finally {
      setSwitching(null);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading && versions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading versions...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Version History</span>
        <button
          className={styles.refreshBtn}
          onClick={fetchVersions}
          disabled={loading}
          type="button"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {versions.map((version, index) => (
          <div
            key={version.id}
            className={`${styles.item} ${version.isCurrent ? styles.current : ''}`}
          >
            <div className={styles.timeline}>
              <div className={`${styles.dot} ${version.isCurrent ? styles.currentDot : ''}`} />
              {index < versions.length - 1 && <div className={styles.line} />}
            </div>
            <div className={styles.content}>
              <div className={styles.versionHeader}>
                <span className={styles.label}>
                  {version.label || 'Commit'}
                </span>
                <span className={styles.time}>{formatDate(version.createdAt)}</span>
              </div>
              <div className={styles.versionId} title={version.id}>
                {version.id.slice(0, 12)}...
              </div>
              {!version.isCurrent && (
                <button
                  className={styles.restoreBtn}
                  onClick={() => handleCheckout(version.id)}
                  disabled={switching === version.id}
                  type="button"
                >
                  {switching === version.id ? 'Switching...' : 'Restore'}
                </button>
              )}
              {version.isCurrent && (
                <span className={styles.currentBadge}>Current</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {versions.length === 0 && !loading && (
        <div className={styles.empty}>No versions yet</div>
      )}
    </div>
  );
}
