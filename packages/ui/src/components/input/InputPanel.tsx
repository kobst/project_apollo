import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { ExtractProposalData } from '../../api/types';
import { ProposalCard } from './ProposalCard';
import styles from './InputPanel.module.css';

const TARGET_TYPES = [
  { value: '', label: 'Auto-detect' },
  // Context layer
  { value: 'Logline', label: 'Logline' },
  { value: 'Setting', label: 'Setting' },
  { value: 'GenreTone', label: 'Genre/Tone' },
  // Story content
  { value: 'Character', label: 'Character' },
  { value: 'Location', label: 'Location' },
  { value: 'Scene', label: 'Scene' },
  { value: 'Conflict', label: 'Conflict' },
  { value: 'PlotPoint', label: 'Plot Point' },
  // Abstract/meaning
  { value: 'Theme', label: 'Theme' },
  { value: 'Motif', label: 'Motif' },
  { value: 'Object', label: 'Prop' },
];

export function InputPanel() {
  const { currentStoryId, refreshStatus } = useStory();
  const [input, setInput] = useState('');
  const [targetType, setTargetType] = useState('');
  const [proposals, setProposals] = useState<ExtractProposalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!currentStoryId || !input.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProposals([]);

    try {
      const data = await api.extract(currentStoryId, {
        input: input.trim(),
        targetType: targetType || undefined,
      });
      setProposals(data.proposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, input, targetType]);

  const handleAccept = useCallback(async (proposalId: string) => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.acceptExtract(currentStoryId, proposalId);
      setSuccess(`Accepted: ${result.accepted.title}`);
      // Remove accepted proposal from list
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      // Clear input after successful accept
      if (proposals.length === 1) {
        setInput('');
      }
      // Refresh status to update node counts in tabs
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, proposals.length, refreshStatus]);

  const handleClear = useCallback(() => {
    setInput('');
    setProposals([]);
    setError(null);
    setSuccess(null);
  }, []);

  if (!currentStoryId) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Extract from Input</h3>
        <span className={styles.subtitle}>
          Paste text to extract characters, locations, scenes, etc.
        </span>
      </div>

      <div className={styles.inputSection}>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter character descriptions, scene ideas, backstory, dialogue snippets, or any narrative content..."
          rows={4}
          disabled={loading}
        />

        <div className={styles.controls}>
          <div className={styles.selectors}>
            <select
              className={styles.targetSelect}
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              disabled={loading}
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.buttons}>
            {proposals.length > 0 && (
              <button
                className={styles.clearBtn}
                onClick={handleClear}
                disabled={loading}
                type="button"
              >
                Clear
              </button>
            )}
            <button
              className={styles.extractBtn}
              onClick={handleExtract}
              disabled={loading || input.trim().length < 10}
              type="button"
            >
              {loading ? 'Extracting...' : 'Extract'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {success && (
        <div className={styles.success}>{success}</div>
      )}

      {proposals.length > 0 && (
        <div className={styles.proposals}>
          <h4 className={styles.proposalsTitle}>
            Extraction Proposals ({proposals.length})
          </h4>
          <div className={styles.proposalsList}>
            {proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onAccept={() => handleAccept(proposal.id)}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
