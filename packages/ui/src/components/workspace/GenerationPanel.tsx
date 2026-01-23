/**
 * GenerationPanel - Collapsible right panel for AI generation within workspace.
 * Contains ComposeForm for new proposals and displays active session packages.
 */

import { useCallback, useState, useEffect } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { useSavedPackages } from '../../context/SavedPackagesContext';
import { ComposeForm, type ComposeFormState } from '../generation/ComposeForm';
import { SavedPackagesPanel } from '../generation/SavedPackagesPanel';
import { PackageCarousel } from './PackageCarousel';
import type { ProposeRequest, SavedPackageData } from '../../api/types';
import styles from './GenerationPanel.module.css';

interface GenerationPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Default form state
const DEFAULT_FORM_STATE: ComposeFormState = {
  mode: 'add',
  selectedEntryIndex: 0,
  direction: '',
  showAdvanced: false,
  customCreativity: null,
  customPackageCount: null,
  customNodesPerPackage: null,
};

export function GenerationPanel({ isCollapsed, onToggleCollapse }: GenerationPanelProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { propose, session, loading, error, stagePackage, stageSavedPackage, staging, acceptPackage, rejectPackage, clearStaging } = useGeneration();
  const { savedPackages, loadSavedPackages, savePackage, applySavedPackage, deleteSavedPackage } = useSavedPackages();

  // Form state preserved during collapse
  const [formState, setFormState] = useState<ComposeFormState>(DEFAULT_FORM_STATE);

  // Local state for viewing saved package (similar to GenerationView)
  const [viewingSavedPackageId, setViewingSavedPackageId] = useState<string | null>(null);

  // Load saved packages when story changes
  useEffect(() => {
    if (currentStoryId) {
      loadSavedPackages(currentStoryId);
    }
  }, [currentStoryId, loadSavedPackages]);

  // Handle generate
  const handleGenerate = useCallback(
    async (request: ProposeRequest) => {
      if (!currentStoryId) return;
      await propose(currentStoryId, request);
      refreshStatus();
    },
    [currentStoryId, propose, refreshStatus]
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

  // Handle saving the currently staged package
  const handleSavePackage = useCallback(async () => {
    if (!currentStoryId || !staging.stagedPackage) return;
    await savePackage(currentStoryId, staging.stagedPackage.id);
  }, [currentStoryId, staging.stagedPackage, savePackage]);

  // Handle accepting the currently staged package
  const handleAcceptPackage = useCallback(async () => {
    if (!currentStoryId || !staging.stagedPackage) return;
    await acceptPackage(currentStoryId, staging.stagedPackage.id);
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
        {/* Error display */}
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        {/* Compose Form */}
        <ComposeForm
          onGenerate={handleGenerate}
          loading={loading}
          formState={formState}
          onFormStateChange={setFormState}
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
    </div>
  );
}
