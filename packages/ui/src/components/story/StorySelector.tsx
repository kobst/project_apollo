import { useState } from 'react';
import { useStory } from '../../context/StoryContext';
import styles from './StorySelector.module.css';

export function StorySelector() {
  const { stories, currentStoryId, selectStory, createStory, loading } =
    useStory();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [logline, setLogline] = useState('');

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id) {
      void selectStory(id);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logline.trim()) return;
    await createStory(name.trim(), logline.trim());
    setShowCreate(false);
    setName('');
    setLogline('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>Story</label>
        <button
          className={styles.newBtn}
          onClick={() => setShowCreate(!showCreate)}
          type="button"
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showCreate ? (
        <form className={styles.form} onSubmit={handleCreate}>
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
      ) : (
        <select
          className={styles.select}
          value={currentStoryId ?? ''}
          onChange={handleSelect}
          disabled={loading}
        >
          <option value="">Select a story...</option>
          {stories.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
