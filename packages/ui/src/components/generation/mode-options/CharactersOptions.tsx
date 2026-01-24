/**
 * CharactersOptions - Options for Characters generation mode.
 * Allows developing existing characters or creating new ones.
 */

import styles from './ModeOptions.module.css';

export type CharacterFocus =
  | 'develop-existing'
  | 'new-protagonist'
  | 'new-antagonist'
  | 'new-supporting'
  | 'fill-gaps';

export interface CharactersOptionsState {
  focus: CharacterFocus;
  characterId?: string | undefined;
  includeArcs: boolean;
}

interface CharacterInfo {
  id: string;
  name: string;
  role?: string | undefined;
}

interface CharactersOptionsProps {
  /** Current options state */
  value: CharactersOptionsState;
  /** Callback when options change */
  onChange: (options: CharactersOptionsState) => void;
  /** Available characters */
  characters?: CharacterInfo[];
  /** Whether controls are disabled */
  disabled?: boolean;
}

const FOCUS_OPTIONS: { value: CharacterFocus; label: string; description: string }[] = [
  { value: 'develop-existing', label: 'Develop Existing', description: 'Deepen an existing character' },
  { value: 'new-protagonist', label: 'New Protagonist', description: 'Create a main character' },
  { value: 'new-antagonist', label: 'New Antagonist', description: 'Create an opposing force' },
  { value: 'new-supporting', label: 'New Supporting', description: 'Add supporting cast' },
  { value: 'fill-gaps', label: 'Fill Gaps', description: 'AI identifies missing roles' },
];

export function CharactersOptions({
  value,
  onChange,
  characters = [],
  disabled = false,
}: CharactersOptionsProps) {
  const handleFocusChange = (focus: CharacterFocus) => {
    onChange({
      ...value,
      focus,
      // Clear character selection if not developing existing
      characterId: focus === 'develop-existing' ? value.characterId : undefined,
    });
  };

  const handleCharacterChange = (characterId: string) => {
    onChange({ ...value, characterId: characterId || undefined });
  };

  const handleIncludeArcsChange = (includeArcs: boolean) => {
    onChange({ ...value, includeArcs });
  };

  const needsCharacterSelection = value.focus === 'develop-existing';

  return (
    <div className={styles.container}>
      {/* Focus Type Radio Group */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>Focus</label>
        <div className={styles.radioGroup}>
          {FOCUS_OPTIONS.map((opt) => (
            <label key={opt.value} className={styles.radioOption}>
              <input
                type="radio"
                name="charactersFocus"
                value={opt.value}
                checked={value.focus === opt.value}
                onChange={() => handleFocusChange(opt.value)}
                disabled={disabled}
              />
              <span className={styles.radioLabel}>{opt.label}</span>
              <span className={styles.radioHint}>{opt.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Character Selector (shown when developing existing) */}
      {needsCharacterSelection && (
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Character</label>
          {characters.length === 0 ? (
            <p className={styles.emptyState}>No characters available. Create one first.</p>
          ) : (
            <select
              className={styles.select}
              value={value.characterId ?? ''}
              onChange={(e) => handleCharacterChange(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select a character...</option>
              {characters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                  {char.role && ` (${char.role})`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Include Character Arcs Checkbox */}
      <div className={styles.section}>
        <label className={styles.checkboxOption}>
          <input
            type="checkbox"
            checked={value.includeArcs}
            onChange={(e) => handleIncludeArcsChange(e.target.checked)}
            disabled={disabled}
          />
          <span className={styles.checkboxLabel}>Include character arcs</span>
          <span className={styles.checkboxHint}>Generate arc nodes with start/end states</span>
        </label>
      </div>
    </div>
  );
}
