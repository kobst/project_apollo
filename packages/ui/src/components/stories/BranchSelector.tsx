import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { BranchData } from '../../api/types';
import styles from './BranchSelector.module.css';

interface BranchSelectorProps {
  storyId: string;
  currentBranch: string | null;
  onBranchChange: () => void;
}

export function BranchSelector({
  storyId,
  currentBranch,
  onBranchChange,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const data = await api.listBranches(storyId);
      setBranches(data.branches);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBranches();
  }, [storyId]);

  const handleBranchSelect = async (branchName: string) => {
    if (branchName === currentBranch) return;

    setLoading(true);
    setError(null);
    try {
      await api.checkout(storyId, branchName);
      onBranchChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch branch');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      await api.createBranch(storyId, { name: newBranchName.trim() });
      setNewBranchName('');
      setShowCreate(false);
      await fetchBranches();
      // Switch to the new branch
      await api.checkout(storyId, newBranchName.trim());
      onBranchChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>Branch</label>
        <button
          className={styles.newBtn}
          onClick={() => setShowCreate(!showCreate)}
          type="button"
          disabled={loading}
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {showCreate ? (
        <form className={styles.form} onSubmit={handleCreateBranch}>
          <input
            className={styles.input}
            type="text"
            placeholder="Branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            disabled={creating}
          />
          <button
            className={styles.createBtn}
            type="submit"
            disabled={!newBranchName.trim() || creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      ) : (
        <select
          className={styles.select}
          value={currentBranch ?? ''}
          onChange={(e) => handleBranchSelect(e.target.value)}
          disabled={loading}
        >
          {currentBranch === null && (
            <option value="">Detached HEAD</option>
          )}
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
              {branch.isCurrent ? ' (current)' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
