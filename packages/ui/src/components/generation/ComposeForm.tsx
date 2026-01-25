/**
 * ComposeForm - Main generation form with four-mode system.
 * Modes: Story Beats, Characters, Scenes, Expand
 */

import { useCallback, useEffect, useState } from 'react';
import { ModeSelector, type GenerationMode } from './ModeSelector';
import { ExpansionScopeToggle, type ExpansionScope } from './ExpansionScopeToggle';
import {
  StoryBeatsOptions,
  CharactersOptions,
  ScenesOptions,
  ExpandOptions,
  type StoryBeatsOptionsState,
  type CharactersOptionsState,
  type ScenesOptionsState,
  type ExpandOptionsState,
} from './mode-options';
import type {
  ProposeStoryBeatsRequest,
  ProposeCharactersRequest,
  ProposeScenesRequest,
  ProposeExpandRequest,
} from '../../api/types';
import styles from './ComposeForm.module.css';

// Form state interface - lifted to parent for persistence
export interface ComposeFormState {
  mode: GenerationMode;
  expansionScope: ExpansionScope;

  storyBeatsOptions: StoryBeatsOptionsState;
  charactersOptions: CharactersOptionsState;
  scenesOptions: ScenesOptionsState;
  expandOptions: ExpandOptionsState;

  direction: string;
  showAdvanced: boolean;
  customCreativity: number | null;
  customPackageCount: number | null;
}

// Default state factory
export function createDefaultFormState(): ComposeFormState {
  return {
    mode: 'story-beats',
    expansionScope: 'flexible',

    storyBeatsOptions: {
      focusType: 'all',
      priorityBeats: [],
    },
    charactersOptions: {
      focus: 'fill-gaps',
      includeArcs: true,
    },
    scenesOptions: {
      storyBeatIds: [],
      scenesPerBeat: 2,
    },
    expandOptions: {
      targetType: 'story-context',
      depth: 'surface',
    },

    direction: '',
    showAdvanced: false,
    customCreativity: null,
    customPackageCount: null,
  };
}

// Mode-specific default values
interface ModeDefaults {
  creativity: number;
  packageCount: number;
}

const MODE_DEFAULTS: Record<GenerationMode, ModeDefaults> = {
  'story-beats': { creativity: 0.5, packageCount: 5 },
  'characters': { creativity: 0.6, packageCount: 4 },
  'scenes': { creativity: 0.4, packageCount: 3 },
  'expand': { creativity: 0.3, packageCount: 3 },
};

// Data passed from parent for mode options
interface BeatInfo {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  hasMissingStoryBeats: boolean;
}

interface CharacterInfo {
  id: string;
  name: string;
  role?: string | undefined;
}

interface StoryBeatInfo {
  id: string;
  title: string;
  intent: string;
  act?: number | undefined;
  sceneCount: number;
  status: 'proposed' | 'approved' | 'deprecated';
}

interface SelectedNodeInfo {
  id: string;
  type: string;
  name: string;
}

interface ComposeFormProps {
  /** Generate Story Beats */
  onGenerateStoryBeats: (request: ProposeStoryBeatsRequest) => Promise<void>;
  /** Generate Characters */
  onGenerateCharacters: (request: ProposeCharactersRequest) => Promise<void>;
  /** Generate Scenes */
  onGenerateScenes: (request: ProposeScenesRequest) => Promise<void>;
  /** Generate Expand */
  onGenerateExpand: (request: ProposeExpandRequest) => Promise<void>;
  /** Loading state */
  loading?: boolean;
  /** Form state (lifted to parent) */
  formState: ComposeFormState;
  /** Callback to update form state */
  onFormStateChange: (state: ComposeFormState) => void;
  /** Available beats from outline */
  beats?: BeatInfo[];
  /** Available characters */
  characters?: CharacterInfo[];
  /** Available story beats */
  storyBeats?: StoryBeatInfo[];
  /** Currently selected node in Story Bible */
  selectedNode?: SelectedNodeInfo | undefined;
  /** Callback to enable/disable node selection mode */
  onNodeSelectionModeChange?: ((enabled: boolean) => void) | undefined;
}

