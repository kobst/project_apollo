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
  } = useGeneration();
  const { savedPackages, loadSavedPackages, savePackage, applySavedPackage, deleteSavedPackage } = useSavedPackages();

  // Fetch data needed for the generation form (beats, characters, story beats)
  const { beats, characters, storyBeats, refresh: refreshGenerationData } = useGenerationData(currentStoryId);

  // Form state preserved during collapse
  const [formState, setFormState] = useState<ComposeFormState>(createDefaultFormState);
  const [aiAssisted, setAiAssisted] = useState(false);
  const { runInterpreter: runAgentInterpreter } = useAgentJobs(currentStoryId, {
    onJobDone: () => { if (currentStoryId) void loadSession(currentStoryId); },
  });
  const [critic, setCritic] = useState(null as null | { errorCount: number; warningCount: number; hasBlockingErrors: boolean; violations: Array<{ id: string; ruleId: string; severity: 'hard'|'soft'; message: string }> });
  const [criticLoading, setCriticLoading] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('Tighten pacing and sharpen conflict');
  const [overlayDiff, setOverlayDiff] = useState<import('../../api/types').OverlayDiffData | null>(null);
  const [acceptInfo, setAcceptInfo] = useState<null | { newVersionId: string; patchOpsApplied?: number }>(null);

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

  // Handle staging a package by index (from carousel)
  const handleStagePackage = useCallback(
    (index: number) => {
      stagePackage(index);
    },
    [stagePackage]
  );

  // Handle staging by package id (for lineage/breadcrumbs)
  const handleStageById = useCallback((packageId: string) => {
    const idx = session?.packages.findIndex(p => p.id === packageId) ?? -1;
    if (idx >= 0) {
      selectPackage(packageId);
      stagePackage(idx);
    }
  }, [session?.packages, selectPackage, stagePackage]);

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

        {/* Package Carousel */}
        {hasPackages && !viewingSavedPackage && (
          <PackageCarousel
            packages={session.packages}
            activeIndex={staging.activePackageIndex}
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
            {/* Accept banner with compact diff */}
            {overlayDiff && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#11221a', border: '1px solid #1d3a2a', padding: '8px 10px', borderRadius: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}>
                  Nodes +{overlayDiff.nodes.created.length} ~{overlayDiff.nodes.modified.length} -{overlayDiff.nodes.deleted.length}
                  {'  '}Edges +{overlayDiff.edges.created.length} -{overlayDiff.edges.deleted.length}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleAcceptPackage} disabled={loading}>
                    {loading ? 'Accepting...' : 'Accept'}
                  </button>
                  <button type="button" onClick={handleRejectPackage} disabled={loading}>
                    Reject
                  </button>
                  <button type="button" onClick={handleSavePackage} disabled={loading}>
                    Save
                  </button>
                </div>
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

            {/* Impact (only if non-empty) */}
            {staging.stagedPackage.impact && (() => {
              const imp = staging.stagedPackage!.impact;
              const hasAny = (imp.fulfills_gaps?.length || 0) + (imp.creates_gaps?.length || 0) + (imp.conflicts?.length || 0) > 0;
              return hasAny ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Impact</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Fulfills</div>
                      <ul>{(imp.fulfills_gaps || []).map((g: string) => (<li key={g}><code>{g}</code></li>))}</ul>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Creates</div>
                      <ul>{(imp.creates_gaps || []).map((g: string) => (<li key={g}><code>{g}</code></li>))}</ul>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Conflicts</div>
                      <ul>{(imp.conflicts || []).map((c: any, i: number) => (<li key={i}>{c.type}: {c.description}</li>))}</ul>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Critic results */}
            {critic && (
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Critic</div>
                <div>Errors: {critic.errorCount} · Warnings: {critic.warningCount}</div>
                <ul>
                  {critic.violations.map(v => (
                    <li key={v.id} style={{ color: v.severity === 'hard' ? '#b00020' : '#c38700' }}>
                      [{v.severity}] {v.ruleId}: {v.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Lineage breadcrumbs for current staged package */}
        {staging.stagedPackage && session && !viewingSavedPackage && (
          (() => {
            const current = staging.stagedPackage!;
            const parent = current.parent_package_id ? session.packages.find(p => p.id === current.parent_package_id) : null;
            const siblings = parent ? session.packages.filter(p => p.parent_package_id === parent.id) : [];
            const children = session.packages.filter(p => p.parent_package_id === current.id);
            if (!parent && children.length === 0) return null;
            return (
              <div style={{ marginTop: 8, fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {parent && (
                  <div>
                    <span style={{ opacity: 0.7 }}>Parent:</span>{' '}
                    <button type="button" style={{ textDecoration: 'underline' }} onClick={() => handleStageById(parent.id)}>
                      {parent.title || parent.id.slice(0, 8)}
                    </button>
                  </div>
                )}
                {siblings.length > 0 && (
                  <div>
                    <span style={{ opacity: 0.7 }}>Siblings:</span>{' '}
                    {siblings.map((s, i) => (
                      <span key={s.id}>
                        <button type="button" style={{ textDecoration: 'underline', marginRight: 6 }} onClick={() => handleStageById(s.id)}>
                          {s.title || s.id.slice(0, 8)}
                        </button>
                        {i < siblings.length - 1 ? <span style={{ opacity: 0.5 }}>|</span> : null}
                      </span>
                    ))}
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <span style={{ opacity: 0.7 }}>Children:</span>{' '}
                    {children.map((c, i) => (
                      <span key={c.id}>
                        <button type="button" style={{ textDecoration: 'underline', marginRight: 6 }} onClick={() => handleStageById(c.id)}>
                          {c.title || c.id.slice(0, 8)}
                        </button>
                        {i < children.length - 1 ? <span style={{ opacity: 0.5 }}>|</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
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
