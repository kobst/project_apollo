import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { SavedPackageData } from '../api/types';

interface SavedPackagesContextValue {
  /** List of saved packages */
  savedPackages: SavedPackageData[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  // Actions
  /** Load saved packages for a story */
  loadSavedPackages: (storyId: string) => Promise<void>;
  /** Save a package from the active session */
  savePackage: (storyId: string, packageId: string, note?: string) => Promise<SavedPackageData>;
  /** Delete a saved package */
  deleteSavedPackage: (storyId: string, savedPackageId: string) => Promise<void>;
  /** Update user note on a saved package */
  updateSavedPackage: (storyId: string, savedPackageId: string, note?: string) => Promise<void>;
  /** Apply a saved package to the graph */
  applySavedPackage: (storyId: string, savedPackageId: string) => Promise<void>;
  /** Clear saved packages state */
  clearSavedPackages: () => void;
}

const SavedPackagesContext = createContext<SavedPackagesContextValue | null>(null);

export function SavedPackagesProvider({ children }: { children: ReactNode }) {
  const [savedPackages, setSavedPackages] = useState<SavedPackageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved packages for a story
  const loadSavedPackages = useCallback(async (storyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listSavedPackages(storyId);
      setSavedPackages(data.packages);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save a package from the active session
  const savePackage = useCallback(
    async (storyId: string, packageId: string, note?: string): Promise<SavedPackageData> => {
      try {
        setLoading(true);
        setError(null);
        const request: { packageId: string; userNote?: string } = { packageId };
        if (note) {
          request.userNote = note;
        }
        const data = await api.savePackage(storyId, request);
        const savedPackage = data.savedPackage;

        // Add to local state
        setSavedPackages((prev) => [...prev, savedPackage]);

        return savedPackage;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Delete a saved package
  const deleteSavedPackage = useCallback(
    async (storyId: string, savedPackageId: string) => {
      try {
        setLoading(true);
        setError(null);
        await api.deleteSavedPackage(storyId, savedPackageId);

        // Remove from local state
        setSavedPackages((prev) => prev.filter((p) => p.id !== savedPackageId));
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update a saved package's note
  const updateSavedPackage = useCallback(
    async (storyId: string, savedPackageId: string, note?: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.updateSavedPackage(storyId, savedPackageId, note);

        // Update in local state
        setSavedPackages((prev) =>
          prev.map((p) => (p.id === savedPackageId ? data.savedPackage : p))
        );
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Apply a saved package to the graph
  const applySavedPackage = useCallback(
    async (storyId: string, savedPackageId: string) => {
      try {
        setLoading(true);
        setError(null);
        await api.applySavedPackage(storyId, savedPackageId);

        // Refresh saved packages to update compatibility statuses
        const data = await api.listSavedPackages(storyId);
        setSavedPackages(data.packages);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Clear saved packages state
  const clearSavedPackages = useCallback(() => {
    setSavedPackages([]);
    setError(null);
  }, []);

  const value: SavedPackagesContextValue = {
    savedPackages,
    loading,
    error,
    loadSavedPackages,
    savePackage,
    deleteSavedPackage,
    updateSavedPackage,
    applySavedPackage,
    clearSavedPackages,
  };

  return (
    <SavedPackagesContext.Provider value={value}>
      {children}
    </SavedPackagesContext.Provider>
  );
}

export function useSavedPackages(): SavedPackagesContextValue {
  const context = useContext(SavedPackagesContext);
  if (!context) {
    throw new Error('useSavedPackages must be used within a SavedPackagesProvider');
  }
  return context;
}
