import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api, ApiError } from '../../api/client';
import type {
  ExtractProposalData,
  InterpretationProposal,
  InterpretResponseData,
} from '../../api/types';
import { ProposalCard } from './ProposalCard';
import styles from './InputPanel.module.css';

// Format edge type for display
function formatEdgeType(edgeType: string, direction: 'from' | 'to'): string {
  const labels: Record<string, { from: string; to: string }> = {
    PRECEDES: { from: 'Could precede', to: 'Could follow' },
    ALIGNS_WITH: { from: 'Could align with', to: 'Could align with' },
    ADVANCES: { from: 'Could advance', to: 'Advanced by' },
    HAS_CHARACTER: { from: 'Could feature', to: 'Featured in' },
    LOCATED_AT: { from: 'Could be at', to: 'Location for' },
    FEATURES_OBJECT: { from: 'Could feature', to: 'Featured in' },
    HAS_ARC: { from: 'Could have arc', to: 'Arc for' },
    SATISFIED_BY: { from: 'Satisfied by', to: 'Could satisfy' },
    PART_OF: { from: 'Part of', to: 'Contains' },
    SET_IN: { from: 'Set in', to: 'Setting for' },
  };
  return labels[edgeType]?.[direction] ?? edgeType.toLowerCase().replace(/_/g, ' ');
}

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
  { value: 'PlotPoint', label: 'Plot Point' },
  { value: 'Object', label: 'Prop' },
];

