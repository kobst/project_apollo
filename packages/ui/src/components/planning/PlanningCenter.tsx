import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  useStashContext,
  type StashIdeaItem,
  type IdeaStatus,
} from '../../context/StashContext';
import { api } from '../../api/client';
import { useStory } from '../../context/StoryContext';
import type { IdeaRefinementVariant } from '../../api/types';
import styles from './PlanningCenter.module.css';

type StatusFilter = 'active' | 'all' | 'promoted' | 'dismissed';

interface PlanningCenterProps {
  ideas: StashIdeaItem[];
  selectedIdea: StashIdeaItem | null;
  statusFilter: StatusFilter;
  onSelectIdea: (idea: StashIdeaItem) => void;
  onDeselectIdea: () => void;
}

export function PlanningCenter({
  ideas,
  selectedIdea,
  statusFilter,
  onSelectIdea,
  onDeselectIdea,
}: PlanningCenterProps) {
  const filteredIdeas = useMemo(() => {
    if (statusFilter === 'all') return ideas;
    return ideas.filter((idea) => idea.status === statusFilter);
  }, [ideas, statusFilter]);

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        {selectedIdea ? (
          <DetailView idea={selectedIdea} onBack={onDeselectIdea} />
        ) : (
          <ListView ideas={filteredIdeas} onSelectIdea={onSelectIdea} />
        )}
      </div>
    </div>
  );
}

function ListView({
  ideas,
  onSelectIdea,
}: {
  ideas: StashIdeaItem[];
  onSelectIdea: (idea: StashIdeaItem) => void;
}) {
  if (ideas.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No ideas yet.</p>
        <p className={styles.emptyHint}>
          Use Quick Capture on the right to add your first planning idea.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>Ideas</span>
        <span className={styles.listCount}>{ideas.length} items</span>
      </div>
      <div className={styles.cardList}>
        {ideas.map((idea) => (
          <IdeaListCard
            key={idea.id}
            idea={idea}
            onClick={() => onSelectIdea(idea)}
          />
        ))}
      </div>
    </>
  );
}

function IdeaListCard({
  idea,
  onClick,
}: {
  idea: StashIdeaItem;
  onClick: () => void;
}) {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{idea.title}</span>
        <span className={`${styles.badge} ${styles.kindBadge}`}>
          {idea.planningKind ?? 'proposal'}
        </span>
        {idea.resolutionStatus && (
          <span className={`${styles.badge} ${styles.resolutionBadge}`}>
            {idea.resolutionStatus}
          </span>
        )}
      </div>
      {idea.description && (
        <p className={styles.cardDescription}>{idea.description}</p>
      )}
      <div className={styles.cardMeta}>
        {idea.source === 'ai' && <span>AI-generated</span>}
        {idea.targetAct != null && <span>Act {idea.targetAct}</span>}
        {typeof idea.usageCount === 'number' && idea.usageCount > 0 && (
          <span>Used {idea.usageCount}x</span>
        )}
      </div>
    </div>
  );
}

type PlanningKind = NonNullable<StashIdeaItem['planningKind']>;
type ResolutionStatus = NonNullable<StashIdeaItem['resolutionStatus']>;

