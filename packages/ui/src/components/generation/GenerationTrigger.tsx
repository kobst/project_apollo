import { useState, useCallback } from 'react';
import type {
  GenerationEntryPoint,
  GenerationEntryPointType,
  GenerationDepth,
  GenerationCount,
  GenerateRequest,
} from '../../api/types';
import styles from './GenerationTrigger.module.css';

export interface EntryPointOption {
  type: GenerationEntryPointType;
  targetId?: string;
  label: string;
  description?: string;
}

interface GenerationTriggerProps {
  /** Available entry points to choose from */
  entryPoints: EntryPointOption[];
  /** Pre-selected entry point */
  defaultEntryPoint?: GenerationEntryPoint;
  /** Called when user clicks Generate */
  onGenerate: (request: GenerateRequest) => void;
  /** Loading state */
  loading?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
}

const DEPTH_OPTIONS: { value: GenerationDepth; label: string; description: string }[] = [
  { value: 'narrow', label: 'Focused', description: '1-2 new nodes' },
  { value: 'medium', label: 'Standard', description: '3-5 new nodes' },
  { value: 'wide', label: 'Expansive', description: '6-10 new nodes' },
];

const COUNT_OPTIONS: { value: GenerationCount; label: string; description: string }[] = [
  { value: 'few', label: 'Quick', description: '2-3 packages' },
  { value: 'standard', label: 'Explore', description: '4-6 packages' },
  { value: 'many', label: 'Deep dive', description: '8-12 packages' },
];

export function GenerationTrigger({
  entryPoints,
  defaultEntryPoint,
  onGenerate,
  loading = false,
  compact = false,
}: GenerationTriggerProps) {
  // Find default index based on defaultEntryPoint
  const defaultIndex = defaultEntryPoint
    ? entryPoints.findIndex(
        (ep) =>
          ep.type === defaultEntryPoint.type &&
          ep.targetId === defaultEntryPoint.targetId
      )
    : 0;

  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, defaultIndex));
  const [depth, setDepth] = useState<GenerationDepth>('medium');
  const [count, setCount] = useState<GenerationCount>('few');
  const [direction, setDirection] = useState('');

  const selectedEntry = entryPoints[selectedIndex];

  const handleGenerate = useCallback(() => {
    if (!selectedEntry) return;

    const entryPoint: GenerationEntryPoint = { type: selectedEntry.type };
    if (selectedEntry.targetId !== undefined) {
      entryPoint.targetId = selectedEntry.targetId;
    }

    const request: GenerateRequest = {
      entryPoint,
      depth,
      count,
    };

    if (direction.trim()) {
      request.direction = direction.trim();
    }

    onGenerate(request);
  }, [selectedEntry, depth, count, direction, onGenerate]);

  if (entryPoints.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No entry points available</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {/* Entry Point Selector */}
      <div className={styles.field}>
        <label className={styles.label}>Generate for</label>
        <select
          className={styles.select}
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          disabled={loading}
        >
          {entryPoints.map((ep, idx) => (
            <option key={`${ep.type}-${ep.targetId ?? 'none'}`} value={idx}>
              {ep.label}
            </option>
          ))}
        </select>
        {selectedEntry?.description && (
          <span className={styles.hint}>{selectedEntry.description}</span>
        )}
      </div>

      {/* Depth Options */}
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

      {/* Count Options */}
      <div className={styles.field}>
        <label className={styles.label}>Options</label>
        <div className={styles.radioGroup}>
          {COUNT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`${styles.radioOption} ${count === opt.value ? styles.selected : ''}`}
            >
              <input
                type="radio"
                name="count"
                value={opt.value}
                checked={count === opt.value}
                onChange={() => setCount(opt.value)}
                disabled={loading}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>{opt.label}</span>
              <span className={styles.radioHint}>{opt.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Direction (optional) */}
      {!compact && (
        <div className={styles.field}>
          <label className={styles.label}>
            Direction <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            className={styles.textarea}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="Focus on betrayal themes, make it more action-oriented..."
            rows={2}
            disabled={loading}
          />
        </div>
      )}

      {/* Generate Button */}
      <div className={styles.actions}>
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={loading || !selectedEntry}
          type="button"
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </div>
  );
}
