/**
 * AddElementModal - Modal for adding new story elements via the propose API.
 * Supports quick-add (direct creation) and AI-assisted generation (multiple options).
 */

import { useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type {
  NarrativePackage,
  NodeChangeAI,
  ProposeRequest,
} from '../../api/types';
import styles from './AddElementModal.module.css';

export type AddElementType = 'Character' | 'Location' | 'Object' | 'Scene' | 'StoryBeat';

interface AddElementModalProps {
  elementType: AddElementType;
  onClose: () => void;
  onSuccess?: () => void;
  /** Pre-filled context (e.g., beat ID when adding scene from a beat) */
  context?: {
    beatId?: string;
    beatName?: string;
  };
}

// Form values for different element types
interface FormValues {
  name: string;
  description: string;
  // Character-specific
  role?: string;
  arc?: string;
  // Location-specific
  locationType?: string;
  significance?: string;
  // Scene-specific
  heading?: string;
  summary?: string;
  beatId?: string;
  // StoryBeat-specific
  intent?: string;
}

type ModalPhase = 'input' | 'review' | 'refining' | 'submitting';

const ELEMENT_CONFIG: Record<AddElementType, { icon: string; label: string; nodeType: string }> = {
  Character: { icon: '👤', label: 'Character', nodeType: 'Character' },
  Location: { icon: '📍', label: 'Location', nodeType: 'Location' },
  Object: { icon: '📦', label: 'Object', nodeType: 'Object' },
  Scene: { icon: '🎬', label: 'Scene', nodeType: 'Scene' },
  StoryBeat: { icon: '📍', label: 'Story Beat', nodeType: 'StoryBeat' },
};

const ROLE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'antagonist', label: 'Antagonist' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'minor', label: 'Minor' },
];

const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'interior', label: 'Interior' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'both', label: 'Both' },
];

const INTENT_OPTIONS = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'theme', label: 'Theme' },
  { value: 'tone', label: 'Tone' },
];