export function ComposeForm({
  onGenerateStoryBeats,
  onGenerateCharacters,
  onGenerateScenes,
  onGenerateExpand,
  loading = false,
  formState,
  onFormStateChange,
  beats = [],
  characters = [],
  storyBeats = [],
  selectedNode,
  onNodeSelectionModeChange,
}: ComposeFormProps) {
  const {
    mode,
    expansionScope,
    storyBeatsOptions,
    charactersOptions,
    scenesOptions,
    expandOptions,
    direction,
    showAdvanced,
    customCreativity,
    customPackageCount,
  } = formState;

  // Helper to update a single field
  const updateField = <K extends keyof ComposeFormState>(
    field: K,
    value: ComposeFormState[K]
  ) => {
    onFormStateChange({ ...formState, [field]: value });
  };

  // Get effective values (custom or mode default)
  const getEffectiveValues = () => {
    const defaults = MODE_DEFAULTS[mode];
    return {
      creativity: customCreativity ?? defaults.creativity,
      packageCount: customPackageCount ?? defaults.packageCount,
    };
  };

  // Handle mode change - reset mode-specific options
  const handleModeChange = (newMode: GenerationMode) => {
    onFormStateChange({
      ...formState,
      mode: newMode,
      customCreativity: null,
      customPackageCount: null,
    });
  };

  // Sync selected node with expand options
  useEffect(() => {
    if (
      selectedNode &&
      mode === 'expand' &&
      expandOptions.targetType === 'node'
    ) {
      updateField('expandOptions', {
        ...expandOptions,
        nodeId: selectedNode.id,
        nodeType: selectedNode.type,
        nodeName: selectedNode.name,
      });
    }
  }, [selectedNode, mode, expandOptions.targetType]);

  // Enable/disable node selection mode based on form state
  useEffect(() => {
    const shouldEnableSelection = mode === 'expand' && expandOptions.targetType === 'node';
    onNodeSelectionModeChange?.(shouldEnableSelection);

    // Cleanup - disable when component unmounts or changes
    return () => {
      onNodeSelectionModeChange?.(false);
    };
  }, [mode, expandOptions.targetType, onNodeSelectionModeChange]);

  // Validate form before submission
  const validateForm = (): string | null => {
    switch (mode) {
      case 'story-beats':
        if (storyBeatsOptions.focusType === 'beats' && storyBeatsOptions.priorityBeats.length === 0) {
          return 'Select at least one beat when using Priority Beats focus';
        }
        break;
      case 'characters':
        if (charactersOptions.focus === 'develop-existing' && !charactersOptions.characterId) {
          return 'Select a character to develop';
        }
        break;
      case 'scenes':
        if (scenesOptions.storyBeatIds.length === 0) {
          return 'Select at least one story beat to generate scenes from';
        }
        break;
      case 'expand':
        if (expandOptions.targetType === 'node' && !expandOptions.nodeId) {
          return 'Select an element to expand';
        }
        break;
    }
    return null;
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);

    const effective = getEffectiveValues();
    const inventNewEntities = expansionScope === 'flexible';

    switch (mode) {
      case 'story-beats': {
        const request: ProposeStoryBeatsRequest = {
          focus: storyBeatsOptions.focusType,
          targetAct: storyBeatsOptions.targetAct,
          priorityBeatIds: storyBeatsOptions.priorityBeats.length > 0
            ? storyBeatsOptions.priorityBeats
            : undefined,
          direction: direction.trim() || undefined,
          creativity: effective.creativity,
          packageCount: effective.packageCount,
          inventNewEntities,
        };
        await onGenerateStoryBeats(request);
        break;
      }
      case 'characters': {
        const request: ProposeCharactersRequest = {
          focus: charactersOptions.focus,
          characterId: charactersOptions.characterId,
          includeArcs: charactersOptions.includeArcs,
          direction: direction.trim() || undefined,
          creativity: effective.creativity,
          packageCount: effective.packageCount,
          inventNewEntities,
        };
        await onGenerateCharacters(request);
        break;
      }
      case 'scenes': {
        const request: ProposeScenesRequest = {
          storyBeatIds: scenesOptions.storyBeatIds,
          scenesPerBeat: scenesOptions.scenesPerBeat,
          direction: direction.trim() || undefined,
          creativity: effective.creativity,
          packageCount: effective.packageCount,
          inventNewEntities,
        };
        await onGenerateScenes(request);
        break;
      }
      case 'expand': {
        const request: ProposeExpandRequest = {
          targetType: expandOptions.targetType,
          contextSection: expandOptions.contextSection,
          nodeId: expandOptions.nodeId,
          depth: expandOptions.depth,
          direction: direction.trim() || undefined,
          creativity: effective.creativity,
          packageCount: effective.packageCount,
          inventNewEntities,
        };
        await onGenerateExpand(request);
        break;
      }
    }
  }, [
    mode,
    expansionScope,
    storyBeatsOptions,
    charactersOptions,
    scenesOptions,
    expandOptions,
    direction,
    customCreativity,
    customPackageCount,
    onGenerateStoryBeats,
    onGenerateCharacters,
    onGenerateScenes,
    onGenerateExpand,
  ]);

  const effective = getEffectiveValues();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Proposal</h2>
        <p className={styles.subtitle}>Generate AI-powered story elements</p>
      </div>

      {/* Mode Selector */}
      <div className={styles.section}>
        <label className={styles.label}>Mode</label>
        <ModeSelector
          value={mode}
          onChange={handleModeChange}
          disabled={loading}
        />
      </div>

      {/* Expansion Scope */}
      <div className={styles.section}>
        <label className={styles.label}>Expansion Scope</label>
        <ExpansionScopeToggle
          value={expansionScope}
          onChange={(scope) => updateField('expansionScope', scope)}
          disabled={loading}
        />
      </div>

      {/* Mode-Specific Options */}
      <div className={styles.section}>
        <label className={styles.label}>Options</label>
        {mode === 'story-beats' && (
          <StoryBeatsOptions
            value={storyBeatsOptions}
            onChange={(opts) => updateField('storyBeatsOptions', opts)}
            beats={beats}
            disabled={loading}
          />
        )}
        {mode === 'characters' && (
          <CharactersOptions
            value={charactersOptions}
            onChange={(opts) => updateField('charactersOptions', opts)}
            characters={characters}
            disabled={loading}
          />
        )}
        {mode === 'scenes' && (
          <ScenesOptions
            value={scenesOptions}
            onChange={(opts) => updateField('scenesOptions', opts)}
            storyBeats={storyBeats}
            disabled={loading}
          />
        )}
        {mode === 'expand' && (
          <ExpandOptions
            value={expandOptions}
            onChange={(opts) => updateField('expandOptions', opts)}
            selectedNode={selectedNode}
            disabled={loading}
          />
        )}
      </div>

      {/* Direction */}
      <div className={styles.section}>
        <label className={styles.label}>Direction (Optional)</label>
        <textarea
          className={styles.textarea}
          value={direction}
          onChange={(e) => updateField('direction', e.target.value)}
          placeholder="Describe what you want to generate... e.g., 'Focus on building tension' or 'A mysterious informant who knows secrets'"
          rows={3}
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
          <span className={styles.advancedIcon}>{showAdvanced ? '\u2212' : '+'}</span>
        </button>

        {showAdvanced && (
          <div className={styles.advancedContent}>
            {/* Creativity */}
            <div className={styles.advancedOption}>
              <div className={styles.sliderHeader}>
                <label className={styles.advancedLabel}>Creativity</label>
                <span className={styles.sliderValue}>
                  {effective.creativity < 0.33
                    ? 'Conservative'
                    : effective.creativity < 0.67
                      ? 'Balanced'
                      : 'Inventive'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={customCreativity ?? MODE_DEFAULTS[mode].creativity}
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
                value={customPackageCount ?? MODE_DEFAULTS[mode].packageCount}
                onChange={(e) => updateField('customPackageCount', Number(e.target.value))}
                disabled={loading}
                className={styles.slider}
              />
            </div>
          </div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className={styles.validationError}>
          {validationError}
        </div>
      )}

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

// Re-export types for convenience
export type { GenerationMode } from './ModeSelector';
export type { ExpansionScope } from './ExpansionScopeToggle';