export function InputPanel() {
  const { currentStoryId, refreshStatus } = useStory();
  const [input, setInput] = useState('');
  const [targetType, setTargetType] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [proposals, setProposals] = useState<ExtractProposalData[]>([]);
  const [aiResult, setAiResult] = useState<InterpretResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!currentStoryId || !input.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProposals([]);
    setAiResult(null);

    try {
      if (useAI) {
        // AI-powered interpretation
        const request: { userInput: string; targetType?: string } = {
          userInput: input.trim(),
        };
        if (targetType) {
          request.targetType = targetType;
        }
        const data = await api.interpret(currentStoryId, request);
        setAiResult(data);
      } else {
        // Pattern-based extraction
        const data = await api.extract(currentStoryId, {
          input: input.trim(),
          targetType: targetType || undefined,
        });
        setProposals(data.proposals);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : useAI ? 'Interpretation failed' : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, input, targetType, useAI]);

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

  const handleAcceptAIProposal = useCallback(async (proposal: InterpretationProposal, index: number) => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);

    try {
      // Convert proposal to package
      const { package: pkg } = await api.convertProposal(currentStoryId, proposal);

      // Apply the package directly (not through a session)
      await api.applyPackage(currentStoryId, pkg);

      const label = proposal.target_type ?? proposal.type;
      setSuccess(`Accepted: ${label}`);

      // Remove accepted proposal from list and re-index validations
      if (aiResult) {
        const newProposals = aiResult.proposals.filter((_, i) => i !== index);
        if (newProposals.length === 0) {
          setAiResult(null);
          setInput('');
        } else {
          // Re-index validations after removing a proposal
          const newValidations: Record<number, typeof aiResult.validations[number]> = {};
          let newIndex = 0;
          for (let i = 0; i < aiResult.proposals.length; i++) {
            if (i !== index) {
              const validation = aiResult.validations[i];
              if (validation) {
                newValidations[newIndex] = validation;
              }
              newIndex++;
            }
          }
          setAiResult({ ...aiResult, proposals: newProposals, validations: newValidations });
        }
      }

      // Refresh status to update node counts
      await refreshStatus();
    } catch (err) {
      if (err instanceof ApiError && err.suggestion) {
        setError(`${err.message}: ${err.suggestion}`);
      } else {
        setError(err instanceof Error ? err.message : 'Accept failed');
      }
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, aiResult, refreshStatus]);

  const handleClear = useCallback(() => {
    setInput('');
    setProposals([]);
    setAiResult(null);
    setError(null);
    setSuccess(null);
  }, []);

  if (!currentStoryId) {
    return null;
  }

  const hasResults = proposals.length > 0 || aiResult !== null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {useAI ? 'AI Interpretation' : 'Extract from Input'}
        </h3>
        <span className={styles.subtitle}>
          {useAI
            ? 'Use AI to understand your input and create story elements'
            : 'Paste text to extract characters, locations, scenes, etc.'}
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

            <label className={styles.aiToggle}>
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                disabled={loading}
              />
              <span className={styles.aiToggleLabel}>AI</span>
            </label>
          </div>

          <div className={styles.buttons}>
            {hasResults && (
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
              {loading
                ? useAI ? 'Interpreting...' : 'Extracting...'
                : useAI ? 'Interpret' : 'Extract'}
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

      {aiResult && (
        <div className={styles.proposals}>
          <div className={styles.aiInterpretation}>
            <div className={styles.interpretationHeader}>
              <span className={styles.interpretationSummary}>
                {aiResult.interpretation.summary}
              </span>
              <span className={styles.interpretationConfidence}>
                {Math.round(aiResult.interpretation.confidence * 100)}% confident
              </span>
            </div>
          </div>

          <h4 className={styles.proposalsTitle}>
            AI Proposals ({aiResult.proposals.length})
          </h4>
          <div className={styles.proposalsList}>
            {aiResult.proposals.map((proposal, index) => (
              <AIProposalCard
                key={index}
                proposal={proposal}
                validation={aiResult.validations[index]}
                onAccept={() => handleAcceptAIProposal(proposal, index)}
                loading={loading}
              />
            ))}
          </div>

          {aiResult.alternatives && aiResult.alternatives.length > 0 && (
            <div className={styles.alternatives}>
              <h5 className={styles.alternativesTitle}>Alternative interpretations:</h5>
              {aiResult.alternatives.map((alt, idx) => (
                <div key={idx} className={styles.alternative}>
                  <span>{alt.summary}</span>
                  <span className={styles.altConfidence}>
                    {Math.round(alt.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// AI Proposal Card Component
function AIProposalCard({
  proposal,
  validation,
  onAccept,
  loading,
}: {
  proposal: InterpretationProposal;
  validation: InterpretResponseData['validations'][number] | undefined;
  onAccept: () => void;
  loading: boolean;
}) {
  const typeLabel = proposal.target_type ?? proposal.type;
  const data = proposal.data;

  // Get display values from data
  const name = String(data.name ?? data.title ?? data.heading ?? '');
  const description = String(data.description ?? data.summary ?? data.content ?? '');

  // Check for severe warnings
  const hasErrors = validation?.warnings.some((w) => w.severity === 'error');

  return (
    <div className={`${styles.proposalCard} ${hasErrors ? styles.hasErrors : ''}`}>
      <div className={styles.proposalHeader}>
        <span className={styles.proposalType}>{typeLabel}</span>
        <span className={styles.proposalOp}>{proposal.operation}</span>
      </div>
      {name && <div className={styles.proposalName}>{name}</div>}
      {description && (
        <div className={styles.proposalDescription}>{description}</div>
      )}
      <div className={styles.proposalRationale}>{proposal.rationale}</div>
      {proposal.relates_to && proposal.relates_to.length > 0 && (
        <div className={styles.proposalRelations}>
          Related to: {proposal.relates_to.join(', ')}
        </div>
      )}

      {/* Validation Results */}
      {validation && (
        <div className={styles.validationResults}>
          {/* Similarity warnings */}
          {validation.similarities.length > 0 && (
            <div className={styles.validationSection}>
              <span className={styles.validationWarning}>
                Similar to: {validation.similarities.map((s) => `${s.existingNodeName} (${Math.round(s.similarity * 100)}%)`).join(', ')}
              </span>
            </div>
          )}

          {/* Gap fulfillment */}
          {validation.fulfillsGaps.length > 0 && (
            <div className={styles.validationSection}>
              <span className={styles.validationSuccess}>
                Fills gaps: {validation.fulfillsGaps.map((g) => g.gapTitle).join(', ')}
              </span>
            </div>
          )}

          {/* Connection suggestions */}
          {validation.suggestedConnections.length > 0 && (
            <div className={styles.validationSection}>
              <span className={styles.validationInfo}>
                Possible connections:
              </span>
              {validation.suggestedConnections.slice(0, 3).map((c, i) => {
                const edgeLabel = formatEdgeType(c.edgeType, c.direction);
                return (
                  <div key={i} className={styles.connectionSuggestion}>
                    {edgeLabel} "{c.nodeName}"
                  </div>
                );
              })}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.filter((w) => w.severity !== 'info').length > 0 && (
            <div className={styles.validationSection}>
              {validation.warnings.filter((w) => w.severity !== 'info').map((w, i) => (
                <div
                  key={i}
                  className={w.severity === 'error' ? styles.validationError : styles.validationWarning}
                >
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {/* Score */}
          <div className={styles.validationScore}>
            Score: {Math.round(validation.score * 100)}%
          </div>
        </div>
      )}

      <div className={styles.proposalActions}>
        <button
          className={`${styles.acceptBtn} ${hasErrors ? styles.acceptBtnWarning : ''}`}
          onClick={onAccept}
          disabled={loading}
          type="button"
          title={hasErrors ? 'This proposal has issues - proceed with caution' : undefined}
        >
          {hasErrors ? 'Accept Anyway' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
