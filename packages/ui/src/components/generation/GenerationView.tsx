import { useState, useCallback, useMemo } from 'react';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import { GenerationSidebar } from './GenerationSidebar';
import { PackageDetail } from './PackageDetail';
import { RefineModal } from './RefineModal';
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
    refinableElements,
  } = useGeneration();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    session?.packages[0]?.id ?? null
  );
  const [refineModalOpen, setRefineModalOpen] = useState(false);

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

  const handleRefineClick = useCallback(() => {
    setRefineModalOpen(true);
  }, []);

  const handleRefine = useCallback(
    async (request: RefineRequest) => {
      if (!currentStoryId) return;
      await refinePackage(currentStoryId, request);
      setRefineModalOpen(false);
    },
    [currentStoryId, refinePackage]
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
        {selectedPackage ? (
          <PackageDetail
            package={selectedPackage}
            onAccept={handleAccept}
            onRefine={handleRefineClick}
            onReject={handleReject}
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

      {/* Refine Modal */}
      {refineModalOpen && selectedPackage && refinableElements && (
        <RefineModal
          package={selectedPackage}
          refinableElements={refinableElements}
          onRefine={handleRefine}
          onClose={() => setRefineModalOpen(false)}
          loading={loading}
        />
      )}
    </div>
  );
}
