/**
 * useGapsCoverage - Fetch unified gaps and coverage data for a story.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CoverageData, GapsData } from '../api/types';

interface UseGapsCoverageResult {
  coverage: CoverageData | null;
  gaps: GapsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGapsCoverage(storyId: string | null): UseGapsCoverageResult {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [gaps, setGaps] = useState<GapsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const [cov, gps] = await Promise.all([
        api.getCoverage(storyId),
        api.getGaps(storyId),
      ]);
      setCoverage(cov);
      setGaps(gps);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { coverage, gaps, loading, error, refresh };
}

