/**
 * ProposeTrigger - Unified AI generation trigger component
 *
 * Provides a single interface for all AI-assisted story generation:
 * - Intent selection (Add/Edit/Expand/Link)
 * - Creativity slider (0-1 scale)
 * - Depth options (Focused/Standard/Expansive)
 * - Direction input
 */

import { useState, useCallback } from 'react';
import type {
  ProposeIntent,
  ProposeEntryPointType,
  GenerationDepth,
  ProposeRequest,
} from '../../api/types';
import styles from './ProposeTrigger.module.css';

// Intent options
const INTENT_OPTIONS: {
  value: ProposeIntent;
  label: string;
  description: string;
}[] = [
  { value: 'add', label: 'Add', description: 'Create new elements' },
  { value: 'edit', label: 'Edit', description: 'Modify existing' },
  { value: 'expand', label: 'Expand', description: 'Build out from selection' },
  { value: 'link', label: 'Link', description: 'Connect elements' },
];

// Depth options
const DEPTH_OPTIONS: {
  value: GenerationDepth;
  label: string;
  description: string;
}[] = [
  { value: 'narrow', label: 'Focused', description: '1-2 new nodes' },
  { value: 'medium', label: 'Standard', description: '3-5 new nodes' },
  { value: 'wide', label: 'Expansive', description: '6-10 new nodes' },
];

// Get creativity label based on value
function getCreativityLabel(creativity: number): string {
  if (creativity < 0.33) return 'Conservative';
  if (creativity < 0.67) return 'Balanced';
  return 'Inventive';
}

interface ProposeTriggerProps {
  /** Context for the proposal (selected nodes, beats, gaps) */
  context?: {
    selectedNodeIds?: string[];
    selectedBeatId?: string;
    selectedGapId?: string;
  };
  /** Called when user submits a proposal */
  onPropose: (request: ProposeRequest) => void;
  /** Loading state */
  loading?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
  /** Pre-selected intent */
  defaultIntent?: ProposeIntent;
  /** Pre-selected entry point */
  defaultEntryPoint?: ProposeEntryPointType;
  /** Pre-filled direction text */
  defaultDirection?: string;
}

export function ProposeTrigger({
  context,
  onPropose,
  loading = false,
  compact = false,
  defaultIntent = 'add',
  defaultEntryPoint = 'freeText',
  defaultDirection = '',
}: ProposeTriggerProps) {
  const [intent, setIntent] = useState<ProposeIntent>(defaultIntent);
  const [text, setText] = useState(defaultDirection);
  const [creativity, setCreativity] = useState(0.5);
  const [depth, setDepth] = useState<GenerationDepth>('medium');

  // Determine entry point from context
  const getEntryPoint = useCallback((): ProposeEntryPointType => {
    if (context?.selectedBeatId) return 'beat';
    if (context?.selectedGapId) return 'gap';
    if (context?.selectedNodeIds && context.selectedNodeIds.length > 0) return 'node';
    return defaultEntryPoint;
  }, [context, defaultEntryPoint]);

  const handleSubmit = useCallback(() => {
    const entryPoint = getEntryPoint();
    const targetIds: string[] = [];

    // Collect target IDs from context
    if (context?.selectedNodeIds) {
      targetIds.push(...context.selectedNodeIds);
    }
    if (context?.selectedBeatId) {
      targetIds.push(context.selectedBeatId);
    }
    if (context?.selectedGapId) {
      targetIds.push(context.selectedGapId);
    }

    const scope: ProposeRequest['scope'] = {
      entryPoint,
    };
    if (targetIds.length > 0) {
      scope.targetIds = targetIds;
    }

    // Convert depth to maxNodesPerPackage
    const maxNodesPerPackage = depth === 'narrow' ? 2 : depth === 'medium' ? 5 : 10;

    const request: ProposeRequest = {
      intent,
      scope,
      constraints: {
        creativity,
        inventNewEntities: creativity > 0.5,
        respectStructure: creativity < 0.5 ? 'strict' : 'soft',
      },
      options: {
        packageCount: creativity < 0.33 ? 2 : creativity < 0.67 ? 3 : 5,
        maxNodesPerPackage,
      },
    };

    // Add input text if provided
    if (text.trim()) {
      request.input = { text: text.trim() };
    }

    onPropose(request);
  }, [intent, text, creativity, depth, context, getEntryPoint, onPropose]);

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {/* Intent Selector */}
      <div className={styles.field}>
        <label className={styles.label}>Intent</label>
        <div className={styles.intentGroup}>
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.intentBtn} ${intent === opt.value ? styles.selected : ''}`}
              onClick={() => setIntent(opt.value)}
              disabled={loading}
              type="button"
            >
              <span className={styles.intentLabel}>{opt.label}</span>
              <span className={styles.intentHint}>{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Direction Input */}
      <div className={styles.field}>
        <label className={styles.label}>
          Direction <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what you want to create, modify, or explore..."
          rows={compact ? 2 : 3}
          disabled={loading}
        />
      </div>

      {/* Creativity Slider */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label}>Creativity</label>
          <span className={styles.creativityValue}>
            {getCreativityLabel(creativity)} ({Math.round(creativity * 100)}%)
          </span>
        </div>
        <div className={styles.sliderContainer}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={creativity}
            onChange={(e) => setCreativity(parseFloat(e.target.value))}
            disabled={loading}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Conservative</span>
            <span>Inventive</span>
          </div>
        </div>
        <span className={styles.hint}>
          {creativity < 0.33
            ? 'Stays close to existing structure and entities'
            : creativity < 0.67
            ? 'Balances consistency with new ideas'
            : 'More willing to invent new elements'}
        </span>
      </div>

      {/* Depth Options */}
      {!compact && (
        <div className={styles.field}>
          <label className={styles.label}>Depth</label>
          <div className={styles.radioGroup}>
            {DEPTH_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`${styles.radioOption} ${depth === opt.value ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="depth"
                  value={opt.value}
                  checked={depth === opt.value}
                  onChange={() => setDepth(opt.value)}
                  disabled={loading}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{opt.label}</span>
                <span className={styles.radioHint}>{opt.description}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className={styles.actions}>
        <button
          className={styles.proposeBtn}
          onClick={handleSubmit}
          disabled={loading}
          type="button"
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Generating...
            </>
          ) : (
            'Propose'
          )}
        </button>
      </div>
    </div>
  );
}

export default ProposeTrigger;
