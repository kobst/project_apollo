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
import { useAgentJobs } from '../../hooks/useAgentJobs';
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
    stagePackage,
    stageSavedPackage,
    staging,
    acceptPackage,
    rejectPackage,
    clearStaging,
    loadSession,
    selectPackage,
    selectedPackageId,
  } = useGeneration();
  const { savedPackages, loadSavedPackages, savePackage, applySavedPackage, deleteSavedPackage } = useSavedPackages();

  // Fetch data needed for the generation form (beats, characters, story beats)
  const { beats, characters, storyBeats, refresh: refreshGenerationData } = useGenerationData(currentStoryId);

  // Form state preserved during collapse
  const [formState, setFormState] = useState<ComposeFormState>(createDefaultFormState);
  const [aiAssisted, setAiAssisted] = useState(false);
  const { runInterpreter: runAgentInterpreter } = useAgentJobs(currentStoryId ?? undefined, {
    onJobDone: () => { if (currentStoryId) void loadSession(currentStoryId); },
  });
  const [critic, setCritic] = useState(null as null | { errorCount: number; warningCount: number; hasBlockingErrors: boolean; violations: Array<{ id: string; ruleId: string; severity: 'hard'|'soft'; message: string }> });
  const [criticLoading, setCriticLoading] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('Tighten pacing and sharpen conflict');
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

  // Mode-specific generation handlers
  const handleGenerateStoryBeats = useCallback(
    async (request: ProposeStoryBeatsRequest) => {
      if (!currentStoryId) return;
      if (aiAssisted && formState.direction.trim()) {
        await runAgentInterpreter(formState.direction.trim());
      } else {
        await proposeStoryBeats(currentStoryId, request);
        refreshStatus();
        refreshGenerationData();
      }
    },
    [currentStoryId, proposeStoryBeats, refreshStatus, refreshGenerationData]
  );

  const handleGenerateCharacters = useCallback(
    async (request: ProposeCharactersRequest) => {
      if (!currentStoryId) return;
      if (aiAssisted && formState.direction.trim()) {
        await runAgentInterpreter(formState.direction.trim());
      } else {
        await proposeCharacters(currentStoryId, request);
        refreshStatus();
        refreshGenerationData();
      }
    },
    [currentStoryId, proposeCharacters, refreshStatus, refreshGenerationData]
  );

  const handleGenerateScenes = useCallback(
    async (request: ProposeScenesRequest) => {
      if (!currentStoryId) return;
      if (aiAssisted && formState.direction.trim()) {
        await runAgentInterpreter(formState.direction.trim());
      } else {
        await proposeScenes(currentStoryId, request);
        refreshStatus();
        refreshGenerationData();
      }
    },
    [currentStoryId, proposeScenes, refreshStatus, refreshGenerationData]
  );

  const handleGenerateExpand = useCallback(
    async (request: ProposeExpandRequest) => {
      if (!currentStoryId) return;
      if (aiAssisted && formState.direction.trim()) {
        await runAgentInterpreter(formState.direction.trim());
      } else {
        await proposeExpand(currentStoryId, request);
        refreshStatus();
        refreshGenerationData();
      }
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
        {/* AI-assisted toggle (Interpreter behind Direction) */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            <input type="checkbox" checked={aiAssisted} onChange={(e) => setAiAssisted(e.target.checked)} />
            {' '}Smart mode — let AI decide how to generate
          </label>
        </div>

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
          />
        )}

        {/* Review section for selected package */}
        {staging.stagedPackage && !viewingSavedPackage && (
          <div style={{ marginTop: 12 }}>
            {/* Compact diff summary (no duplicate action buttons) */}
            {overlayDiff && (
              <div style={{ fontSize: 12, background: '#11221a', border: '1px solid #1d3a2a', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                Nodes +{overlayDiff.nodes.created.length} ~{overlayDiff.nodes.modified.length} -{overlayDiff.nodes.deleted.length}
                {'  '}Edges +{overlayDiff.edges.created.length} -{overlayDiff.edges.deleted.length}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button
                type="button"
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
              >{criticLoading ? 'Running Critic...' : 'Run Critic'}</button>
              <input
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                placeholder="Refine prompt"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={async () => {
                  if (!currentStoryId || !staging.stagedPackage) return;
                  await refinePackage(currentStoryId, staging.stagedPackage.id, refinePrompt, 0.5);
                }}
              >Refine</button>
            </div>

            {/* Impact (collapsible, collapsed by default) */}
            {impactSummary && impactSummary.hasAny && (
              <div style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setImpactExpanded(prev => !prev)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>{impactExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span>Impact</span>
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>
                    Fulfills: {impactSummary.fulfills} · Creates: {impactSummary.creates} · Conflicts: {impactSummary.conflicts}
                  </span>
                </button>
                {impactExpanded && (() => {
                  const imp = staging.stagedPackage!.impact;
                  const cols = [
                    imp.fulfills_gaps?.length ? { label: 'Fulfills', items: imp.fulfills_gaps } : null,
                    imp.creates_gaps?.length ? { label: 'Creates', items: imp.creates_gaps } : null,
                    imp.conflicts?.length ? { label: 'Conflicts', items: imp.conflicts } : null,
                  ].filter(Boolean) as Array<{ label: string; items: any[] }>;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), gap: 12, fontSize: 12, marginTop: 6 }}>
                      {cols.map(col => (
                        <div key={col.label}>
                          <div style={{ fontWeight: 600 }}>{col.label}</div>
                          <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
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

            {/* Critic results (collapsible, collapsed by default) */}
            {critic && (
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setCriticExpanded(prev => !prev)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>{criticExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span>Critic</span>
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>
                    Errors: {critic.errorCount} · Warnings: {critic.warningCount}
                  </span>
                </button>
                {criticExpanded && (
                  <ul style={{ marginTop: 4 }}>
                    {critic.violations.map(v => (
                      <li key={v.id} style={{ color: v.severity === 'hard' ? '#b00020' : '#c38700' }}>
                        [{v.severity}] {v.ruleId}: {v.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
