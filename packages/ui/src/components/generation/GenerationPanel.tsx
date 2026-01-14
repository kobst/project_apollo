import { useState, useCallback, useMemo, useEffect } from 'react';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import { GenerationTrigger, type EntryPointOption } from './GenerationTrigger';
import { PackageBrowser } from './PackageBrowser';
import { RefineModal } from './RefineModal';
import type { GenerateRequest, RefineRequest } from '../../api/types';
import styles from './GenerationPanel.module.css';

type PanelView = 'trigger' | 'browser';

export function GenerationPanel() {
  const { currentStoryId } = useStory();
  const {
    session,
    loading,
    error,
    isOpen,
    startGeneration,
    refinePackage,
    acceptPackage,
    rejectPackage,
    regenerateAll,
    abandonSession,
    closePanel,
    selectedPackageId,
    refinableElements,
  } = useGeneration();

  const [view, setView] = useState<PanelView>('trigger');
  const [refineModalOpen, setRefineModalOpen] = useState(false);

  // Switch to browser view when session exists
  useEffect(() => {
    if (session && session.packages.length > 0) {
      setView('browser');
    } else {
      setView('trigger');
    }
  }, [session]);

  // Entry points - for now just provide common options
  // In a real implementation, these would come from the outline/gaps
  const entryPoints: EntryPointOption[] = useMemo(
    () => [
      { type: 'naked', label: 'Auto (AI decides)', description: 'Let AI identify highest-value additions' },
      { type: 'beat', targetId: 'beat_Catalyst', label: 'Catalyst Beat', description: 'Generate content for Catalyst' },
      { type: 'beat', targetId: 'beat_Midpoint', label: 'Midpoint Beat', description: 'Generate content for Midpoint' },
      { type: 'beat', targetId: 'beat_AllIsLost', label: 'All Is Lost Beat', description: 'Generate content for All Is Lost' },
    ],
    []
  );

  // Handlers
  const handleGenerate = useCallback(
    async (request: GenerateRequest) => {
      if (!currentStoryId) return;
      await startGeneration(currentStoryId, request);
    },
    [currentStoryId, startGeneration]
  );

  const handleAccept = useCallback(
    async (packageId: string) => {
      if (!currentStoryId) return;
      await acceptPackage(currentStoryId, packageId);
    },
    [currentStoryId, acceptPackage]
  );

  const handleRefineClick = useCallback((_packageId: string) => {
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

  const handleRegenerate = useCallback(async () => {
    if (!currentStoryId) return;
    await regenerateAll(currentStoryId);
  }, [currentStoryId, regenerateAll]);

  const handleAbandon = useCallback(async () => {
    if (!currentStoryId) return;
    await abandonSession(currentStoryId);
  }, [currentStoryId, abandonSession]);

  const handleBackToTrigger = useCallback(() => {
    setView('trigger');
  }, []);

  // Selected package for refine modal
  const selectedPackage = useMemo(
    () => session?.packages.find((p) => p.id === selectedPackageId),
    [session?.packages, selectedPackageId]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={closePanel} />

      {/* Panel */}
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {view === 'browser' && (
              <button
                className={styles.backBtn}
                onClick={handleBackToTrigger}
                type="button"
              >
                ←
              </button>
            )}
            <h2 className={styles.title}>
              {view === 'trigger' ? 'AI Generation' : 'Generated Packages'}
            </h2>
          </div>
          <button
            className={styles.closeBtn}
            onClick={closePanel}
            type="button"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {view === 'trigger' && (
            <GenerationTrigger
              entryPoints={entryPoints}
              onGenerate={handleGenerate}
              loading={loading}
            />
          )}

          {view === 'browser' && session && (
            <PackageBrowser
              session={session}
              onAccept={handleAccept}
              onRefine={handleRefineClick}
              onReject={rejectPackage}
              onRegenerate={handleRegenerate}
              onAbandon={handleAbandon}
              loading={loading}
            />
          )}
        </div>
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
    </>
  );
}
