import { useState, useCallback, useMemo, useEffect } from 'react';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import { useSavedPackages } from '../../context/SavedPackagesContext';
import { GenerationSidebar } from './GenerationSidebar';
import { PackageDetail } from './PackageDetail';
import type { RefineRequest } from '../../api/types';
import styles from './GenerationView.module.css';

export function GenerationView() {
  const { currentStoryId } = useStory();
  const {
    session,
    loading,
    error,
    acceptPackage,
    refinePackage,
    rejectPackage,
    regenerateElement,
    applyElementOption,
    updatePackageElement,
  } = useGeneration();

  const {
    savedPackages,
    loading: savedPackagesLoading,
    loadSavedPackages,
    savePackage,
    deleteSavedPackage,
    applySavedPackage,
  } = useSavedPackages();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    session?.packages[0]?.id ?? null
  );

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

  // Auto-select first package when session changes
  useMemo(() => {
    if (session && session.packages.length > 0 && !selectedPackageId) {
      setSelectedPackageId(session.packages[0]?.id ?? null);
    }
  }, [session, selectedPackageId]);

  // Handlers
  const handleAccept = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    await acceptPackage(currentStoryId, selectedPackageId);
  }, [currentStoryId, selectedPackageId, acceptPackage]);

  const handleRefine = useCallback(
    async (request: RefineRequest) => {
      if (!currentStoryId) return;
      await refinePackage(currentStoryId, request);
    },
    [currentStoryId, refinePackage]
  );

  // Handler for opening refine - now just starts a refine with empty guidance
  const handleRefineClick = useCallback(() => {
    if (!selectedPackageId) return;
    handleRefine({
      basePackageId: selectedPackageId,
      guidance: 'Generate variations with different approaches',
    });
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
  }, [currentStoryId, deleteSavedPackage]);

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

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <GenerationSidebar
        selectedPackageId={selectedPackageId}
        onSelectPackage={setSelectedPackageId}
        savedPackages={savedPackages}
        savedPackagesLoading={savedPackagesLoading}
        onApplySavedPackage={handleApplySavedPackage}
        onDeleteSavedPackage={handleDeleteSavedPackage}
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
        {selectedPackage && currentStoryId ? (
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
            loading={loading}
          />
        ) : session && session.packages.length === 0 ? (
          <div className={styles.emptyContent}>
            <h2>No Packages Yet</h2>
            <p>
              Use the controls in the sidebar to generate AI packages for your
              story.
            </p>
          </div>
        ) : (
          <div className={styles.emptyContent}>
            <h2>AI Generation</h2>
            <p>
              Generate narrative packages using AI. Select an entry point, depth,
              and count from the sidebar, then click Generate.
            </p>
            <div className={styles.emptyHints}>
              <div className={styles.hint}>
                <strong>Entry Point:</strong> What to generate for (beat,
                character, gap, etc.)
              </div>
              <div className={styles.hint}>
                <strong>Depth:</strong> How many nodes to generate per package
              </div>
              <div className={styles.hint}>
                <strong>Options:</strong> How many alternative packages to create
              </div>
              <div className={styles.hint}>
                <strong>Direction:</strong> Optional guidance for the AI
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
