/**
 * Story Context Editor
 *
 * Structured editor for Story Context with separate sections for:
 * - Constitution (stable creative direction, cached in system prompt)
 * - Operational (soft guidelines, filtered per-task)
 *
 * Features auto-save with debounce.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type {
  StoryContext,
  StoryContextConstitution,
  HardRule,
  SoftGuideline,
  GuidelineTag,
  StoryContextChange,
} from '../../api/types';
import { ListEditor } from './ListEditor';
import { GuidelineEditor } from './GuidelineEditor';
import styles from './StoryContextEditor.module.css';

// =============================================================================
// Proposed Changes Extraction
// =============================================================================

interface ProposedChanges {
  premise?: string;
  genre?: string;
  setting?: string;
  toneEssence?: string;
  thematicPillars: string[];
  hardRules: HardRule[];
  softGuidelines: SoftGuideline[];
  banned: string[];
  workingNotes?: string;
}

function extractProposedChanges(changes: StoryContextChange[]): ProposedChanges {
  const proposed: ProposedChanges = {
    thematicPillars: [],
    hardRules: [],
    softGuidelines: [],
    banned: [],
  };

  for (const change of changes) {
    const op = change.operation;
    switch (op.type) {
      case 'setConstitutionField':
        if (op.field === 'premise') proposed.premise = op.value;
        if (op.field === 'genre') proposed.genre = op.value;
        if (op.field === 'setting') proposed.setting = op.value;
        if (op.field === 'toneEssence') proposed.toneEssence = op.value;
        break;
      case 'addThematicPillar':
        proposed.thematicPillars.push(op.pillar);
        break;
      case 'addHardRule':
        proposed.hardRules.push(op.rule);
        break;
      case 'addGuideline':
        proposed.softGuidelines.push({
          id: op.guideline.id,
          tags: op.guideline.tags as GuidelineTag[],
          text: op.guideline.text,
        });
        break;
      case 'addBanned':
        proposed.banned.push(op.item);
        break;
      case 'setWorkingNotes':
        proposed.workingNotes = op.content;
        break;
    }
  }

  return proposed;
}

// =============================================================================
// Factory Functions
// =============================================================================

function createDefaultContext(): StoryContext {
  return {
    constitution: {
      logline: '',
      premise: '',
      genre: '',
      setting: '',
      thematicPillars: [],
      hardRules: [],
      toneEssence: '',
      banned: [],
      version: '1.0.0',
    },
    operational: {
      softGuidelines: [],
    },
  };
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createHardRule(text: string = ''): HardRule {
  return { id: generateId('hr'), text };
}

function createSoftGuideline(text: string = '', tags: GuidelineTag[] = ['general']): SoftGuideline {
  return { id: generateId('sg'), tags, text };
}

// =============================================================================
// Component
// =============================================================================

interface StoryContextEditorProps {
  /** If true, renders in compact mode for drawer */
  compact?: boolean;
}

