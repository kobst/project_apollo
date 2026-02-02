/**
 * StashSection - Unified display for unassigned StoryBeats, Scenes, and Ideas.
 * Replaces the old IdeasSection with type filter tabs and kind-specific cards.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  useStashContext,
  type IdeaStatus,
  type StashIdeaItem,
  type StashStoryBeatItem,
  type StashSceneItem,
  type StashItemKind,
} from '../../context/StashContext';
import type { IdeaSuggestedType, IdeaRefinementVariant } from '../../api/types';
import { api } from '../../api/client';
import { useStory } from '../../context/StoryContext';
import styles from './IdeasSection.module.css';

const TYPE_FILTER_OPTIONS: { value: StashItemKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'storybeat', label: 'Story Beats' },
  { value: 'scene', label: 'Scenes' },
  { value: 'idea', label: 'Ideas' },
];

const STATUS_OPTIONS: { value: IdeaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'dismissed', label: 'Dismissed' },
];

const KIND_OPTIONS: { value: StashIdeaItem['planningKind'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'question', label: 'Questions' },
  { value: 'direction', label: 'Directions' },
  { value: 'constraint', label: 'Constraints' },
  { value: 'note', label: 'Notes' },
];

const RESOLUTION_OPTIONS: { value: StashIdeaItem['resolutionStatus'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'discussed', label: 'Discussed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

const CATEGORY_ICONS: Record<string, string> = {
  character: '\uD83D\uDC64',
  plot: '\uD83D\uDCCB',
  scene: '\uD83C\uDFAC',
  worldbuilding: '\uD83C\uDF0D',
  general: '\uD83D\uDCA1',
};

const TYPE_OPTIONS: { value: IdeaSuggestedType | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'Character', label: 'Character' },
  { value: 'StoryBeat', label: 'Story Beat' },
  { value: 'Scene', label: 'Scene' },
  { value: 'Location', label: 'Location' },
  { value: 'Object', label: 'Object' },
];

interface StashSectionProps {
  /** Callback when Develop is clicked on an idea */
  onDevelop?: (ideaId: string) => void;
}

