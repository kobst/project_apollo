import { useState, useCallback, useMemo, useEffect } from 'react';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import { useSavedPackages } from '../../context/SavedPackagesContext';
import { GenerationSidebar } from './GenerationSidebar';
import { PackageDetail } from './PackageDetail';
import { ComposeForm } from './ComposeForm';
import type { ComposeFormState } from './ComposeForm';
import type { SavedPackageData, NarrativePackage, ProposeRequest } from '../../api/types';
import styles from './GenerationView.module.css';

type ViewState = 'compose' | 'review';

const DEFAULT_FORM_STATE: ComposeFormState = {
  mode: 'add',
  selectedEntryIndex: 0,
  direction: '',
  showAdvanced: false,
  customCreativity: null,
  customPackageCount: null,
  customNodesPerPackage: null,
};

export function GenerationView() {
  const { currentStoryId } = useStory();
  const {
    session,
    loading,
    error,
    propose,
    acceptPackage,
    refinePackage,
    rejectPackage,
    regenerateElement,
    applyElementOption,
    updatePackageElement,
    applyFilteredPackage,
    stageSavedPackage,
    clearStaging,
  } = useGeneration();

  const {
    savedPackages,
    loading: savedPackagesLoading,
    loadSavedPackages,
    savePackage,
    deleteSavedPackage,
    applySavedPackage,
  } = useSavedPackages();

  // View state: compose (input form) or review (package details)
  const [viewState, setViewState] = useState<ViewState>('compose');

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    session?.packages[0]?.id ?? null
  );

  // Track if viewing a saved package (separate from session packages)
  const [viewingSavedPackage, setViewingSavedPackage] = useState<SavedPackageData | null>(null);

  // Form state - persists across view changes
  const [formState, setFormState] = useState<ComposeFormState>(DEFAULT_FORM_STATE);

  // Track previous package count to detect new packages arriving
  const [prevPackageCount, setPrevPackageCount] = useState(0);

  // Load saved packages when story changes
  useEffect(() => {
    if (currentStoryId) {
      loadSavedPackages(currentStoryId);
    }
  }, [currentStoryId, loadSavedPackages]);

  // Get selected package
  const selectedPackage = useMemo(
    () => session?.packages.find((p) => p.id === selectedPackageId),
    [session?.packages, selectedPackageId]
  );

  // Auto-select first package and switch to review when NEW packages arrive
  useEffect(() => {
    const currentCount = session?.packages.length ?? 0;

    if (session && currentCount > 0) {
      // Auto-select first package if none selected or current selection invalid
      if (!selectedPackageId || !session.packages.find(p => p.id === selectedPackageId)) {
        setSelectedPackageId(session.packages[0]?.id ?? null);
      }

      // Only auto-switch to review when packages FIRST arrive (0 → N)
      // This allows user to go back to compose while packages still exist
      if (prevPackageCount === 0 && currentCount > 0) {
        setViewState('review');
      }
    }

    setPrevPackageCount(currentCount);
  }, [session, selectedPackageId, prevPackageCount]);

  // Handle generation from ComposeForm
  const handleGenerate = useCallback(async (request: ProposeRequest) => {
    if (!currentStoryId) return;
    await propose(currentStoryId, request);
    // View will auto-switch to review when packages arrive via useEffect
  }, [currentStoryId, propose]);

  // Handlers
  const handleAccept = useCallback(async (filteredPackage?: NarrativePackage) => {
    if (!currentStoryId || !selectedPackageId) return;

    if (filteredPackage) {
      // Apply filtered package directly
      await applyFilteredPackage(currentStoryId, filteredPackage);
    } else {
      // No filtering - use standard accept
      await acceptPackage(currentStoryId, selectedPackageId);
    }
  }, [currentStoryId, selectedPackageId, acceptPackage, applyFilteredPackage]);

  const handleRefine = useCallback(
    async (packageId: string, guidance: string, creativity?: number) => {
      if (!currentStoryId) return;
      await refinePackage(currentStoryId, packageId, guidance, creativity);
    },
    [currentStoryId, refinePackage]
  );

  // Handler for opening refine - now just starts a refine with default guidance
  const handleRefineClick = useCallback(() => {
    if (!selectedPackageId) return;
    handleRefine(selectedPackageId, 'Generate variations with different approaches', 0.5);
  }, [selectedPackageId, handleRefine]);

  // Element regeneration handler
  const handleRegenerateElement = useCallback(
    async (
      packageId: string,
      elementType: 'node' | 'edge' | 'storyContext',
      elementIndex: number,
      guidance?: string,
      count?: 'few' | 'standard' | 'many'
    ) => {
      if (!currentStoryId) throw new Error('No story selected');
      return regenerateElement(
        currentStoryId,
        packageId,
        elementType,
        elementIndex,
        guidance,
        count
      );
    },
    [currentStoryId, regenerateElement]
  );

  // Apply element option handler
  const handleApplyElementOption = useCallback(
    async (
      packageId: string,
      elementType: 'node' | 'edge' | 'storyContext',
      elementIndex: number,
      newElement: unknown
    ) => {
      if (!currentStoryId) return;
      await applyElementOption(
        currentStoryId,
        packageId,
        elementType,
        elementIndex,
        newElement as Parameters<typeof applyElementOption>[4]
      );
    },
    [currentStoryId, applyElementOption]
  );

  // Update element handler (manual edit)
  const handleUpdateElement = useCallback(
    async (
      packageId: string,
      elementType: 'node' | 'edge' | 'storyContext',
      elementIndex: number,
      updatedElement: unknown
    ) => {
      if (!currentStoryId) return;
      await updatePackageElement(
        currentStoryId,
        packageId,
        elementType,
        elementIndex,
        updatedElement as Parameters<typeof updatePackageElement>[4]
      );
    },
    [currentStoryId, updatePackageElement]
  );

  const handleReject = useCallback(() => {
    if (!selectedPackageId) return;
    rejectPackage(selectedPackageId);

    // Select another package
    if (session) {
      const remaining = session.packages.filter((p) => p.id !== selectedPackageId);
      setSelectedPackageId(remaining[0]?.id ?? null);
    }
  }, [selectedPackageId, rejectPackage, session]);

  // Save package handler
  const handleSave = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    await savePackage(currentStoryId, selectedPackageId);
  }, [currentStoryId, selectedPackageId, savePackage]);

  // Apply saved package handler
  const handleApplySavedPackage = useCallback(async (savedPackageId: string) => {
    if (!currentStoryId) return;
    await applySavedPackage(currentStoryId, savedPackageId);
  }, [currentStoryId, applySavedPackage]);

  // Delete saved package handler
  const handleDeleteSavedPackage = useCallback(async (savedPackageId: string) => {
    if (!currentStoryId) return;
    await deleteSavedPackage(currentStoryId, savedPackageId);
    // Clear view if we deleted the one we're viewing
    if (viewingSavedPackage?.id === savedPackageId) {
      setViewingSavedPackage(null);
      clearStaging(); // Also clear staging
    }
  }, [currentStoryId, deleteSavedPackage, viewingSavedPackage?.id, clearStaging]);

  // View saved package handler - shows it in the main content area
  const handleViewSavedPackage = useCallback((savedPkg: SavedPackageData) => {
    setViewingSavedPackage(savedPkg);
    setSelectedPackageId(null); // Deselect session package
    setViewState('review');
    stageSavedPackage(savedPkg.package); // Stage for workspace preview
  }, [stageSavedPackage]);

  // Handle selecting a session package (clears saved package view)
  const handleSelectSessionPackage = useCallback((packageId: string | null) => {
    setSelectedPackageId(packageId);
    setViewingSavedPackage(null); // Clear saved package view
    setViewState('review');
  }, []);

  // Close saved package view
  const handleCloseSavedPackageView = useCallback(() => {
    setViewingSavedPackage(null);
    clearStaging(); // Clear staging when closing
  }, [clearStaging]);

  // Handle New Proposal button (goes to compose, preserving form state)
  const handleNewProposal = useCallback(() => {
    setViewState('compose');
    setViewingSavedPackage(null);
  }, []);

  // Handler to go back to compose (preserving inputs)
  const handleBackToCompose = useCallback(() => {
    setViewState('compose');
    setViewingSavedPackage(null);
  }, []);

  // Empty state - no story selected
  if (!currentStoryId) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyContent}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Stories tab to use AI generation.</p>
        </div>
      </div>
    );
  }

  // Determine what to show in main view
  const renderMainContent = () => {
    // Viewing a saved package
    if (viewingSavedPackage && currentStoryId) {
      return (
        <PackageDetail
          package={viewingSavedPackage.package}
          storyId={currentStoryId}
          onAccept={() => handleApplySavedPackage(viewingSavedPackage.id)}
          onRefine={handleCloseSavedPackageView}
          onReject={() => handleDeleteSavedPackage(viewingSavedPackage.id)}
          onRegenerateElement={handleRegenerateElement}
          onApplyElementOption={handleApplyElementOption}
          onUpdateElement={handleUpdateElement}
          loading={loading || savedPackagesLoading}
          isSavedPackage
          savedPackageData={viewingSavedPackage}
          onClose={handleCloseSavedPackageView}
        />
      );
    }

    // Compose state - show the form
    if (viewState === 'compose') {
      return (
        <ComposeForm
          onGenerate={handleGenerate}
          loading={loading}
          formState={formState}
          onFormStateChange={setFormState}
        />
      );
    }

    // Review state with selected package
    if (selectedPackage && currentStoryId) {
      return (
        <PackageDetail
          package={selectedPackage}
          storyId={currentStoryId}
          onAccept={handleAccept}
          onRefine={handleRefineClick}
          onReject={handleReject}
          onSave={handleSave}
          onRegenerateElement={handleRegenerateElement}
          onApplyElementOption={handleApplyElementOption}
          onUpdateElement={handleUpdateElement}
          onBackToCompose={handleBackToCompose}
          loading={loading}
        />
      );
    }

    // No packages yet - show compose form
    return (
      <ComposeForm
        onGenerate={handleGenerate}
        loading={loading}
        formState={formState}
        onFormStateChange={setFormState}
      />
    );
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <GenerationSidebar
        selectedPackageId={selectedPackageId}
        onSelectPackage={handleSelectSessionPackage}
        savedPackages={savedPackages}
        savedPackagesLoading={savedPackagesLoading}
        onApplySavedPackage={handleApplySavedPackage}
        onDeleteSavedPackage={handleDeleteSavedPackage}
        onViewSavedPackage={handleViewSavedPackage}
        viewingSavedPackageId={viewingSavedPackage?.id ?? null}
        onNewProposal={handleNewProposal}
        isComposing={viewState === 'compose' && !viewingSavedPackage}
      />

      {/* Main Content */}
      <div className={styles.main}>
        {/* Error Banner */}
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        {/* Content */}
        {renderMainContent()}
      </div>
    </div>
  );
}
