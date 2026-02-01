/**
 * GenerationPanel - Collapsible right panel for AI generation within workspace.
 * Contains ComposeForm for new proposals and displays active session packages.
 */

import { useCallback, useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { useSavedPackages } from '../../context/SavedPackagesContext';
import { useGenerationData } from '../../hooks/useGenerationData';
import { ComposeForm, createDefaultFormState, type ComposeFormState } from '../generation/ComposeForm';
import { SavedPackagesPanel } from '../generation/SavedPackagesPanel';
import { PackageCarousel } from './PackageCarousel';
import type {
  SavedPackageData,
  ProposeStoryBeatsRequest,
  ProposeCharactersRequest,
  ProposeScenesRequest,
  ProposeExpandRequest,
} from '../../api/types';
import styles from './GenerationPanel.module.css';
import { useGapsCoverage } from '../../hooks/useGapsCoverage';
import { GapIndicators } from './GapIndicators';
import { CoverageSummary } from './CoverageSummary';
import type { GapData } from '../../api/types';

interface SelectedNodeInfo {
  id: string;
  type: string;
  name: string;
}

interface GenerationPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Currently selected node for Expand mode */
  selectedNode?: SelectedNodeInfo | null;
  /** Callback to clear selected node */
  onClearSelectedNode?: () => void;
  /** Callback to enable/disable node selection mode */
  onNodeSelectionModeChange?: (enabled: boolean) => void;
}