export function AddElementModal({
  elementType,
  onClose,
  onSuccess,
  context,
}: AddElementModalProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const config = ELEMENT_CONFIG[elementType];

  // Phase state
  const [phase, setPhase] = useState<ModalPhase>('input');

  // Form values
  const [formValues, setFormValues] = useState<FormValues>({
    name: '',
    description: '',
    role: '',
    arc: '',
    locationType: '',
    significance: '',
    heading: '',
    summary: '',
    beatId: context?.beatId || '',
    intent: 'plot',
  });

  // Review state
  const [packages, setPackages] = useState<NarrativePackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');

  // Refinement state
  const [refinementText, setRefinementText] = useState('');
  const [showRefinement, setShowRefinement] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form validation
  const isFormValid = useCallback(() => {
    if (elementType === 'Scene') {
      return formValues.heading?.trim();
    }
    if (elementType === 'StoryBeat') {
      return formValues.summary?.trim();
    }
    return formValues.name.trim();
  }, [elementType, formValues]);

  // Build propose request
  const buildProposeRequest = useCallback(
    (mode: 'add' | 'expand'): ProposeRequest => {
      const structured: Record<string, unknown> = {};

      if (elementType === 'Character') {
        if (formValues.name) structured.name = formValues.name;
        if (formValues.role) structured.archetype = formValues.role;
        if (formValues.arc) structured.arc = formValues.arc;
      } else if (elementType === 'Location') {
        if (formValues.name) structured.name = formValues.name;
        if (formValues.locationType) structured.type = formValues.locationType;
        if (formValues.significance) structured.significance = formValues.significance;
      } else if (elementType === 'Object') {
        if (formValues.name) structured.name = formValues.name;
        if (formValues.significance) structured.significance = formValues.significance;
      } else if (elementType === 'Scene') {
        if (formValues.heading) structured.heading = formValues.heading;
        if (formValues.summary) structured.scene_overview = formValues.summary;
      } else if (elementType === 'StoryBeat') {
        if (formValues.summary) structured.title = formValues.summary;
        if (formValues.intent) structured.intent = formValues.intent;
      }

      const request: ProposeRequest = {
        intent: 'add',
        scope: {
          entryPoint: 'freeText',
          targetType: config.nodeType,
        },
        mode,
        options: {
          packageCount: mode === 'add' ? 1 : 3,
        },
      };

      // Only add input if we have data
      if (formValues.description || Object.keys(structured).length > 0) {
        request.input = {};
        if (formValues.description) {
          request.input.text = formValues.description;
        }
        if (Object.keys(structured).length > 0) {
          request.input.structured = structured;
        }
      }

      return request;
    },
    [elementType, formValues, config.nodeType]
  );

  // Quick add handler
  const handleQuickAdd = async () => {
    if (!currentStoryId || !isFormValid()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const request = buildProposeRequest('add');
      const response = await api.propose(currentStoryId, request);

      const firstPackage = response.packages?.[0];
      if (firstPackage) {
        // Commit the single package
        await api.commitProposal(currentStoryId, firstPackage.id);
        void refreshStatus();
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error('Failed to add element:', err);
      setError(err instanceof Error ? err.message : 'Failed to add element');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate options handler
  const handleGenerateOptions = async () => {
    if (!currentStoryId) return;

    setIsGenerating(true);
    setError(null);

    try {
      const request = buildProposeRequest('expand');
      const response = await api.propose(currentStoryId, request);

      const pkgs = response.packages;
      const firstPackage = pkgs?.[0];
      if (pkgs && firstPackage) {
        setPackages(pkgs);
        setSelectedPackageId(firstPackage.id);
        setPhase('review');
      }
    } catch (err) {
      console.error('Failed to generate options:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate options');
    } finally {
      setIsGenerating(false);
    }
  };

  // Commit selected package
  const handleCommit = async () => {
    if (!currentStoryId || !selectedPackageId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.commitProposal(currentStoryId, selectedPackageId);
      void refreshStatus();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to commit package:', err);
      setError(err instanceof Error ? err.message : 'Failed to add element');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refine handler
  const handleRefine = async () => {
    if (!currentStoryId || !selectedPackageId || !refinementText.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.refineProposal(currentStoryId, {
        packageId: selectedPackageId,
        guidance: refinementText,
      });

      const pkgs = response.packages;
      const firstPackage = pkgs?.[0];
      if (pkgs && firstPackage) {
        setPackages(pkgs);
        setSelectedPackageId(firstPackage.id);
        setRefinementText('');
        setShowRefinement(false);
      }
    } catch (err) {
      console.error('Failed to refine:', err);
      setError(err instanceof Error ? err.message : 'Failed to refine options');
    } finally {
      setIsGenerating(false);
    }
  };

  // Get primary node from selected package
  const getSelectedPackageNode = (): NodeChangeAI | null => {
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (!pkg) return null;
    // Find the first node that matches our target type
    return pkg.changes.nodes.find((n) => n.node_type === config.nodeType) || pkg.changes.nodes[0] || null;
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showRefinement) {
        setShowRefinement(false);
      } else if (phase === 'review') {
        setPhase('input');
      } else {
        onClose();
      }
    }
    if (e.key === 'Enter' && e.metaKey) {
      if (phase === 'input' && isFormValid() && !isSubmitting) {
        void handleQuickAdd();
      } else if (phase === 'review' && !isSubmitting) {
        void handleCommit();
      }
    }
  };

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const primaryNode = getSelectedPackageNode();

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          {phase === 'review' && (
            <button
              className={styles.backButton}
              onClick={() => setPhase('input')}
              type="button"
            >
              ← Back
            </button>
          )}
          <h3 className={styles.title}>
            {config.icon} Add {config.label}
          </h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {phase === 'input' && (
            <div className={styles.form}>
              {/* Context hint */}
              {context?.beatName && (
                <div className={styles.contextHint}>
                  Adding to: {context.beatName}
                </div>
              )}

              {/* Name field (most element types) */}
              {elementType !== 'Scene' && elementType !== 'StoryBeat' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-name">
                    Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="el-name"
                    type="text"
                    className={styles.input}
                    value={formValues.name}
                    onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                    placeholder={`Enter ${config.label.toLowerCase()} name...`}
                    disabled={isSubmitting || isGenerating}
                    autoFocus
                  />
                </div>
              )}

              {/* Scene heading */}
              {elementType === 'Scene' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-heading">
                    Heading <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="el-heading"
                    type="text"
                    className={styles.input}
                    value={formValues.heading}
                    onChange={(e) => setFormValues({ ...formValues, heading: e.target.value })}
                    placeholder="e.g., INT. WAREHOUSE - NIGHT"
                    disabled={isSubmitting || isGenerating}
                    autoFocus
                  />
                </div>
              )}

              {/* StoryBeat summary */}
              {elementType === 'StoryBeat' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-summary">
                    Summary <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="el-summary"
                    type="text"
                    className={styles.input}
                    value={formValues.summary}
                    onChange={(e) => setFormValues({ ...formValues, summary: e.target.value })}
                    placeholder="Brief description of the story beat..."
                    disabled={isSubmitting || isGenerating}
                    autoFocus
                  />
                </div>
              )}

              {/* Description field (all types) */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="el-description">
                  Description
                </label>
                <textarea
                  id="el-description"
                  className={styles.textarea}
                  value={formValues.description}
                  onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                  placeholder={`Describe the ${config.label.toLowerCase()}...`}
                  rows={3}
                  disabled={isSubmitting || isGenerating}
                />
              </div>

              {/* Character-specific fields */}
              {elementType === 'Character' && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="el-role">
                        Role
                      </label>
                      <select
                        id="el-role"
                        className={styles.select}
                        value={formValues.role}
                        onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                        disabled={isSubmitting || isGenerating}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="el-arc">
                      Character Arc
                    </label>
                    <input
                      id="el-arc"
                      type="text"
                      className={styles.input}
                      value={formValues.arc}
                      onChange={(e) => setFormValues({ ...formValues, arc: e.target.value })}
                      placeholder="Brief description of their journey..."
                      disabled={isSubmitting || isGenerating}
                    />
                  </div>
                </>
              )}

              {/* Location-specific fields */}
              {elementType === 'Location' && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="el-loctype">
                        Type
                      </label>
                      <select
                        id="el-loctype"
                        className={styles.select}
                        value={formValues.locationType}
                        onChange={(e) => setFormValues({ ...formValues, locationType: e.target.value })}
                        disabled={isSubmitting || isGenerating}
                      >
                        {LOCATION_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="el-sig">
                      Significance
                    </label>
                    <input
                      id="el-sig"
                      type="text"
                      className={styles.input}
                      value={formValues.significance}
                      onChange={(e) => setFormValues({ ...formValues, significance: e.target.value })}
                      placeholder="Why this location matters..."
                      disabled={isSubmitting || isGenerating}
                    />
                  </div>
                </>
              )}

              {/* Object-specific fields */}
              {elementType === 'Object' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-obj-sig">
                    Significance
                  </label>
                  <input
                    id="el-obj-sig"
                    type="text"
                    className={styles.input}
                    value={formValues.significance}
                    onChange={(e) => setFormValues({ ...formValues, significance: e.target.value })}
                    placeholder="e.g., MacGuffin, symbol, weapon..."
                    disabled={isSubmitting || isGenerating}
                  />
                </div>
              )}

              {/* Scene-specific fields */}
              {elementType === 'Scene' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-scene-summary">
                    Scene Summary
                  </label>
                  <textarea
                    id="el-scene-summary"
                    className={styles.textarea}
                    value={formValues.summary}
                    onChange={(e) => setFormValues({ ...formValues, summary: e.target.value })}
                    placeholder="What happens in this scene..."
                    rows={3}
                    disabled={isSubmitting || isGenerating}
                  />
                </div>
              )}

              {/* StoryBeat-specific fields */}
              {elementType === 'StoryBeat' && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="el-intent">
                    Intent
                  </label>
                  <select
                    id="el-intent"
                    className={styles.select}
                    value={formValues.intent}
                    onChange={(e) => setFormValues({ ...formValues, intent: e.target.value })}
                    disabled={isSubmitting || isGenerating}
                  >
                    {INTENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {phase === 'review' && (
            <div className={styles.reviewContent}>
              {/* Package tabs */}
              <div className={styles.packageTabs}>
                {packages.map((pkg, index) => (
                  <button
                    key={pkg.id}
                    className={`${styles.packageTab} ${pkg.id === selectedPackageId ? styles.selected : ''}`}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    type="button"
                    disabled={isGenerating}
                  >
                    Option {index + 1}
                    {pkg.id === selectedPackageId && <span className={styles.tabDot}>●</span>}
                  </button>
                ))}
              </div>

              {/* Selected package details */}
              {selectedPackage && primaryNode && (
                <div className={styles.packageDetails}>
                  <h4 className={styles.packageName}>
                    {(primaryNode.data?.name as string) ||
                      (primaryNode.data?.heading as string) ||
                      (primaryNode.data?.title as string) ||
                      selectedPackage.title}
                  </h4>
                  <p className={styles.packageDescription}>
                    {(primaryNode.data?.description as string) ||
                      (primaryNode.data?.bio as string) ||
                      (primaryNode.data?.scene_overview as string) ||
                      selectedPackage.rationale}
                  </p>

                  {/* Type-specific attributes */}
                  {primaryNode.data && (
                    <div className={styles.packageAttributes}>
                      {typeof primaryNode.data.archetype === 'string' && (
                        <div className={styles.attr}>
                          <span className={styles.attrKey}>Role:</span>
                          <span className={styles.attrValue}>{primaryNode.data.archetype}</span>
                        </div>
                      )}
                      {typeof primaryNode.data.arc === 'string' && (
                        <div className={styles.attr}>
                          <span className={styles.attrKey}>Arc:</span>
                          <span className={styles.attrValue}>{primaryNode.data.arc}</span>
                        </div>
                      )}
                      {typeof primaryNode.data.significance === 'string' && (
                        <div className={styles.attr}>
                          <span className={styles.attrKey}>Significance:</span>
                          <span className={styles.attrValue}>{primaryNode.data.significance}</span>
                        </div>
                      )}
                      {typeof primaryNode.data.intent === 'string' && (
                        <div className={styles.attr}>
                          <span className={styles.attrKey}>Intent:</span>
                          <span className={styles.attrValue}>{primaryNode.data.intent}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional elements in package */}
                  {selectedPackage.changes.nodes.length > 1 && (
                    <div className={styles.additionalElements}>
                      <h5 className={styles.additionalTitle}>Also includes:</h5>
                      <ul className={styles.additionalList}>
                        {selectedPackage.changes.nodes
                          .filter((n) => n.node_id !== primaryNode.node_id)
                          .map((node) => (
                            <li key={node.node_id}>
                              {node.node_type}: {(node.data?.name as string) || (node.data?.heading as string) || node.node_id}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Refinement section */}
              {showRefinement && (
                <div className={styles.refinementSection}>
                  <label className={styles.label}>Refine this option</label>
                  <textarea
                    className={styles.textarea}
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    placeholder="Describe how you want to change this option..."
                    rows={3}
                    disabled={isGenerating}
                    autoFocus
                  />
                  <div className={styles.refinementActions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => {
                        setShowRefinement(false);
                        setRefinementText('');
                      }}
                      type="button"
                      disabled={isGenerating}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.primaryBtn}
                      onClick={() => void handleRefine()}
                      type="button"
                      disabled={isGenerating || !refinementText.trim()}
                    >
                      {isGenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              )}

              {isGenerating && !showRefinement && (
                <div className={styles.loadingOverlay}>
                  <span>Generating options...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {phase === 'input' && (
            <>
              <button
                className={styles.generateBtn}
                onClick={() => void handleGenerateOptions()}
                type="button"
                disabled={isGenerating || isSubmitting}
              >
                {isGenerating ? 'Generating...' : '✨ Generate Options'}
              </button>
              <div className={styles.footerRight}>
                <button
                  className={styles.cancelBtn}
                  onClick={onClose}
                  type="button"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className={styles.addBtn}
                  onClick={() => void handleQuickAdd()}
                  type="button"
                  disabled={!isFormValid() || isSubmitting || isGenerating}
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </>
          )}

          {phase === 'review' && !showRefinement && (
            <>
              <button
                className={styles.refineBtn}
                onClick={() => setShowRefinement(true)}
                type="button"
                disabled={isGenerating || isSubmitting}
              >
                Refine...
              </button>
              <div className={styles.footerRight}>
                <button
                  className={styles.cancelBtn}
                  onClick={onClose}
                  type="button"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className={styles.addBtn}
                  onClick={() => void handleCommit()}
                  type="button"
                  disabled={isSubmitting || isGenerating}
                >
                  {isSubmitting ? 'Adding...' : 'Add This'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
