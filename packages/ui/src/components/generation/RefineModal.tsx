import { useState, useCallback, useMemo } from 'react';
import type {
  NarrativePackage,
  RefinableElements,
  RefineRequest,
  GenerationDepth,
  GenerationCount,
} from '../../api/types';
import styles from './RefineModal.module.css';

interface RefineModalProps {
  /** The package being refined */
  package: NarrativePackage;
  /** Refinable elements from the session */
  refinableElements: RefinableElements;
  /** Called when user submits refinement */
  onRefine: (request: RefineRequest) => void;
  /** Called when user closes modal */
  onClose: () => void;
  /** Loading state */
  loading?: boolean;
}

const COUNT_OPTIONS: { value: GenerationCount; label: string }[] = [
  { value: 'few', label: '2-3' },
  { value: 'standard', label: '4-6' },
  { value: 'many', label: '8-12' },
];

const DEPTH_OPTIONS: { value: GenerationDepth; label: string }[] = [
  { value: 'narrow', label: 'Focused' },
  { value: 'medium', label: 'Standard' },
  { value: 'wide', label: 'Expansive' },
];

export function RefineModal({
  package: pkg,
  refinableElements,
  onRefine,
  onClose,
  loading = false,
}: RefineModalProps) {
  // State for keep/regenerate selections
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [keepSections, setKeepSections] = useState<Set<string>>(new Set());
  const [guidance, setGuidance] = useState('');
  const [count, setCount] = useState<GenerationCount>('few');
  const [depth, setDepth] = useState<GenerationDepth>('medium');

  // Get all element IDs that aren't kept (will be regenerated)
  const regenerateIds = useMemo(() => {
    const allIds = refinableElements.nodes.map((n) => n.id);
    return allIds.filter((id) => !keepIds.has(id));
  }, [refinableElements.nodes, keepIds]);

  // Toggle element keep state
  const toggleKeep = useCallback((id: string) => {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle section keep state
  const toggleKeepSection = useCallback((section: string) => {
    setKeepSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Keep all
  const keepAll = useCallback(() => {
    setKeepIds(new Set(refinableElements.nodes.map((n) => n.id)));
    setKeepSections(new Set(refinableElements.storyContextChanges.map((s) => s.section)));
  }, [refinableElements]);

  // Keep none
  const keepNone = useCallback(() => {
    setKeepIds(new Set());
    setKeepSections(new Set());
  }, []);

  // Submit
  const handleSubmit = useCallback(() => {
    if (!guidance.trim()) return;

    const request: RefineRequest = {
      basePackageId: pkg.id,
      keepElements: Array.from(keepIds),
      regenerateElements: regenerateIds,
      guidance: guidance.trim(),
      depth,
      count,
    };

    onRefine(request);
  }, [pkg.id, keepIds, regenerateIds, guidance, depth, count, onRefine]);

  // Close on escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="refine-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="refine-title" className={styles.title}>
            Refine: "{pkg.title}"
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Elements list */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Package Elements</span>
              <div className={styles.sectionActions}>
                <button
                  className={styles.linkBtn}
                  onClick={keepAll}
                  type="button"
                >
                  Keep all
                </button>
                <button
                  className={styles.linkBtn}
                  onClick={keepNone}
                  type="button"
                >
                  Regenerate all
                </button>
              </div>
            </div>

            <div className={styles.elementsList}>
              {/* Story Context changes */}
              {refinableElements.storyContextChanges.map((change) => (
                <label
                  key={change.section}
                  className={`${styles.element} ${keepSections.has(change.section) ? styles.kept : styles.regenerate}`}
                >
                  <input
                    type="checkbox"
                    checked={keepSections.has(change.section)}
                    onChange={() => toggleKeepSection(change.section)}
                    className={styles.checkbox}
                  />
                  <span className={styles.elementType}>Story Context:</span>
                  <span className={styles.elementLabel}>{change.section}</span>
                  <span className={styles.elementStatus}>
                    {keepSections.has(change.section) ? 'keep' : 'regenerate'}
                  </span>
                </label>
              ))}

              {/* Nodes */}
              {refinableElements.nodes.map((node) => (
                <label
                  key={node.id}
                  className={`${styles.element} ${keepIds.has(node.id) ? styles.kept : styles.regenerate}`}
                >
                  <input
                    type="checkbox"
                    checked={keepIds.has(node.id)}
                    onChange={() => toggleKeep(node.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.elementType}>{node.type}:</span>
                  <span className={styles.elementLabel}>{node.label}</span>
                  <span className={styles.elementStatus}>
                    {keepIds.has(node.id) ? 'keep' : 'regenerate'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Guidance */}
          <div className={styles.section}>
            <label className={styles.sectionTitle} htmlFor="guidance">
              What would you like to change?
            </label>
            <textarea
              id="guidance"
              className={styles.textarea}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Make Torres more sympathetic - maybe a former friend of Mike's. The location feels too obvious, somewhere more personal?"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Options */}
          <div className={styles.options}>
            <div className={styles.option}>
              <label className={styles.optionLabel}>Variations:</label>
              <select
                className={styles.select}
                value={count}
                onChange={(e) => setCount(e.target.value as GenerationCount)}
                disabled={loading}
              >
                {COUNT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.option}>
              <label className={styles.optionLabel}>Depth:</label>
              <select
                className={styles.select}
                value={depth}
                onChange={(e) => setDepth(e.target.value as GenerationDepth)}
                disabled={loading}
              >
                {DEPTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading || !guidance.trim()}
            type="button"
          >
            {loading ? 'Generating...' : 'Generate Variations'}
          </button>
        </div>
      </div>
    </div>
  );
}
