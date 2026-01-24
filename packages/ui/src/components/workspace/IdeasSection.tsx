/**
 * IdeasSection - Display and manage story ideas in the Story Bible.
 * Ideas can be created, filtered, developed, or deleted.
 */

import { useState, useMemo } from 'react';
import { useIdeas, type IdeaStatus, type IdeaCategory, type IdeaWithMeta } from '../../hooks/useIdeas';
import { useStory } from '../../context/StoryContext';
import type { IdeaSuggestedType } from '../../api/types';
import styles from './IdeasSection.module.css';

const STATUS_OPTIONS: { value: IdeaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'dismissed', label: 'Dismissed' },
];

const CATEGORY_OPTIONS: { value: IdeaCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'character', label: 'Character' },
  { value: 'plot', label: 'Plot' },
  { value: 'scene', label: 'Scene' },
  { value: 'worldbuilding', label: 'Worldbuilding' },
  { value: 'general', label: 'General' },
];

const CATEGORY_ICONS: Record<IdeaCategory, string> = {
  character: '\uD83D\uDC64', // 👤
  plot: '\uD83D\uDCCB', // 📋
  scene: '\uD83C\uDFAC', // 🎬
  worldbuilding: '\uD83C\uDF0D', // 🌍
  general: '\uD83D\uDCA1', // 💡
};

const TYPE_OPTIONS: { value: IdeaSuggestedType | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'Character', label: 'Character' },
  { value: 'StoryBeat', label: 'Story Beat' },
  { value: 'Scene', label: 'Scene' },
  { value: 'Location', label: 'Location' },
  { value: 'Object', label: 'Object' },
];

interface IdeasSectionProps {
  /** Callback when Develop is clicked on an idea */
  onDevelop?: (ideaId: string) => void;
}

export function IdeasSection({ onDevelop }: IdeasSectionProps) {
  const { currentStoryId } = useStory();
  const { ideas, loading, error, createIdea, updateIdea, deleteIdea } = useIdeas(currentStoryId);

  // Filters
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | 'all'>('all');

  // Add idea form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSuggestedType, setNewSuggestedType] = useState<IdeaSuggestedType | ''>('');

  // Filtered ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && idea.category !== categoryFilter) return false;
      return true;
    });
  }, [ideas, statusFilter, categoryFilter]);

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
      // Error handled by hook
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
      // Error handled by hook
    }
  };

  const handleRestore = async (ideaId: string) => {
    try {
      await updateIdea(ideaId, { status: 'active' });
    } catch {
      // Error handled by hook
    }
  };

  const handleDelete = async (ideaId: string) => {
    try {
      await deleteIdea(ideaId);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <section id="ideas" className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.icon}>{'\uD83D\uDCA1'}</span>
          Ideas
          <span className={styles.count}>({ideas.length})</span>
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

      {/* Filters */}
      <div className={styles.filters}>
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
        <select
          className={styles.categorySelect}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as IdeaCategory | 'all')}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Ideas List */}
      {loading && ideas.length === 0 ? (
        <div className={styles.loading}>Loading ideas...</div>
      ) : filteredIdeas.length === 0 ? (
        <div className={styles.empty}>
          <p>No ideas found.</p>
          <p className={styles.emptyHint}>
            {statusFilter !== 'all'
              ? `No ${statusFilter} ideas. Try changing the filter.`
              : 'Add your first idea to get started!'}
          </p>
        </div>
      ) : (
        <div className={styles.ideaList}>
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onDevelop={() => handleDevelop(idea.id)}
              onDismiss={() => handleDismiss(idea.id)}
              onRestore={() => handleRestore(idea.id)}
              onDelete={() => handleDelete(idea.id)}
              loading={loading}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface IdeaCardProps {
  idea: IdeaWithMeta;
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
        <span className={styles.categoryIcon}>{CATEGORY_ICONS[idea.category]}</span>
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