export function StoryContextEditor({ compact = false }: StoryContextEditorProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { staging } = useGeneration();

  const [context, setContext] = useState<StoryContext>(createDefaultContext());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Section collapse state
  const [constitutionExpanded, setConstitutionExpanded] = useState(true);
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(true);
  const [workingNotesExpanded, setWorkingNotesExpanded] = useState(true);

  // Extract proposed changes from staged package
  const proposedChanges = useMemo(() => {
    const stagedContextChanges = staging.stagedPackage?.changes.storyContext ?? [];
    return extractProposedChanges(stagedContextChanges);
  }, [staging.stagedPackage]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContextRef = useRef<string>('');

  // Fetch context on mount
  useEffect(() => {
    async function fetchContext() {
      if (!currentStoryId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await api.getContext(currentStoryId);
        const ctx = data.context ?? createDefaultContext();
        setContext(ctx);
        lastSavedContextRef.current = JSON.stringify(ctx);
        setLastSaved(data.modifiedAt);
        setHasChanges(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setLoading(false);
      }
    }

    void fetchContext();
  }, [currentStoryId]);

  // Auto-save with debounce
  const saveContext = useCallback(async (newContext: StoryContext) => {
    if (!currentStoryId) return;

    const serialized = JSON.stringify(newContext);
    if (serialized === lastSavedContextRef.current) {
      setHasChanges(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await api.updateContext(currentStoryId, newContext);
      lastSavedContextRef.current = serialized;
      setLastSaved(result.modifiedAt);
      setHasChanges(false);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save context');
    } finally {
      setSaving(false);
    }
  }, [currentStoryId, refreshStatus]);

  // Handle context change with debounced save
  const handleContextChange = useCallback((newContext: StoryContext) => {
    setContext(newContext);
    setHasChanges(JSON.stringify(newContext) !== lastSavedContextRef.current);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      void saveContext(newContext);
    }, 1000);
  }, [saveContext]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // =============================================================================
  // Constitution Handlers
  // =============================================================================

  const handleConstitutionFieldChange = useCallback((
    field: keyof StoryContextConstitution,
    value: string | string[]
  ) => {
    handleContextChange({
      ...context,
      constitution: {
        ...context.constitution,
        [field]: value,
      },
    });
  }, [context, handleContextChange]);

  const handleAddHardRule = useCallback(() => {
    handleContextChange({
      ...context,
      constitution: {
        ...context.constitution,
        hardRules: [...context.constitution.hardRules, createHardRule()],
      },
    });
  }, [context, handleContextChange]);

  const handleHardRuleChange = useCallback((index: number, text: string) => {
    const updated = [...context.constitution.hardRules];
    const existing = updated[index];
    if (existing) {
      updated[index] = { id: existing.id, text };
    }
    handleContextChange({
      ...context,
      constitution: {
        ...context.constitution,
        hardRules: updated,
      },
    });
  }, [context, handleContextChange]);

  const handleRemoveHardRule = useCallback((index: number) => {
    const updated = context.constitution.hardRules.filter((_, i) => i !== index);
    handleContextChange({
      ...context,
      constitution: {
        ...context.constitution,
        hardRules: updated,
      },
    });
  }, [context, handleContextChange]);

  // =============================================================================
  // Operational Handlers
  // =============================================================================

  const handleAddGuideline = useCallback(() => {
    handleContextChange({
      ...context,
      operational: {
        ...context.operational,
        softGuidelines: [...context.operational.softGuidelines, createSoftGuideline()],
      },
    });
  }, [context, handleContextChange]);

  const handleGuidelineChange = useCallback((index: number, updated: SoftGuideline) => {
    const guidelines = [...context.operational.softGuidelines];
    guidelines[index] = updated;
    handleContextChange({
      ...context,
      operational: {
        ...context.operational,
        softGuidelines: guidelines,
      },
    });
  }, [context, handleContextChange]);

  const handleRemoveGuideline = useCallback((index: number) => {
    const guidelines = context.operational.softGuidelines.filter((_, i) => i !== index);
    handleContextChange({
      ...context,
      operational: {
        ...context.operational,
        softGuidelines: guidelines,
      },
    });
  }, [context, handleContextChange]);

  const handleWorkingNotesChange = useCallback((notes: string) => {
    const operational = { ...context.operational, softGuidelines: context.operational.softGuidelines };
    if (notes) {
      operational.workingNotes = notes;
    }
    // If notes is empty, don't include workingNotes at all
    handleContextChange({
      ...context,
      operational,
    });
  }, [context, handleContextChange]);

  // =============================================================================
  // Render
  // =============================================================================

  if (!currentStoryId) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.placeholder}>Select a story to edit context</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Story Context</h3>
        <div className={styles.status}>
          {saving && <span className={styles.saving}>Saving...</span>}
          {hasChanges && !saving && <span className={styles.unsaved}>Unsaved changes</span>}
          {!hasChanges && !saving && lastSaved && (
            <span className={styles.saved}>Saved</span>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        {/* Constitution Section */}
        <section className={styles.section}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => setConstitutionExpanded(!constitutionExpanded)}
          >
            <span className={styles.sectionTitle}>
              Constitution
              <span className={styles.cacheNote}>(cached in system prompt)</span>
            </span>
            <span className={styles.expandIcon}>{constitutionExpanded ? '-' : '+'}</span>
          </button>

          {constitutionExpanded && (
            <div className={styles.sectionContent}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Logline</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={context.constitution.logline}
                  onChange={(e) => handleConstitutionFieldChange('logline', e.target.value)}
                  placeholder="One-sentence story summary..."
                  disabled={saving}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Premise</label>
                <textarea
                  className={styles.textArea}
                  value={context.constitution.premise}
                  onChange={(e) => handleConstitutionFieldChange('premise', e.target.value)}
                  placeholder="Extended premise - the core concept and what makes it unique..."
                  disabled={saving}
                  rows={3}
                />
                {proposedChanges.premise && (
                  <div className={styles.proposedItem}>
                    <span className={styles.proposedBadge}>Proposed</span>
                    <p className={styles.proposedText}>{proposedChanges.premise}</p>
                  </div>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Genre</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={context.constitution.genre}
                  onChange={(e) => handleConstitutionFieldChange('genre', e.target.value)}
                  placeholder="Genre (e.g., sci-fi thriller, romantic comedy)..."
                  disabled={saving}
                />
                {proposedChanges.genre && (
                  <div className={styles.proposedItem}>
                    <span className={styles.proposedBadge}>Proposed</span>
                    <p className={styles.proposedText}>{proposedChanges.genre}</p>
                  </div>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Setting</label>
                <textarea
                  className={styles.textArea}
                  value={context.constitution.setting}
                  onChange={(e) => handleConstitutionFieldChange('setting', e.target.value)}
                  placeholder="Setting/world (e.g., 1920s Chicago, post-apocalyptic wasteland)..."
                  disabled={saving}
                  rows={2}
                />
                {proposedChanges.setting && (
                  <div className={styles.proposedItem}>
                    <span className={styles.proposedBadge}>Proposed</span>
                    <p className={styles.proposedText}>{proposedChanges.setting}</p>
                  </div>
                )}
              </div>

              <ListEditor
                label="Thematic Pillars"
                items={context.constitution.thematicPillars}
                onChange={(items) => handleConstitutionFieldChange('thematicPillars', items)}
                placeholder="Add thematic pillar..."
                disabled={saving}
                proposedItems={proposedChanges.thematicPillars}
              />

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Hard Rules
                  <span className={styles.fieldHint}>(AI must never violate)</span>
                </label>
                <div className={styles.rulesList}>
                  {context.constitution.hardRules.map((rule, index) => (
                    <div key={rule.id} className={styles.ruleItem}>
                      <span className={styles.ruleNumber}>{index + 1}.</span>
                      <input
                        type="text"
                        className={styles.ruleInput}
                        value={rule.text}
                        onChange={(e) => handleHardRuleChange(index, e.target.value)}
                        placeholder="Rule text..."
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => handleRemoveHardRule(index)}
                        disabled={saving}
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {/* Proposed hard rules */}
                  {proposedChanges.hardRules.map((rule) => (
                    <div key={rule.id} className={`${styles.ruleItem} ${styles.proposedRuleItem}`}>
                      <span className={styles.proposedBadge}>+</span>
                      <span className={styles.proposedRuleText}>{rule.text}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={handleAddHardRule}
                    disabled={saving}
                  >
                    + Add Hard Rule
                  </button>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Tone & Voice</label>
                <textarea
                  className={styles.textArea}
                  value={context.constitution.toneEssence}
                  onChange={(e) => handleConstitutionFieldChange('toneEssence', e.target.value)}
                  placeholder="The essential tone and voice of the story..."
                  disabled={saving}
                  rows={2}
                />
                {proposedChanges.toneEssence && (
                  <div className={styles.proposedItem}>
                    <span className={styles.proposedBadge}>Proposed</span>
                    <p className={styles.proposedText}>{proposedChanges.toneEssence}</p>
                  </div>
                )}
              </div>

              <ListEditor
                label="Banned Elements"
                items={context.constitution.banned}
                onChange={(items) => handleConstitutionFieldChange('banned', items)}
                placeholder="Add banned element..."
                disabled={saving}
                proposedItems={proposedChanges.banned}
              />

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Version</label>
                <input
                  type="text"
                  className={`${styles.textInput} ${styles.versionInput}`}
                  value={context.constitution.version}
                  onChange={(e) => handleConstitutionFieldChange('version', e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </section>

        {/* Soft Guidelines Section */}
        <section className={styles.section}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => setGuidelinesExpanded(!guidelinesExpanded)}
          >
            <span className={styles.sectionTitle}>
              Soft Guidelines
              <span className={styles.filterNote}>(filtered per-task)</span>
            </span>
            <span className={styles.expandIcon}>{guidelinesExpanded ? '-' : '+'}</span>
          </button>

          {guidelinesExpanded && (
            <div className={styles.sectionContent}>
              <p className={styles.sectionDescription}>
                Guidelines are filtered by tags and included in user prompts when relevant to the task.
              </p>
              <div className={styles.guidelinesList}>
                {context.operational.softGuidelines.map((guideline, index) => (
                  <GuidelineEditor
                    key={guideline.id}
                    guideline={guideline}
                    onChange={(updated) => handleGuidelineChange(index, updated)}
                    onRemove={() => handleRemoveGuideline(index)}
                    disabled={saving}
                  />
                ))}
                {/* Proposed guidelines */}
                {proposedChanges.softGuidelines.map((guideline) => (
                  <div key={guideline.id} className={styles.proposedGuideline}>
                    <div className={styles.proposedGuidelineHeader}>
                      <span className={styles.proposedBadge}>+</span>
                      <span className={styles.proposedGuidelineTags}>
                        {guideline.tags.join(', ')}
                      </span>
                    </div>
                    <p className={styles.proposedGuidelineText}>{guideline.text}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.addButton}
                onClick={handleAddGuideline}
                disabled={saving}
              >
                + Add Guideline
              </button>
            </div>
          )}
        </section>

        {/* Working Notes Section */}
        <section className={styles.section}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => setWorkingNotesExpanded(!workingNotesExpanded)}
          >
            <span className={styles.sectionTitle}>Working Notes</span>
            <span className={styles.expandIcon}>{workingNotesExpanded ? '-' : '+'}</span>
          </button>

          {workingNotesExpanded && (
            <div className={styles.sectionContent}>
              <textarea
                className={styles.workingNotes}
                value={context.operational.workingNotes ?? ''}
                onChange={(e) => handleWorkingNotesChange(e.target.value)}
                placeholder="Freeform working notes, fragments, unresolved ideas..."
                disabled={saving}
                rows={6}
              />
            </div>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        {lastSaved && (
          <span className={styles.lastSaved}>
            Last saved: {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