export function StashSection({ onDevelop }: StashSectionProps) {
  const { items, loading, error, createIdea, updateIdea, deleteIdea } = useStashContext();
  const { currentStoryId } = useStory();

  // Filters
  const [typeFilter, setTypeFilter] = useState<StashItemKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('active');
  const [kindFilter, setKindFilter] = useState<StashIdeaItem['planningKind'] | 'all'>('all');
  const [resolutionFilter, setResolutionFilter] = useState<StashIdeaItem['resolutionStatus'] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterTargetAct, setFilterTargetAct] = useState<number | ''>('');
  const [filterTargetBeat, setFilterTargetBeat] = useState('');
  const [filterThemes, setFilterThemes] = useState('');

  // Add idea form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSuggestedType, setNewSuggestedType] = useState<IdeaSuggestedType | ''>('');
  const [newKind, setNewKind] = useState<StashIdeaItem['planningKind']>('proposal');
  const [newTargetBeat, setNewTargetBeat] = useState('');
  const [newTargetAct, setNewTargetAct] = useState<number | ''>('');
  const [newThemes, setNewThemes] = useState('');

  // Toasts
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Refine modal
  const [refineIdeaId, setRefineIdeaId] = useState<string | null>(null);
  const [refineGuidance, setRefineGuidance] = useState('');
  const [refineVariants, setRefineVariants] = useState<IdeaRefinementVariant[] | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      // Status/planning filters apply only to ideas
      if (item.kind === 'idea') {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (kindFilter !== 'all' && item.planningKind !== kindFilter) return false;
        if (resolutionFilter !== 'all' && item.resolutionStatus !== resolutionFilter) return false;
        if (filterTargetAct !== '' && item.targetAct !== filterTargetAct) return false;
        if (filterTargetBeat && (!item.targetBeat || item.targetBeat !== filterTargetBeat)) return false;
        if (filterThemes) {
          const required = filterThemes.split(',').map(s => s.trim()).filter(Boolean);
          const has = item.themes ?? [];
          if (required.length > 0 && !required.some(t => has.includes(t))) return false;
        }
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, kindFilter, resolutionFilter, filterTargetAct, filterTargetBeat, filterThemes]);

  const handleAddIdea = async () => {
    if (!newTitle.trim()) return;

    try {
      const extras: any = { kind: newKind };
      if (newTargetBeat) extras.targetBeat = newTargetBeat;
      if (typeof newTargetAct === 'number') extras.targetAct = newTargetAct;
      const themesArr = newThemes.split(',').map((s) => s.trim()).filter(Boolean);
      if (themesArr.length > 0) extras.themes = themesArr;

      await createIdea(
        newTitle.trim(),
        newDescription.trim(),
        newSuggestedType || undefined,
        'user',
        extras
      );
      setNewTitle('');
      setNewDescription('');
      setNewSuggestedType('');
      setNewKind('proposal');
      setNewTargetBeat('');
      setNewTargetAct('');
      setNewThemes('');
      setShowAddForm(false);
      showToast('Idea added');
    } catch {
      // Error handled by context
    }
  };

  const handleDevelop = (ideaId: string) => {
    if (onDevelop) {
      onDevelop(ideaId);
    }
  };

  const handleDismiss = async (ideaId: string) => {
    try {
      await updateIdea(ideaId, { status: 'dismissed' });
    } catch {
      // Error handled by context
    }
  };

  const handleRestore = async (ideaId: string) => {
    try {
      await updateIdea(ideaId, { status: 'active' });
    } catch {
      // Error handled by context
    }
  };

  const handleDelete = async (ideaId: string) => {
    try {
      await deleteIdea(ideaId);
    } catch {
      // Error handled by context
    }
  };

  const openRefineModal = (ideaId: string) => {
    setRefineIdeaId(ideaId);
    setRefineGuidance('');
    setRefineVariants(null);
  };

  const runRefine = async () => {
    if (!refineIdeaId || !refineGuidance.trim() || !currentStoryId) return;
    try {
      setRefineLoading(true);
      const { variants } = await api.startIdeaRefineSession(currentStoryId, refineIdeaId, refineGuidance.trim());
      setRefineVariants(variants);
      showToast(`Idea refined — ${variants.length} variants generated`);
    } finally {
      setRefineLoading(false);
    }
  };

  const commitVariant = async (variantIndex: number, mode: 'update' | 'create') => {
    if (!refineIdeaId || !currentStoryId) return;
    try {
      setRefineLoading(true);
      await api.commitIdeaRefineSession(currentStoryId, refineIdeaId, variantIndex, mode);
      setRefineIdeaId(null);
      setRefineVariants(null);
      showToast(mode === 'update' ? 'Resolution saved' : 'Variant created as new idea');
    } finally {
      setRefineLoading(false);
    }
  };

  const generateFromDirection = async (title: string, description: string) => {
    if (!currentStoryId) return;
    try {
      await api.proposeStoryBeats(currentStoryId, {
        focus: 'all',
        direction: `${title}: ${description}`.slice(0, 300),
        packageCount: 3,
      });
      showToast('Generation started for StoryBeats');
    } catch {
      // ignore
    }
  };

  // Show status filter only when viewing ideas (or all)
  const showStatusFilter = typeFilter === 'all' || typeFilter === 'idea';

  return (
    <section id="stash" className={styles.section}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.icon}>{'\uD83D\uDCE5'}</span>
          Planning
          <span className={styles.count}>({items.length})</span>
        </h2>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Idea'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className={styles.addForm}>
          <input
            type="text"
            className={styles.input}
            placeholder="Idea title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className={styles.textarea}
            placeholder="Describe your idea..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
          />
          <div className={styles.formRow}>
            <select
              className={styles.select}
              value={newSuggestedType}
              onChange={(e) => setNewSuggestedType(e.target.value as IdeaSuggestedType | '')}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={newKind} onChange={(e) => setNewKind(e.target.value as any)}>
              {KIND_OPTIONS.filter(k => k.value !== 'all').map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              className={styles.input}
              placeholder="targetBeat (optional)"
              value={newTargetBeat}
              onChange={(e) => setNewTargetBeat(e.target.value)}
            />
            <input
              type="number"
              className={styles.input}
              placeholder="targetAct"
              value={newTargetAct}
              onChange={(e) => setNewTargetAct(e.target.value ? Number(e.target.value) : '')}
            />
            <input
              type="text"
              className={styles.input}
              placeholder="themes (comma-separated)"
              value={newThemes}
              onChange={(e) => setNewThemes(e.target.value)}
            />
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleAddIdea}
              disabled={loading || !newTitle.trim()}
            >
              Add Idea
            </button>
          </div>
        </div>
      )}

      {/* Type Filter Tabs */}
      <div className={styles.filters}>
        <div className={styles.statusTabs}>
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.statusTab} ${typeFilter === opt.value ? styles.active : ''}`}
              onClick={() => setTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {(typeFilter === 'idea' || typeFilter === 'all') && (
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          {typeFilter === 'idea' && (
            <>
              <select className={styles.select} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select className={styles.select} value={resolutionFilter} onChange={(e) => setResolutionFilter(e.target.value as any)}>
                {RESOLUTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {/* Quick presets */}
              <button type="button" className={styles.statusTab} onClick={() => { setKindFilter('question'); setResolutionFilter('open'); }}>Open Questions</button>
              <button type="button" className={styles.statusTab} onClick={() => { setKindFilter('constraint'); setResolutionFilter('all'); }}>Constraints</button>
              <button type="button" className={styles.statusTab} onClick={() => { setKindFilter('direction'); setResolutionFilter('all'); }}>Directions</button>
              <button type="button" className={styles.statusTab} onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? 'Hide Filters' : 'Filters'}
              </button>
            </>
          )}
        </div>
        {typeFilter === 'idea' && showFilters && (
          <div className={styles.formRow}>
            <input
              type="number"
              className={styles.input}
              placeholder="filter targetAct"
              value={filterTargetAct}
              onChange={(e) => setFilterTargetAct(e.target.value ? Number(e.target.value) : '')}
            />
            <input
              type="text"
              className={styles.input}
              placeholder="filter targetBeat"
              value={filterTargetBeat}
              onChange={(e) => setFilterTargetBeat(e.target.value)}
            />
            <input
              type="text"
              className={styles.input}
              placeholder="filter themes (comma-separated)"
              value={filterThemes}
              onChange={(e) => setFilterThemes(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Items List */}
      {loading && items.length === 0 ? (
        <div className={styles.loading}>Loading stash...</div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.empty}>
          <p>No items found.</p>
          <p className={styles.emptyHint}>
            {typeFilter !== 'all'
              ? `No ${typeFilter === 'storybeat' ? 'story beats' : typeFilter === 'scene' ? 'scenes' : 'ideas'} in stash. Try changing the filter.`
              : 'Unassigned story beats, scenes, and ideas will appear here.'}
          </p>
        </div>
      ) : (
        <div className={styles.ideaList}>
          {/* Bulk actions for filtered view: minimal implementation */}
          {typeFilter !== 'scene' && typeFilter !== 'storybeat' && (
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.dismissButton}
                onClick={async () => {
                  // Archive all resolved questions
                  const toArchive = filteredItems.filter(i => i.kind === 'idea' && i.planningKind === 'question' && i.resolutionStatus === 'resolved') as StashIdeaItem[];
                  if (!currentStoryId) return;
                  await Promise.all(toArchive.map(i => updateIdea(i.id, { status: 'active' }).then(() => api.updateIdea(currentStoryId, i.id, { resolutionStatus: 'archived' }))));
                  showToast('Archived resolved questions');
                }}
                disabled={loading}
              >
                Archive resolved questions
              </button>
              <button
                type="button"
                className={styles.developButton}
                onClick={async () => {
                  const toMark = filteredItems.filter(i => i.kind === 'idea') as StashIdeaItem[];
                  if (!currentStoryId) return;
                  await Promise.all(toMark.map(i => api.updateIdea(currentStoryId, i.id, { lastReviewedAt: new Date().toISOString() })));
                  showToast('Marked as reviewed');
                }}
                disabled={loading}
              >
                Mark as reviewed
              </button>
            </div>
          )}
          {filteredItems.map((item) => {
            switch (item.kind) {
              case 'idea':
                return (
                  <IdeaCard
                    key={item.id}
                    idea={item}
                    onDevelop={() => handleDevelop(item.id)}
                    onRefine={() => openRefineModal(item.id)}
                    onGenerateDirection={() => generateFromDirection(item.title, item.description)}
                    onDismiss={() => handleDismiss(item.id)}
                    onRestore={() => handleRestore(item.id)}
                    onDelete={() => handleDelete(item.id)}
                    loading={loading}
                  />
                );
              case 'storybeat':
                return (
                  <StoryBeatCard
                    key={item.id}
                    storyBeat={item}
                  />
                );
              case 'scene':
                return (
                  <SceneCard
                    key={item.id}
                    scene={item}
                  />
                );
            }
          })}
        </div>
      )}

      {/* Refine Modal */}
      {refineIdeaId && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3>Refine Idea</h3>
            {!refineVariants && (
              <>
                <textarea
                  className={styles.textarea}
                  placeholder="Add guidance to refine this idea"
                  rows={4}
                  value={refineGuidance}
                  onChange={(e) => setRefineGuidance(e.target.value)}
                />
                <div className={styles.ideaActions}>
                  <button type="button" className={styles.developButton} onClick={runRefine} disabled={refineLoading || !refineGuidance.trim()}>
                    {refineLoading ? 'Refining...' : 'Refine'}
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => setRefineIdeaId(null)} disabled={refineLoading}>Cancel</button>
                </div>
              </>
            )}
            {refineVariants && (
              <div>
                <p>{refineVariants.length} variants:</p>
                {refineVariants.map((v, idx) => (
                  <div key={v.id || idx} className={styles.ideaCard}>
                    <div className={styles.ideaHeader}>
                      <span className={styles.typeBadge}>{v.kind ?? 'proposal'}</span>
                      <span className={styles.ideaTitle}>{v.title}</span>
                    </div>
                    <p className={styles.ideaDescription}>{v.description}</p>
                    {v.resolution && <p className={styles.ideaDescription}>Resolution: {v.resolution}</p>}
                    <div className={styles.ideaActions}>
                      <button type="button" className={styles.developButton} onClick={() => commitVariant(idx, 'update')} disabled={refineLoading}>Accept & Update</button>
                      <button type="button" className={styles.addButton} onClick={() => commitVariant(idx, 'create')} disabled={refineLoading}>Create as New</button>
                    </div>
                  </div>
                ))}
                <div className={styles.ideaActions}>
                  <button type="button" className={styles.deleteButton} onClick={() => setRefineIdeaId(null)} disabled={refineLoading}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---- Idea Card (existing) ----

interface IdeaCardProps {
  idea: StashIdeaItem;
  onDevelop: () => void;
  onRefine: () => void;
  onGenerateDirection: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onDelete: () => void;
  loading: boolean;
}

function IdeaCard({
  idea,
  onDevelop,
  onRefine,
  onGenerateDirection,
  onDismiss,
  onRestore,
  onDelete,
  loading,
}: IdeaCardProps) {
  const isActive = idea.status === 'active';
  const isDismissed = idea.status === 'dismissed';

  return (
    <div className={`${styles.ideaCard} ${isDismissed ? styles.dismissed : ''}`}>
      <div className={styles.ideaHeader}>
        <span className={styles.categoryIcon}>{CATEGORY_ICONS[idea.category] ?? '\uD83D\uDCA1'}</span>
        <span className={styles.ideaTitle}>{idea.title}</span>
        <span className={styles.typeBadge}>{idea.planningKind ?? 'proposal'}</span>
        {idea.resolutionStatus && <span className={styles.sourceBadge}>{idea.resolutionStatus}</span>}
        <span className={styles.sourceBadge}>{idea.source}</span>
        {idea.suggestedType && (
          <span className={styles.typeBadge}>{idea.suggestedType}</span>
        )}
      </div>

      {idea.description && (
        <p className={styles.ideaDescription}>{idea.description}</p>
      )}

      <div className={styles.metaRow}>
        {typeof idea.usageCount === 'number' && <span className={styles.metaItem}>Used {idea.usageCount}x</span>}
        {typeof idea.informedCount === 'number' && idea.informedCount > 0 && (
          <span className={styles.metaItem}>Informed {idea.informedCount} artifacts</span>
        )}
        {idea.targetAct && <span className={styles.metaItem}>Act {idea.targetAct}</span>}
        {idea.targetBeat && <span className={styles.metaItem}>{idea.targetBeat}</span>}
      </div>

      <div className={styles.ideaActions}>
        {isActive && (
          <>
            <button
              type="button"
              className={styles.developButton}
              onClick={onDevelop}
              disabled={loading}
            >
              Develop
            </button>
            <button
              type="button"
              className={styles.developButton}
              onClick={onRefine}
              disabled={loading}
            >
              Refine with AI
            </button>
            {idea.planningKind === 'direction' && (
              <button
                type="button"
                className={styles.addButton}
                onClick={onGenerateDirection}
                disabled={loading}
              >
                Generate StoryBeat
              </button>
            )}
            <button
              type="button"
              className={styles.dismissButton}
              onClick={onDismiss}
              disabled={loading}
            >
              Dismiss
            </button>
          </>
        )}
        {isDismissed && (
          <button
            type="button"
            className={styles.restoreButton}
            onClick={onRestore}
            disabled={loading}
          >
            Restore
          </button>
        )}
        <button
          type="button"
          className={styles.deleteButton}
          onClick={onDelete}
          disabled={loading}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---- StoryBeat Card ----

function StoryBeatCard({ storyBeat }: { storyBeat: StashStoryBeatItem }) {
  return (
    <div className={styles.ideaCard}>
      <div className={styles.ideaHeader}>
        <span className={styles.categoryIcon}>{'\uD83D\uDCCB'}</span>
        <span className={styles.ideaTitle}>{storyBeat.title}</span>
        <span className={styles.typeBadge}>Story Beat</span>
        {storyBeat.priority && (
          <span className={styles.sourceBadge}>{storyBeat.priority}</span>
        )}
      </div>

      {storyBeat.summary && (
        <p className={styles.ideaDescription}>{storyBeat.summary}</p>
      )}

      {storyBeat.scenes.length > 0 && (
        <p className={styles.ideaDescription}>
          {storyBeat.scenes.length} scene{storyBeat.scenes.length !== 1 ? 's' : ''} attached
        </p>
      )}
    </div>
  );
}

// ---- Scene Card ----

function SceneCard({ scene }: { scene: StashSceneItem }) {
  return (
    <div className={styles.ideaCard}>
      <div className={styles.ideaHeader}>
        <span className={styles.categoryIcon}>{'\uD83C\uDFAC'}</span>
        <span className={styles.ideaTitle}>{scene.heading}</span>
        <span className={styles.typeBadge}>Scene</span>
      </div>

      {scene.overview && (
        <p className={styles.ideaDescription}>{scene.overview}</p>
      )}
    </div>
  );
}