function DetailView({
  idea,
  onBack,
}: {
  idea: StashIdeaItem;
  onBack: () => void;
}) {
  const { updateIdea, deleteIdea, loading } = useStashContext();
  const { currentStoryId } = useStory();

  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);
  const [targetAct, setTargetAct] = useState<number | ''>(idea.targetAct ?? '');
  const [targetBeat, setTargetBeat] = useState(idea.targetBeat ?? '');
  const [themes, setThemes] = useState(idea.themes?.join(', ') ?? '');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refine modal state
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refineGuidance, setRefineGuidance] = useState('');
  const [refineVariants, setRefineVariants] = useState<IdeaRefinementVariant[] | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);

  // Sync local state when selected idea changes
  useEffect(() => {
    setTitle(idea.title);
    setDescription(idea.description);
    setTargetAct(idea.targetAct ?? '');
    setTargetBeat(idea.targetBeat ?? '');
    setThemes(idea.themes?.join(', ') ?? '');
  }, [idea.id, idea.title, idea.description, idea.targetAct, idea.targetBeat, idea.themes]);

  const scheduleAutoSave = useCallback(
    (changes: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateIdea(idea.id, changes as any).catch(() => {});
      }, 800);
    },
    [idea.id, updateIdea]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    scheduleAutoSave({ title: val });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);
    scheduleAutoSave({ description: val });
  };

  // Immediate saves for dropdown changes
  const handleKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void updateIdea(idea.id, { kind: e.target.value as PlanningKind });
  };

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void updateIdea(idea.id, { resolutionStatus: e.target.value as ResolutionStatus });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void updateIdea(idea.id, { status: e.target.value as IdeaStatus });
  };

  const handleTargetActChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? Number(e.target.value) : '';
    setTargetAct(val);
    scheduleAutoSave({ targetAct: typeof val === 'number' ? val : undefined });
  };

  const handleTargetBeatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTargetBeat(val);
    scheduleAutoSave({ targetBeat: val || undefined });
  };

  const handleThemesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setThemes(val);
    const arr = val.split(',').map((s) => s.trim()).filter(Boolean);
    scheduleAutoSave({ themes: arr.length > 0 ? arr : undefined });
  };

  const handleDismiss = () => {
    void updateIdea(idea.id, { status: 'dismissed' });
  };

  const handleDelete = async () => {
    await deleteIdea(idea.id);
    onBack();
  };

  // Refine with AI
  const handleRefine = async () => {
    if (!currentStoryId || !refineGuidance.trim()) return;
    try {
      setRefineLoading(true);
      const { variants } = await api.startIdeaRefineSession(
        currentStoryId,
        idea.id,
        refineGuidance.trim()
      );
      setRefineVariants(variants);
    } finally {
      setRefineLoading(false);
    }
  };

  const handleCommitVariant = async (variantIndex: number, mode: 'update' | 'create') => {
    if (!currentStoryId) return;
    try {
      setRefineLoading(true);
      await api.commitIdeaRefineSession(currentStoryId, idea.id, variantIndex, mode);
      setShowRefineModal(false);
      setRefineVariants(null);
      setRefineGuidance('');
    } finally {
      setRefineLoading(false);
    }
  };

  // Generate StoryBeat from direction
  const handleGenerateStoryBeat = async () => {
    if (!currentStoryId) return;
    try {
      await api.proposeStoryBeats(currentStoryId, {
        focus: 'all',
        direction: `${idea.title}: ${idea.description}`.slice(0, 300),
        packageCount: 3,
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.detailBackButton} onClick={onBack}>
        ← Back to list
      </button>

      <input
        type="text"
        className={styles.detailTitle}
        value={title}
        onChange={handleTitleChange}
      />

      {/* Kind / Resolution / Status dropdowns */}
      <div className={styles.detailRow}>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Kind</span>
          <select
            className={styles.detailSelect}
            value={idea.planningKind ?? 'proposal'}
            onChange={handleKindChange}
          >
            <option value="note">Note</option>
            <option value="proposal">Proposal</option>
            <option value="question">Question</option>
            <option value="direction">Direction</option>
            <option value="constraint">Constraint</option>
          </select>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Resolution</span>
          <select
            className={styles.detailSelect}
            value={idea.resolutionStatus ?? 'open'}
            onChange={handleResolutionChange}
          >
            <option value="open">Open</option>
            <option value="discussed">Discussed</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Status</span>
          <select
            className={styles.detailSelect}
            value={idea.status}
            onChange={handleStatusChange}
          >
            <option value="active">Active</option>
            <option value="promoted">Promoted</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Description</span>
        <textarea
          className={styles.detailTextarea}
          value={description}
          onChange={handleDescriptionChange}
          rows={5}
        />
      </div>

      {/* Targeting section */}
      <div className={styles.detailSectionLabel}>Targeting</div>
      <div className={styles.detailRow}>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Target Act</span>
          <input
            type="number"
            className={styles.detailInput}
            placeholder="e.g. 1"
            value={targetAct}
            onChange={handleTargetActChange}
          />
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Target Beat</span>
          <input
            type="text"
            className={styles.detailInput}
            placeholder="Beat ID"
            value={targetBeat}
            onChange={handleTargetBeatChange}
          />
        </div>
      </div>
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Themes</span>
        <input
          type="text"
          className={styles.detailInput}
          placeholder="Comma-separated themes"
          value={themes}
          onChange={handleThemesChange}
        />
      </div>

      {/* Provenance */}
      <div className={styles.detailProvenance}>
        Source: {idea.source} · Created: {new Date(idea.createdAt).toLocaleDateString()}
        {typeof idea.usageCount === 'number' && ` · Used ${idea.usageCount}x`}
        {typeof idea.informedCount === 'number' && idea.informedCount > 0 &&
          ` · Informed ${idea.informedCount} artifacts`}
      </div>

      {/* Actions */}
      <div className={styles.detailActions}>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.refineButton}`}
          onClick={() => {
            setShowRefineModal(true);
            setRefineVariants(null);
            setRefineGuidance('');
          }}
          disabled={loading}
        >
          Refine with AI
        </button>
        {idea.planningKind === 'direction' && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.generateButton}`}
            onClick={() => void handleGenerateStoryBeat()}
            disabled={loading}
          >
            Generate StoryBeat
          </button>
        )}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.dismissButtonAction}`}
          onClick={handleDismiss}
          disabled={loading || idea.status === 'dismissed'}
        >
          Dismiss
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.deleteButtonAction}`}
          onClick={() => void handleDelete()}
          disabled={loading}
        >
          Delete
        </button>
      </div>

      {/* Refine Modal */}
      {showRefineModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Refine Idea</h3>
            {!refineVariants ? (
              <>
                <textarea
                  className={styles.detailTextarea}
                  placeholder="Add guidance to refine this idea..."
                  rows={4}
                  value={refineGuidance}
                  onChange={(e) => setRefineGuidance(e.target.value)}
                />
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.refineButton}`}
                    onClick={() => void handleRefine()}
                    disabled={refineLoading || !refineGuidance.trim()}
                  >
                    {refineLoading ? 'Refining...' : 'Refine'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.dismissButtonAction}`}
                    onClick={() => setShowRefineModal(false)}
                    disabled={refineLoading}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.variantCount}>{refineVariants.length} variants generated:</p>
                {refineVariants.map((v, idx) => (
                  <div key={v.id || idx} className={styles.variantCard}>
                    <div className={styles.variantHeader}>
                      <span className={`${styles.badge} ${styles.kindBadge}`}>{v.kind ?? 'proposal'}</span>
                      <span className={styles.cardTitle}>{v.title}</span>
                    </div>
                    <p className={styles.cardDescription}>{v.description}</p>
                    {v.resolution && (
                      <p className={styles.variantResolution}>Resolution: {v.resolution}</p>
                    )}
                    <div className={styles.variantActions}>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.refineButton}`}
                        onClick={() => void handleCommitVariant(idx, 'update')}
                        disabled={refineLoading}
                      >
                        Accept & Update
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.generateButton}`}
                        onClick={() => void handleCommitVariant(idx, 'create')}
                        disabled={refineLoading}
                      >
                        Create as New
                      </button>
                    </div>
                  </div>
                ))}
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.dismissButtonAction}`}
                    onClick={() => setShowRefineModal(false)}
                    disabled={refineLoading}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
