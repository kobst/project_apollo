import { useCallback } from 'react';
import type { ProposeEntryPointType, ProposeRequest, ProposeIntent } from '../../api/types';
import styles from './ComposeForm.module.css';

// Generation modes with smart defaults
export type GenerationMode = 'add' | 'expand' | 'explore';

// Form state interface - lifted to parent for persistence
export interface ComposeFormState {
  mode: GenerationMode;
  selectedEntryIndex: number;
  direction: string;
  showAdvanced: boolean;
  customCreativity: number | null;
  customPackageCount: number | null;
  customNodesPerPackage: number | null;
}

interface ModeConfig {
  intent: ProposeIntent;
  creativity: number;
  packageCount: number;
  maxNodesPerPackage: number;
  description: string;
}

const MODE_CONFIGS: Record<GenerationMode, ModeConfig> = {
  add: {
    intent: 'add',
    creativity: 0.5,
    packageCount: 5,
    maxNodesPerPackage: 5,
    description: 'Create new story elements that fit naturally',
  },
  expand: {
    intent: 'expand',
    creativity: 0.3,
    packageCount: 3,
    maxNodesPerPackage: 8,
    description: 'Build out from existing elements with more detail',
  },
  explore: {
    intent: 'add',
    creativity: 0.8,
    packageCount: 5,
    maxNodesPerPackage: 6,
    description: 'Generate creative alternatives and new directions',
  },
};

// Entry point options with optional target type for node-based entries
interface EntryPointOption {
  type: ProposeEntryPointType;
  label: string;
  targetType?: string; // For 'node' type, specifies which node type
}

const ENTRY_POINTS: EntryPointOption[] = [
  { type: 'freeText', label: 'Auto (AI decides)' },
  { type: 'beat', label: 'Beat' },
  { type: 'gap', label: 'Gap' },
  { type: 'node', label: 'Character', targetType: 'Character' },
  { type: 'node', label: 'Location', targetType: 'Location' },
  { type: 'node', label: 'Scene', targetType: 'Scene' },
  { type: 'node', label: 'Story Beat', targetType: 'StoryBeat' },
];

interface ComposeFormProps {
  onGenerate: (request: ProposeRequest) => Promise<void>;
  loading?: boolean;
  formState: ComposeFormState;
  onFormStateChange: (state: ComposeFormState) => void;
}

