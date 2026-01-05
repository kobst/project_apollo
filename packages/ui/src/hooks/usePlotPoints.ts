/**
 * usePlotPoints - React hook for plot point CRUD operations
 *
 * Provides:
 * - List plot points with filters
 * - Create plot point
 * - Update plot point
 * - Delete plot point
 */

import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type {
  PlotPointData,
  PlotPointFilters,
  CreatePlotPointRequest,
  CreatePlotPointData,
  UpdatePlotPointData,
  DeletePlotPointData,
} from '../api/types';

// =============================================================================
// Types
// =============================================================================

export interface UsePlotPointsOptions {
  storyId: string;
}

export interface UsePlotPointsResult {
  // State
  plotPoints: PlotPointData[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlotPoints: (filters?: PlotPointFilters, limit?: number, offset?: number) => Promise<void>;
  createPlotPoint: (data: CreatePlotPointRequest) => Promise<CreatePlotPointData | null>;
  updatePlotPoint: (ppId: string, changes: Record<string, unknown>) => Promise<UpdatePlotPointData | null>;
  deletePlotPoint: (ppId: string) => Promise<DeletePlotPointData | null>;
  getPlotPoint: (ppId: string) => Promise<PlotPointData | null>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePlotPoints({ storyId }: UsePlotPointsOptions): UsePlotPointsResult {
  // State
  const [plotPoints, setPlotPoints] = useState<PlotPointData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track last used filters for refresh
  const [lastFilters, setLastFilters] = useState<PlotPointFilters | undefined>();
  const [lastLimit, setLastLimit] = useState<number | undefined>();
  const [lastOffset, setLastOffset] = useState<number | undefined>();

  // Fetch plot points
  const fetchPlotPoints = useCallback(
    async (filters?: PlotPointFilters, limit?: number, offset?: number) => {
      if (!storyId) return;

      setIsLoading(true);
      setError(null);
      setLastFilters(filters);
      setLastLimit(limit);
      setLastOffset(offset);

      try {
        const result = await api.listPlotPoints(storyId, filters, limit, offset);
        setPlotPoints(result.plotPoints);
        setTotalCount(result.totalCount);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch plot points';
        setError(message);
        console.error('Failed to fetch plot points:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Refresh with last used filters
  const refresh = useCallback(async () => {
    await fetchPlotPoints(lastFilters, lastLimit, lastOffset);
  }, [fetchPlotPoints, lastFilters, lastLimit, lastOffset]);

  // Create plot point
  const createPlotPoint = useCallback(
    async (data: CreatePlotPointRequest): Promise<CreatePlotPointData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.createPlotPoint(storyId, data);
        // Refresh list after creation
        await refresh();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create plot point';
        setError(message);
        console.error('Failed to create plot point:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId, refresh]
  );

  // Update plot point
  const updatePlotPoint = useCallback(
    async (ppId: string, changes: Record<string, unknown>): Promise<UpdatePlotPointData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.updatePlotPoint(storyId, ppId, changes);
        // Update local state
        setPlotPoints((prev) =>
          prev.map((pp) => (pp.id === ppId ? result.plotPoint : pp))
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update plot point';
        setError(message);
        console.error('Failed to update plot point:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Delete plot point
  const deletePlotPoint = useCallback(
    async (ppId: string): Promise<DeletePlotPointData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.deletePlotPoint(storyId, ppId);
        // Remove from local state
        setPlotPoints((prev) => prev.filter((pp) => pp.id !== ppId));
        setTotalCount((prev) => prev - 1);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete plot point';
        setError(message);
        console.error('Failed to delete plot point:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Get single plot point
  const getPlotPoint = useCallback(
    async (ppId: string): Promise<PlotPointData | null> => {
      if (!storyId) return null;

      try {
        return await api.getPlotPoint(storyId, ppId);
      } catch (err) {
        console.error('Failed to get plot point:', err);
        return null;
      }
    },
    [storyId]
  );

  return {
    // State
    plotPoints,
    totalCount,
    isLoading,
    error,

    // Actions
    fetchPlotPoints,
    createPlotPoint,
    updatePlotPoint,
    deletePlotPoint,
    getPlotPoint,
    refresh,
  };
}
