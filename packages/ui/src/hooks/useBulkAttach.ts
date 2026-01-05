/**
 * useBulkAttach - React hook for bulk attach modal state and operations
 *
 * Provides:
 * - Modal open/close state
 * - Selection state management
 * - API call wrapper
 * - Change tracking (added, updated, removed)
 */

import { useState, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type {
  EdgeType,
  EdgeData,
  EdgeProperties,
  BulkAttachData,
} from '../api/types';

// =============================================================================
// Types
// =============================================================================

export interface SelectedTarget {
  id: string;
  order?: number | undefined;
  properties?: Partial<EdgeProperties> | undefined;
  isNew?: boolean | undefined; // True if not currently attached
}

export interface BulkAttachModalConfig {
  parentId: string;
  edgeType: EdgeType;
  direction: 'outgoing' | 'incoming';
  ordered?: boolean | undefined;
  singleSelect?: boolean | undefined;
  existingEdges?: EdgeData[] | undefined;
}

export interface UseBulkAttachOptions {
  storyId: string;
  onSuccess?: ((result: BulkAttachData) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
}

export interface UseBulkAttachResult {
  // Modal state
  isOpen: boolean;
  config: BulkAttachModalConfig | null;

  // Selection state
  selectedTargets: SelectedTarget[];

  // Computed changes
  changes: {
    toAdd: SelectedTarget[];
    toUpdate: SelectedTarget[];
    toRemove: string[];
    hasChanges: boolean;
  };

  // Loading state
  isSaving: boolean;
  error: string | null;

  // Actions
  openModal: (config: BulkAttachModalConfig) => void;
  closeModal: () => void;
  addTarget: (target: SelectedTarget) => void;
  removeTarget: (targetId: string) => void;
  updateTargetOrder: (targetId: string, newOrder: number) => void;
  reorderTargets: (orderedIds: string[]) => void;
  setTargets: (targets: SelectedTarget[]) => void;
  save: (detachOthers?: boolean) => Promise<BulkAttachData | null>;
  reset: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the "child" node ID from an edge based on direction.
 * If outgoing: parent is source (from), child is target (to)
 * If incoming: parent is target (to), child is source (from)
 */
function getChildIdFromEdge(edge: EdgeData, direction: 'outgoing' | 'incoming'): string {
  return direction === 'outgoing' ? edge.to : edge.from;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useBulkAttach({
  storyId,
  onSuccess,
  onError,
}: UseBulkAttachOptions): UseBulkAttachResult {
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<BulkAttachModalConfig | null>(null);

  // Selection state
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track original edges for change detection
  const [originalEdges, setOriginalEdges] = useState<EdgeData[]>([]);

  // Compute changes
  const changes = useMemo(() => {
    if (!config) {
      return { toAdd: [], toUpdate: [], toRemove: [], hasChanges: false };
    }

    const originalChildIds = new Set(
      originalEdges.map((e) => getChildIdFromEdge(e, config.direction))
    );
    const selectedIds = new Set(selectedTargets.map((t) => t.id));

    const toAdd = selectedTargets.filter((t) => !originalChildIds.has(t.id));
    const toUpdate = selectedTargets.filter((t) => {
      if (!originalChildIds.has(t.id)) return false;
      const originalEdge = originalEdges.find(
        (e) => getChildIdFromEdge(e, config.direction) === t.id
      );
      if (!originalEdge) return false;
      // Check if order changed
      if (config.ordered && t.order !== originalEdge.properties?.order) {
        return true;
      }
      return false;
    });
    const toRemove = originalEdges
      .filter((e) => !selectedIds.has(getChildIdFromEdge(e, config.direction)))
      .map((e) => e.id);

    return {
      toAdd,
      toUpdate,
      toRemove,
      hasChanges: toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0,
    };
  }, [config, selectedTargets, originalEdges]);

  // Actions
  const openModal = useCallback((newConfig: BulkAttachModalConfig) => {
    setConfig(newConfig);
    setError(null);

    // Initialize selection from existing edges
    const existingEdges = newConfig.existingEdges ?? [];
    setOriginalEdges(existingEdges);

    const initialTargets: SelectedTarget[] = existingEdges.map((edge) => ({
      id: getChildIdFromEdge(edge, newConfig.direction),
      order: edge.properties?.order,
      properties: edge.properties,
      isNew: false,
    }));

    // Sort by order if ordered
    if (newConfig.ordered) {
      initialTargets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    setSelectedTargets(initialTargets);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
    setSelectedTargets([]);
    setOriginalEdges([]);
    setError(null);
  }, []);

  const addTarget = useCallback((target: SelectedTarget) => {
    setSelectedTargets((prev) => {
      // Check for single-select mode
      if (config?.singleSelect) {
        return [{ ...target, isNew: true }];
      }
      // Don't add duplicates
      if (prev.some((t) => t.id === target.id)) {
        return prev;
      }
      // Assign order if ordered mode
      const newTarget = { ...target, isNew: true };
      if (config?.ordered && newTarget.order === undefined) {
        newTarget.order = prev.length + 1;
      }
      return [...prev, newTarget];
    });
  }, [config]);

  const removeTarget = useCallback((targetId: string) => {
    setSelectedTargets((prev) => {
      const filtered = prev.filter((t) => t.id !== targetId);
      // Re-index if ordered
      if (config?.ordered) {
        return filtered.map((t, idx) => ({ ...t, order: idx + 1 }));
      }
      return filtered;
    });
  }, [config]);

  const updateTargetOrder = useCallback((targetId: string, newOrder: number) => {
    setSelectedTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, order: newOrder } : t))
    );
  }, []);

  const reorderTargets = useCallback((orderedIds: string[]) => {
    setSelectedTargets((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      const result: SelectedTarget[] = [];
      orderedIds.forEach((id, idx) => {
        const target = byId.get(id);
        if (target) {
          result.push({ ...target, order: idx + 1 });
        }
      });
      return result;
    });
  }, []);

  const setTargets = useCallback((targets: SelectedTarget[]) => {
    setSelectedTargets(targets);
  }, []);

  const save = useCallback(
    async (detachOthers = true): Promise<BulkAttachData | null> => {
      if (!config) {
        setError('No configuration set');
        return null;
      }

      setIsSaving(true);
      setError(null);

      try {
        const result = await api.bulkAttach(storyId, {
          parentId: config.parentId,
          edgeType: config.edgeType,
          direction: config.direction,
          targets: selectedTargets.map((t) => ({
            id: t.id,
            order: t.order,
            properties: t.properties,
          })),
          detachOthers,
          ordered: config.ordered,
        });

        onSuccess?.(result);
        closeModal();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        setError(message);
        onError?.(err instanceof Error ? err : new Error(message));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [config, storyId, selectedTargets, onSuccess, onError, closeModal]
  );

  const reset = useCallback(() => {
    if (!config) return;
    const existingEdges = config.existingEdges ?? [];
    setOriginalEdges(existingEdges);

    const initialTargets: SelectedTarget[] = existingEdges.map((edge) => ({
      id: getChildIdFromEdge(edge, config.direction),
      order: edge.properties?.order,
      properties: edge.properties,
      isNew: false,
    }));

    if (config.ordered) {
      initialTargets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    setSelectedTargets(initialTargets);
    setError(null);
  }, [config]);

  return {
    // Modal state
    isOpen,
    config,

    // Selection state
    selectedTargets,

    // Computed changes
    changes,

    // Loading state
    isSaving,
    error,

    // Actions
    openModal,
    closeModal,
    addTarget,
    removeTarget,
    updateTargetOrder,
    reorderTargets,
    setTargets,
    save,
    reset,
  };
}