export function ComposeForm({
  onGenerate,
  loading = false,
  formState,
  onFormStateChange,
}: ComposeFormProps) {
  // Destructure form state
  const {
    mode,
    selectedEntryIndex,
    direction,
    showAdvanced,
    customCreativity,
    customPackageCount,
    customNodesPerPackage,
  } = formState;

  const selectedEntry = ENTRY_POINTS[selectedEntryIndex] ?? ENTRY_POINTS[0];

  // Helper to update a single field
  const updateField = <K extends keyof ComposeFormState>(
    field: K,
    value: ComposeFormState[K]
  ) => {
    onFormStateChange({ ...formState, [field]: value });
  };

  // Get effective values (custom or mode default)
  const getEffectiveValues = () => {
    const modeConfig = MODE_CONFIGS[mode];
    return {
      creativity: customCreativity ?? modeConfig.creativity,
      packageCount: customPackageCount ?? modeConfig.packageCount,
      maxNodesPerPackage: customNodesPerPackage ?? modeConfig.maxNodesPerPackage,
    };
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedEntry) return;

    const modeConfig = MODE_CONFIGS[mode];
    const effective = getEffectiveValues();

    const scope: ProposeRequest['scope'] = {
      entryPoint: selectedEntry.type,
    };

    // Add targetType for node-based entry points
    if (selectedEntry.targetType) {
      scope.targetType = selectedEntry.targetType;
    }

    const request: ProposeRequest = {
      intent: modeConfig.intent,
      scope,
      constraints: {
        creativity: effective.creativity,
      },
      options: {
        packageCount: effective.packageCount,
        maxNodesPerPackage: effective.maxNodesPerPackage,
      },
    };

    const trimmedDirection = direction.trim();
    if (trimmedDirection) {
      request.input = { text: trimmedDirection };
    }

    await onGenerate(request);
  }, [mode, selectedEntry, direction, customCreativity, customPackageCount, customNodesPerPackage, onGenerate, formState]);

  // Reset advanced options when mode changes
  const handleModeChange = (newMode: GenerationMode) => {
    onFormStateChange({
      ...formState,
      mode: newMode,
      customCreativity: null,
      customPackageCount: null,
      customNodesPerPackage: null,
    });
  };

  const effective = getEffectiveValues();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Proposal</h2>
        <p className={styles.subtitle}>
          Generate AI-powered story elements
        </p>
      </div>

      {/* Mode Selector */}
      <div className={styles.section}>
        <label className={styles.label}>Mode</label>
        <div className={styles.modeSelector}>
          {(Object.keys(MODE_CONFIGS) as GenerationMode[]).map((m) => (
            <button
              key={m}
              className={`${styles.modeBtn} ${mode === m ? styles.selected : ''}`}
              onClick={() => handleModeChange(m)}
              disabled={loading}
              type="button"
            >
              <span className={styles.modeName}>{m.charAt(0).toUpperCase() + m.slice(1)}</span>
              <span className={styles.modeDesc}>{MODE_CONFIGS[m].description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entry Point */}
      <div className={styles.section}>
        <label className={styles.label}>Entry Point</label>
        <select
          className={styles.select}
          value={selectedEntryIndex}
          onChange={(e) => updateField('selectedEntryIndex', Number(e.target.value))}
          disabled={loading}
        >
          {ENTRY_POINTS.map((ep, index) => (
            <option key={index} value={index}>
              {ep.label}
            </option>
          ))}
        </select>
      </div>

      {/* Direction */}
      <div className={styles.section}>
        <label className={styles.label}>Direction</label>
        <textarea
          className={styles.textarea}
          value={direction}
          onChange={(e) => updateField('direction', e.target.value)}
          placeholder="Describe what you want to generate... e.g., 'A mysterious informant who knows about the shipment robberies' or 'Scenes showing the growing tension between the partners'"
          rows={4}
          disabled={loading}
        />
      </div>

      {/* Advanced Options Accordion */}
      <div className={styles.advanced}>
        <button
          className={styles.advancedToggle}
          onClick={() => updateField('showAdvanced', !showAdvanced)}
          type="button"
        >
          <span>Advanced Options</span>
          <span className={styles.advancedIcon}>{showAdvanced ? '−' : '+'}</span>
        </button>

        {showAdvanced && (
          <div className={styles.advancedContent}>
            {/* Creativity */}
            <div className={styles.advancedOption}>
              <div className={styles.sliderHeader}>
                <label className={styles.advancedLabel}>Creativity</label>
                <span className={styles.sliderValue}>
                  {effective.creativity < 0.33 ? 'Conservative' : effective.creativity < 0.67 ? 'Balanced' : 'Inventive'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={customCreativity ?? MODE_CONFIGS[mode].creativity}
                onChange={(e) => updateField('customCreativity', Number(e.target.value))}
                disabled={loading}
                className={styles.slider}
              />
            </div>

            {/* Package Count */}
            <div className={styles.advancedOption}>
              <div className={styles.sliderHeader}>
                <label className={styles.advancedLabel}>Package Options</label>
                <span className={styles.sliderValue}>{effective.packageCount}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={customPackageCount ?? MODE_CONFIGS[mode].packageCount}
                onChange={(e) => updateField('customPackageCount', Number(e.target.value))}
                disabled={loading}
                className={styles.slider}
              />
            </div>

            {/* Nodes per Package */}
            <div className={styles.advancedOption}>
              <div className={styles.sliderHeader}>
                <label className={styles.advancedLabel}>Nodes per Package</label>
                <span className={styles.sliderValue}>{effective.maxNodesPerPackage}</span>
              </div>
              <input
                type="range"
                min="3"
                max="15"
                value={customNodesPerPackage ?? MODE_CONFIGS[mode].maxNodesPerPackage}
                onChange={(e) => updateField('customNodesPerPackage', Number(e.target.value))}
                disabled={loading}
                className={styles.slider}
              />
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        className={styles.generateBtn}
        onClick={handleSubmit}
        disabled={loading}
        type="button"
      >
        {loading ? 'Generating...' : 'Generate Proposals'}
      </button>
    </div>
  );
}
