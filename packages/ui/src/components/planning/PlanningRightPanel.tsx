import { useState, useRef } from 'react';
import { useStashContext, type StashIdeaItem } from '../../context/StashContext';
import { useStory } from '../../context/StoryContext';
import styles from './PlanningRightPanel.module.css';

type PlanningKind = NonNullable<StashIdeaItem['planningKind']>;

interface PlanningRightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function PlanningRightPanel({
  isCollapsed,
  onToggleCollapse,
}: PlanningRightPanelProps) {
  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          type="button"
          className={styles.expandButton}
          onClick={onToggleCollapse}
          aria-label="Expand panel"
        >
          {'\u25C0'}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Tools</span>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          aria-label="Collapse panel"
        >
          {'\u25B6'}
        </button>
      </div>

      <div className={styles.content}>
        <QuickCaptureForm />

        <div className={styles.placeholder}>
          <div className={styles.placeholderTitle}>Idea Generation</div>
          <div className={styles.placeholderContent}>
            AI-assisted idea generation coming soon
          </div>
        </div>

        <div className={styles.placeholder}>
          <div className={styles.placeholderTitle}>Story Bible Reference</div>
          <div className={styles.placeholderContent}>
            Quick story bible lookup coming soon
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCaptureForm() {
  const stash = useStashContext();
  const { currentStoryId } = useStory();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PlanningKind>('note');
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState('');
  const [targetAct, setTargetAct] = useState<number | ''>('');
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Use a ref to always have the latest stash.createIdea without stale closures
  const createIdeaRef = useRef(stash.createIdea);
  createIdeaRef.current = stash.createIdea;

  const doSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (!currentStoryId) {
      setLocalError('No story selected');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const extras: Partial<{
        kind: PlanningKind;
        targetAct: number;
      }> = { kind };
      if (typeof targetAct === 'number') extras.targetAct = targetAct;

      await createIdeaRef.current(
        trimmed,
        description.trim(),
        undefined,
        'user',
        extras
      );
      setTitle('');
      setDescription('');
      setTargetAct('');
      setKind('note');
      setShowMore(false);
      setToast('Idea added');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create idea');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.captureSection}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div className={styles.captureLabel}>Quick Capture</div>
      <div className={styles.captureForm}>
        <input
          type="text"
          className={styles.captureInput}
          placeholder="What's on your mind?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void doSubmit();
            }
          }}
        />

        <div className={styles.captureRow}>
          <select
            className={styles.captureSelect}
            value={kind}
            onChange={(e) => setKind(e.target.value as PlanningKind)}
          >
            <option value="note">Note</option>
            <option value="proposal">Proposal</option>
            <option value="question">Question</option>
            <option value="direction">Direction</option>
            <option value="constraint">Constraint</option>
          </select>
          <button
            type="button"
            className={styles.captureSubmit}
            onClick={() => void doSubmit()}
            disabled={submitting || !title.trim()}
          >
            {submitting ? '...' : 'Add'}
          </button>
        </div>

        {localError && (
          <div className={styles.captureError}>{localError}</div>
        )}

        <button
          type="button"
          className={styles.moreToggle}
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? '- Less fields' : '+ More fields...'}
        </button>

        {showMore && (
          <div className={styles.moreFields}>
            <input
              type="text"
              className={styles.captureInput}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              type="number"
              className={styles.captureInput}
              placeholder="Target Act (optional)"
              value={targetAct}
              onChange={(e) => setTargetAct(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