export function GenerationPanel({
  isCollapsed,
  onToggleCollapse,
  selectedNode,
  onClearSelectedNode: _onClearSelectedNode, // Reserved for future use
  onNodeSelectionModeChange,
}: GenerationPanelProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const {
    proposeStoryBeats,
    proposeCharacters,
    proposeScenes,
    proposeExpand,
    refinePackage,
    session,
    loading,
    error,
    orchestrationInfo,
    stagePackage,
    stageSavedPackage,
    staging,
    acceptPackage,
    rejectPackage,
    clearStaging,
    selectPackage,
    selectedPackageId,
  } = useGeneration();
  const { savedPackages, loadSavedPackages, savePackage, applySavedPackage, deleteSavedPackage } = useSavedPackages();

  // Fetch data needed for the generation form (beats, characters, story beats)
  const { beats, characters, storyBeats, refresh: refreshGenerationData } = useGenerationData(currentStoryId);

  // Form state preserved during collapse
  const [formState, setFormState] = useState<ComposeFormState>(createDefaultFormState);
  const [critic, setCritic] = useState(null as null | { errorCount: number; warningCount: number; hasBlockingErrors: boolean; violations: Array<{ id: string; ruleId: string; severity: 'hard'|'soft'; message: string }> });
  const [criticLoading, setCriticLoading] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [overlayDiff, setOverlayDiff] = useState<import('../../api/types').OverlayDiffData | null>(null);
  const [acceptInfo, setAcceptInfo] = useState<null | { newVersionId: string; patchOpsApplied?: number }>(null);

  // Collapsible sections
  const [impactExpanded, setImpactExpanded] = useState(false);
  const [criticExpanded, setCriticExpanded] = useState(false);

  // Local state for viewing saved package (similar to GenerationView)
  const [viewingSavedPackageId, setViewingSavedPackageId] = useState<string | null>(null);

  // Load saved packages when story changes
  useEffect(() => {
    if (currentStoryId) {
      loadSavedPackages(currentStoryId);
    }
  }, [currentStoryId, loadSavedPackages]);

  // Context header data
  const { coverage, gaps } = useGapsCoverage(currentStoryId);

  // CTA: Generate for a selected gap
  const handleGenerateGap = useCallback(async (gap: GapData) => {
    if (!currentStoryId) return;
    // Keep it simple: route to storyBeats with direction hint from gap
    const direction = `Fill gap: ${gap.title}`;
    await proposeStoryBeats(currentStoryId, {
      focus: 'all',
      direction,
      packageCount: 3,
    });
    refreshStatus();
    refreshGenerationData();
  }, [currentStoryId, proposeStoryBeats, refreshStatus, refreshGenerationData]);

  // Mode-specific generation handlers
  const handleGenerateStoryBeats = useCallback(
    async (request: ProposeStoryBeatsRequest) => {
      if (!currentStoryId) return;
      await proposeStoryBeats(currentStoryId, request);
      refreshStatus();
      refreshGenerationData();
    },
    [currentStoryId, proposeStoryBeats, refreshStatus, refreshGenerationData]
  );

  const handleGenerateCharacters = useCallback(
    async (request: ProposeCharactersRequest) => {
      if (!currentStoryId) return;
      await proposeCharacters(currentStoryId, request);
      refreshStatus();
      refreshGenerationData();
    },
    [currentStoryId, proposeCharacters, refreshStatus, refreshGenerationData]
  );

  const handleGenerateScenes = useCallback(
    async (request: ProposeScenesRequest) => {
      if (!currentStoryId) return;
      await proposeScenes(currentStoryId, request);
      refreshStatus();
      refreshGenerationData();
    },
    [currentStoryId, proposeScenes, refreshStatus, refreshGenerationData]
  );

  const handleGenerateExpand = useCallback(
    async (request: ProposeExpandRequest) => {
      if (!currentStoryId) return;
      await proposeExpand(currentStoryId, request);
      refreshStatus();
      refreshGenerationData();
    },
    [currentStoryId, proposeExpand, refreshStatus, refreshGenerationData]
  );

  // Handle saved package view - stages it for workspace preview
  const handleViewSavedPackage = useCallback(
    (pkg: SavedPackageData) => {
      setViewingSavedPackageId(pkg.id);
      stageSavedPackage(pkg.package); // Stage for workspace preview
    },
    [stageSavedPackage]
  );

  // Handle closing saved package view (back to list)
  const handleCloseSavedPackageView = useCallback(() => {
    setViewingSavedPackageId(null);
    clearStaging();
  }, [clearStaging]);

  // Handle saved package apply
  const handleApplySavedPackage = useCallback(
    async (savedPackageId: string) => {
      if (!currentStoryId) return;
      await applySavedPackage(currentStoryId, savedPackageId);
      refreshStatus();
    },
    [currentStoryId, applySavedPackage, refreshStatus]
  );

  // Handle saved package delete (discard)
  const handleDeleteSavedPackage = useCallback(
    async (savedPackageId: string) => {
      if (!currentStoryId) return;
      await deleteSavedPackage(currentStoryId, savedPackageId);
      if (viewingSavedPackageId === savedPackageId) {
        setViewingSavedPackageId(null);
        clearStaging();
      }
    },
    [currentStoryId, deleteSavedPackage, viewingSavedPackageId, clearStaging]
  );

  // Handle staging a package by ID (from carousel)
  const handleStagePackage = useCallback(
    (packageId: string) => {
      const idx = session?.packages.findIndex(p => p.id === packageId) ?? -1;
      if (idx >= 0) {
        selectPackage(packageId);
        stagePackage(idx);
      }
    },
    [session?.packages, selectPackage, stagePackage]
  );

  // Handle saving the currently staged package
  const handleSavePackage = useCallback(async () => {
    if (!currentStoryId || !staging.stagedPackage) return;
    await savePackage(currentStoryId, staging.stagedPackage.id);
  }, [currentStoryId, staging.stagedPackage, savePackage]);

  // Handle accepting the currently staged package
  const handleAcceptPackage = useCallback(async () => {
    if (!currentStoryId || !staging.stagedPackage) return;
    const resp = await acceptPackage(currentStoryId, staging.stagedPackage.id);
    if (resp && 'newVersionId' in resp) {
      setAcceptInfo({ newVersionId: resp.newVersionId, patchOpsApplied: (resp as any).patchOpsApplied });
    }
    refreshStatus();
  }, [currentStoryId, staging.stagedPackage, acceptPackage, refreshStatus]);

  // Handle rejecting the currently staged package
  const handleRejectPackage = useCallback(() => {
    if (!staging.stagedPackage) return;
    rejectPackage(staging.stagedPackage.id);
    clearStaging();
  }, [staging.stagedPackage, rejectPackage, clearStaging]);

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Expand generation panel"
          title="Open AI Generation"
        >
          <span className={styles.expandIcon}>+</span>
          <span className={styles.expandLabel}>AI</span>
        </button>
        {session && session.packages.length > 0 && (
          <div className={styles.collapsedBadge}>{session.packages.length}</div>
        )}
      </div>
    );
  }

  const hasPackages = session && session.packages.length > 0;

  // Get the currently viewing saved package data
  const viewingSavedPackage = viewingSavedPackageId
    ? savedPackages.find(p => p.id === viewingSavedPackageId)
    : null;

  // Fetch overlay diff when staged package changes
  useEffect(() => {
    const fetchDiff = async () => {
      if (!currentStoryId || !staging.stagedPackage) { setOverlayDiff(null); return; }
      try {
        const diff = await api.getOverlayDiff(currentStoryId, staging.stagedPackage.id);
        setOverlayDiff(diff);
      } catch {
        setOverlayDiff(null);
      }
    };
    void fetchDiff();
  }, [currentStoryId, staging.stagedPackage?.id]);

  // Compute impact summary for collapsed header
  const impactSummary = staging.stagedPackage?.impact ? (() => {
    const imp = staging.stagedPackage!.impact;
    const f = imp.fulfills_gaps?.length || 0;
    const c = imp.creates_gaps?.length || 0;
    const x = imp.conflicts?.length || 0;
    return { fulfills: f, creates: c, conflicts: x, hasAny: f + c + x > 0 };
  })() : null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>AI Generation</h3>
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          type="button"
          aria-label="Collapse panel"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Context Section - Always visible */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Coverage</div>
            <CoverageSummary coverage={coverage} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Gaps</div>
            <GapIndicators gaps={gaps} onGenerateGap={handleGenerateGap} />
          </div>
        </div>

        {/* Orchestration Info - Minimal */}
        {orchestrationInfo && (
          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12 }}>Why this? (orchestration)</summary>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <div><strong>Mode:</strong> {orchestrationInfo.resolvedIntent.mode}</div>
              {'direction' in orchestrationInfo.resolvedIntent && orchestrationInfo.resolvedIntent.direction && (
                <div><strong>Direction:</strong> {orchestrationInfo.resolvedIntent.direction}</div>
              )}
              <div><strong>Confidence:</strong> {Math.round((orchestrationInfo.resolvedIntent.confidence ?? 0) * 100)}%</div>
              {orchestrationInfo.resolvedIntent.reasoning && (
                <div style={{ opacity: 0.8 }}><strong>Reasoning:</strong> {orchestrationInfo.resolvedIntent.reasoning}</div>
              )}
            </div>
          </details>
        )}
        {/* Smart mode toggle removed; unified orchestration always used */}

          {/* Agent quick UI removed per design; Interpreter runs behind Direction when AI-assisted is enabled */}
        {/* Error display */}
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        {/* Compose Form */}
        <ComposeForm
          onGenerateStoryBeats={handleGenerateStoryBeats}
          onGenerateCharacters={handleGenerateCharacters}
          onGenerateScenes={handleGenerateScenes}
          onGenerateExpand={handleGenerateExpand}
          loading={loading}
          formState={formState}
          onFormStateChange={setFormState}
          beats={beats}
          characters={characters}
          storyBeats={storyBeats}
          selectedNode={selectedNode ?? undefined}
          onNodeSelectionModeChange={onNodeSelectionModeChange}
        />

        {/* Package Carousel (ID-based, two-tier) */}
        {hasPackages && !viewingSavedPackage && (
          <PackageCarousel
            packages={session.packages}
            activePackageId={selectedPackageId}
            onSelectPackage={handleStagePackage}
            onAcceptPackage={handleAcceptPackage}
            onRejectPackage={handleRejectPackage}
            onSavePackage={handleSavePackage}
            loading={loading}
            hideActions={!!staging.stagedPackage}
          />
        )}

        {/* Review section for selected package */}
        {staging.stagedPackage && !viewingSavedPackage && (
          <div className={styles.reviewSection}>

            {/* 1. Impact — first thing users evaluate */}
            {impactSummary && impactSummary.hasAny && (
              <div className={styles.impactCard}>
                <button
                  type="button"
                  className={styles.impactHeader}
                  onClick={() => setImpactExpanded(prev => !prev)}
                >
                  <span className={`${styles.impactChevron} ${impactExpanded ? styles.impactChevronOpen : ''}`}>{'\u25B8'}</span>
                  <span className={styles.impactLabel}>Impact</span>
                  <span className={styles.impactBadges}>
                    {impactSummary.fulfills > 0 && (
                      <span className={`${styles.impactBadge} ${styles.impactBadgeFulfills}`}>
                        {impactSummary.fulfills} fulfilled
                      </span>
                    )}
                    {impactSummary.creates > 0 && (
                      <span className={`${styles.impactBadge} ${styles.impactBadgeCreates}`}>
                        {impactSummary.creates} created
                      </span>
                    )}
                    {impactSummary.conflicts > 0 && (
                      <span className={`${styles.impactBadge} ${styles.impactBadgeConflicts}`}>
                        {impactSummary.conflicts} conflicts
                      </span>
                    )}
                  </span>
                </button>
                {impactExpanded && (() => {
                  const imp = staging.stagedPackage!.impact;
                  const cols = [
                    imp.fulfills_gaps?.length ? { label: 'Fulfills', labelClass: styles.impactColumnLabelFulfills, items: imp.fulfills_gaps } : null,
                    imp.creates_gaps?.length ? { label: 'Creates', labelClass: styles.impactColumnLabelCreates, items: imp.creates_gaps } : null,
                    imp.conflicts?.length ? { label: 'Conflicts', labelClass: styles.impactColumnLabelConflicts, items: imp.conflicts } : null,
                  ].filter(Boolean) as Array<{ label: string; labelClass: string; items: any[] }>;
                  return (
                    <div className={styles.impactDetails} style={{ gridTemplateColumns: cols.map(() => '1fr').join(' ') }}>
                      {cols.map(col => (
                        <div key={col.label} className={styles.impactColumn}>
                          <div className={`${styles.impactColumnLabel} ${col.labelClass}`}>{col.label}</div>
                          <ul className={styles.impactList}>
                            {col.items.map((item: any, i: number) => (
                              <li key={i}>{typeof item === 'string' ? <code>{item}</code> : `${item.type}: ${item.description}`}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 2. Review & Refine — combined card */}
            <div className={styles.reviewRefineCard}>
              <div className={styles.reviewRefineHeader}>Review & Refine</div>

              {/* Critic row: button + inline summary */}
              <div className={styles.criticRow}>
                <button
                  type="button"
                  className={styles.criticButton}
                  disabled={criticLoading}
                  onClick={async () => {
                    if (!currentStoryId) return;
                    setCriticLoading(true);
                    try {
                      const res = await api.lintStaged(currentStoryId, staging.stagedPackage!.id);
                      setCritic({
                        errorCount: res.summary.errorCount,
                        warningCount: res.summary.warningCount,
                        hasBlockingErrors: res.summary.hasBlockingErrors,
                        violations: res.violations.map((v: any) => ({ id: v.id, ruleId: v.ruleId, severity: v.severity, message: v.message })),
                      });
                    } catch (e) {
                      setCritic(null);
                    } finally {
                      setCriticLoading(false);
                    }
                  }}
                >{criticLoading ? 'Running\u2026' : critic ? 'Re-run Critic' : 'Run Critic'}</button>
                {critic && (
                  <span className={styles.criticInlineSummary}>
                    <span className={critic.errorCount > 0 ? styles.criticCountError : styles.criticCountZero}>
                      {critic.errorCount} {critic.errorCount === 1 ? 'error' : 'errors'}
                    </span>
                    <span className={styles.criticCountSep}>{' · '}</span>
                    <span className={critic.warningCount > 0 ? styles.criticCountWarning : styles.criticCountZero}>
                      {critic.warningCount} {critic.warningCount === 1 ? 'warning' : 'warnings'}
                    </span>
                  </span>
                )}
              </div>

              {/* Critic violations — scrollable */}
              {critic && critic.violations.length > 0 && (
                <div className={styles.criticResultsScrollable}>
                  <button
                    type="button"
                    className={styles.criticSummary}
                    onClick={() => setCriticExpanded(prev => !prev)}
                  >
                    <span className={`${styles.impactChevron} ${criticExpanded ? styles.impactChevronOpen : ''}`}>{'\u25B8'}</span>
                    <span className={styles.criticSummaryLabel}>
                      {critic.errorCount > 0 ? 'Errors' : ''}{critic.errorCount > 0 && critic.warningCount > 0 ? ' & ' : ''}{critic.warningCount > 0 ? `Warnings (${critic.warningCount})` : ''}
                    </span>
                  </button>
                  {criticExpanded && (
                    <ul className={styles.criticViolations}>
                      {critic.violations.map(v => (
                        <li key={v.id} className={v.severity === 'hard' ? styles.criticViolationHard : styles.criticViolationSoft}>
                          {v.ruleId}: {v.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Refine input — same card, below critic */}
              <div className={styles.refineSeparator} />
              <div className={styles.refineInputGroup}>
                <input
                  className={styles.refineInput}
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  placeholder="e.g. Fix missing locations"
                />
                <button
                  type="button"
                  className={styles.refineButton}
                  disabled={loading}
                  onClick={async () => {
                    if (!currentStoryId || !staging.stagedPackage) return;
                    await refinePackage(currentStoryId, staging.stagedPackage.id, refinePrompt, 0.5);
                  }}
                >Refine</button>
              </div>
            </div>

            {/* 4. Metadata footer — demoted */}
            {overlayDiff && (
              <div className={styles.metadataFooter}>
                Nodes +{overlayDiff.nodes.created.length} ~{overlayDiff.nodes.modified.length} -{overlayDiff.nodes.deleted.length}
                {' · '}Edges +{overlayDiff.edges.created.length} -{overlayDiff.edges.deleted.length}
              </div>
            )}

            {/* 5. Decision buttons — last */}
            <div className={styles.reviewActions}>
              <button
                className={styles.reviewAcceptButton}
                onClick={handleAcceptPackage}
                disabled={loading}
                type="button"
              >
                {loading ? 'Accepting\u2026' : 'Accept'}
              </button>
              <button
                className={styles.reviewRejectButton}
                onClick={handleRejectPackage}
                disabled={loading}
                type="button"
              >
                Reject
              </button>
              <button
                className={styles.reviewSaveButton}
                onClick={handleSavePackage}
                disabled={loading}
                type="button"
              >
                Save for Later
              </button>
            </div>
          </div>
        )}

        {/* Staged Saved Package */}
        {viewingSavedPackage && (
          <div className={styles.stagedSavedPackage}>
            <div className={styles.stagedSavedHeader}>
              <span className={styles.stagedSavedBadge}>SAVED PACKAGE</span>
            </div>
            <div className={styles.stagedSavedInfo}>
              <div className={styles.stagedSavedTitle}>
                {viewingSavedPackage.package.title}
              </div>
              <div className={styles.stagedSavedMeta}>
                <span className={styles.stagedSavedConfidence}>
                  {Math.round(viewingSavedPackage.package.confidence * 100)}%
                </span>
                <span className={styles.stagedSavedDate}>
                  Saved {new Date(viewingSavedPackage.savedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className={styles.stagedSavedActions}>
              <button
                className={styles.applyButton}
                onClick={() => handleApplySavedPackage(viewingSavedPackage.id)}
                disabled={loading}
                type="button"
              >
                {loading ? 'Applying...' : 'Apply to Story'}
              </button>
              <button
                className={styles.discardButton}
                onClick={() => handleDeleteSavedPackage(viewingSavedPackage.id)}
                disabled={loading}
                type="button"
              >
                Discard
              </button>
              <button
                className={styles.backButton}
                onClick={handleCloseSavedPackageView}
                disabled={loading}
                type="button"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Saved Packages */}
        <SavedPackagesPanel
          packages={savedPackages}
          onApply={handleApplySavedPackage}
          onDelete={handleDeleteSavedPackage}
          onView={handleViewSavedPackage}
          viewingPackageId={viewingSavedPackageId}
        />
      </div>
      {/* Accept info banner */}
      {acceptInfo && (
        <div style={{ margin: '8px 12px', background: '#0f5132', color: '#d1e7dd', border: '1px solid #0f5132', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}>
          Accepted package. New version: <code>{acceptInfo.newVersionId}</code>
        </div>
      )}
    </div>
  );
}
