import { useState } from 'react';
import { useStory } from '../../context/StoryContext';
import { StoryCard } from './StoryCard';
import { BranchSelector } from './BranchSelector';
import { VersionHistory } from './VersionHistory';
import styles from './StoriesView.module.css';

export function StoriesView() {
  const {
    stories,
    currentStoryId,
    status,
    loading,
    error,
    selectStory,
    createStory,
    refreshStatus,
  } = useStory();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [logline, setLogline] = useState('');

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logline.trim()) return;
    await createStory(name.trim(), logline.trim());
    setShowCreate(false);
    setName('');
    setLogline('');
  };

  const handleBranchChange = () => {
    void refreshStatus();
  };

  return (
    <div className={styles.container}>
      {/* Left panel - Story list */}
      <div className={styles.storyList}>
        <div className={styles.header}>
          <h2 className={styles.title}>Stories</h2>
          <button
            className={styles.newBtn}
            onClick={() => setShowCreate(!showCreate)}
            type="button"
          >
            {showCreate ? 'Cancel' : '+ New'}
          </button>
        </div>

        {showCreate && (
          <form className={styles.createForm} onSubmit={handleCreateStory}>
            <input
              className={styles.input}
              type="text"
              placeholder="Story name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className={styles.textarea}
              placeholder="Logline (required)"
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              rows={3}
            />
            <button
              className={styles.createBtn}
              type="submit"
              disabled={!logline.trim() || loading}
            >
              {loading ? 'Creating...' : 'Create Story'}
            </button>
          </form>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.cards}>
          {stories.map((id) => (
            <StoryCard
              key={id}
              storyId={id}
              isSelected={id === currentStoryId}
              onSelect={selectStory}
            />
          ))}
          {stories.length === 0 && !loading && (
            <div className={styles.empty}>
              No stories yet. Create one to get started!
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Active story details */}
      <div className={styles.storyDetail}>
        {currentStoryId && status ? (
          <>
            <div className={styles.storyHeader}>
              <h2 className={styles.storyName}>{status.name || currentStoryId}</h2>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{status.stats.scenes}</span>
                  <span className={styles.statLabel}>Scenes</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{status.stats.beats}</span>
                  <span className={styles.statLabel}>Beats</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{status.stats.characters}</span>
                  <span className={styles.statLabel}>Chars</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{status.stats.storyBeats}</span>
                  <span className={styles.statLabel}>Beats</span>
                </div>
              </div>
            </div>

            <BranchSelector
              storyId={currentStoryId}
              currentBranch={status.currentBranch}
              onBranchChange={handleBranchChange}
            />

            <VersionHistory
              storyId={currentStoryId}
              currentVersionId={status.currentVersionId}
              onVersionChange={handleBranchChange}
            />
          </>
        ) : (
          <div className={styles.noStory}>
            <h3>No Story Selected</h3>
            <p>Select a story from the list or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
