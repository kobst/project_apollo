/**
 * StashSection - Unified display for unassigned StoryBeats, Scenes, and Ideas.
 * Replaces the old IdeasSection with type filter tabs and kind-specific cards.
 */

import { useState, useMemo } from 'react';
import {
  useStashContext,
  type IdeaStatus,
  type StashIdeaItem,
  type StashStoryBeatItem,
  type StashSceneItem,
  type StashItemKind,
} from '../../context/StashContext';
import type { IdeaSuggestedType } from '../../api/types';
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

  // Filters
  const [typeFilter, setTypeFilter] = useState<StashItemKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('active');

  // Add idea form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSuggestedType, setNewSuggestedType] = useState<IdeaSuggestedType | ''>('');

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      // Status filter applies only to ideas
      if (item.kind === 'idea' && statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  const handleAddIdea = async () => {
    if (!newTitle.trim()) return;

    try {
      await createIdea(
        newTitle.trim(),
        newDescription.trim(),
        newSuggestedType || undefined
      );
      setNewTitle('');
      setNewDescription('');
      setNewSuggestedType('');
      setShowAddForm(false);
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

  // Show status filter only when viewing ideas (or all)
  const showStatusFilter = typeFilter === 'all' || typeFilter === 'idea';

  return (
    <section id="stash" className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.icon}>{'\uD83D\uDCE5'}</span>
          Stash
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
        </div>
        {showStatusFilter && (
          <div className={styles.statusTabs}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.statusTab} ${statusFilter === opt.value ? styles.active : ''}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
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
          {filteredItems.map((item) => {
            switch (item.kind) {
              case 'idea':
                return (
                  <IdeaCard
                    key={item.id}
                    idea={item}
                    onDevelop={() => handleDevelop(item.id)}
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
    </section>
  );
}

// ---- Idea Card (existing) ----

interface IdeaCardProps {
  idea: StashIdeaItem;
  onDevelop: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onDelete: () => void;
  loading: boolean;
}

function IdeaCard({
  idea,
  onDevelop,
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
        <span className={styles.sourceBadge}>{idea.source}</span>
        {idea.suggestedType && (
          <span className={styles.typeBadge}>{idea.suggestedType}</span>
        )}
      </div>

      {idea.description && (
        <p className={styles.ideaDescription}>{idea.description}</p>
      )}

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
