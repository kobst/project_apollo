import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { ExtractProposalData } from '../../api/types';
import { ProposalCard } from './ProposalCard';
import styles from './InputPanel.module.css';

const TARGET_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'Character', label: 'Character' },
  { value: 'Location', label: 'Location' },
  { value: 'Scene', label: 'Scene' },
  { value: 'Conflict', label: 'Conflict' },
  { value: 'PlotPoint', label: 'Plot Point' },
  { value: 'Theme', label: 'Theme' },
  { value: 'Motif', label: 'Motif' },
  { value: 'Object', label: 'Prop' },
];

// STC beats in order
const BEAT_OPTIONS = [
  { value: 'beat_OpeningImage', label: 'Opening Image', act: 1 },
  { value: 'beat_ThemeStated', label: 'Theme Stated', act: 1 },
  { value: 'beat_Setup', label: 'Setup', act: 1 },
  { value: 'beat_Catalyst', label: 'Catalyst', act: 1 },
  { value: 'beat_Debate', label: 'Debate', act: 1 },
  { value: 'beat_BreakIntoTwo', label: 'Break Into Two', act: 2 },
  { value: 'beat_BStory', label: 'B Story', act: 2 },
  { value: 'beat_FunAndGames', label: 'Fun & Games', act: 2 },
  { value: 'beat_Midpoint', label: 'Midpoint', act: 3 },
  { value: 'beat_BadGuysCloseIn', label: 'Bad Guys Close In', act: 3 },
  { value: 'beat_AllIsLost', label: 'All Is Lost', act: 4 },
  { value: 'beat_DarkNightOfSoul', label: 'Dark Night of Soul', act: 4 },
  { value: 'beat_BreakIntoThree', label: 'Break Into Three', act: 5 },
  { value: 'beat_Finale', label: 'Finale', act: 5 },
  { value: 'beat_FinalImage', label: 'Final Image', act: 5 },
];

export function InputPanel() {
  const { currentStoryId, refreshStatus } = useStory();
  const [input, setInput] = useState('');
  const [targetType, setTargetType] = useState('');
  const [selectedBeat, setSelectedBeat] = useState('');
  const [proposals, setProposals] = useState<ExtractProposalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset beat selection when target type changes
  const handleTargetTypeChange = useCallback((newType: string) => {
    setTargetType(newType);
    if (newType !== 'Scene') {
      setSelectedBeat('');
    }
  }, []);

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
        // Pass the beat ID so extraction knows which beat to link the scene to
        targetNodeId: targetType === 'Scene' && selectedBeat ? selectedBeat : undefined,
      });
      setProposals(data.proposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, input, targetType, selectedBeat]);

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
    setSelectedBeat('');
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
              onChange={(e) => handleTargetTypeChange(e.target.value)}
              disabled={loading}
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {targetType === 'Scene' && (
              <select
                className={styles.beatSelect}
                value={selectedBeat}
                onChange={(e) => setSelectedBeat(e.target.value)}
                disabled={loading}
              >
                <option value="">Link to beat (optional)</option>
                {BEAT_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    Act {b.act}: {b.label}
                  </option>
                ))}
              </select>
            )}
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
