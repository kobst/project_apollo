import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type {
  GenerationSession,
  GenerateRequest,
  RefineRequest,
  NarrativePackage,
  RefinableElements,
} from '../api/types';

interface GenerationContextValue {
  /** Current generation session */
  session: GenerationSession | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether panel is open */
  isOpen: boolean;

  // Actions
  /** Start a new generation */
  startGeneration: (storyId: string, request: GenerateRequest) => Promise<void>;
  /** Refine a package */
  refinePackage: (storyId: string, request: RefineRequest) => Promise<void>;
  /** Accept a package and apply to graph */
  acceptPackage: (storyId: string, packageId: string) => Promise<void>;
  /** Reject a package (remove from session) */
  rejectPackage: (packageId: string) => void;
  /** Regenerate all packages */
  regenerateAll: (storyId: string) => Promise<void>;
  /** Abandon the session */
  abandonSession: (storyId: string) => Promise<void>;
  /** Load existing session for a story */
  loadSession: (storyId: string) => Promise<void>;

  // Panel control
  /** Open the generation panel */
  openPanel: () => void;
  /** Close the generation panel */
  closePanel: () => void;

  // Navigation
  /** Currently selected package ID */
  selectedPackageId: string | null;
  /** Select a package */
  selectPackage: (packageId: string) => void;
  /** Get refinable elements for current package */
  refinableElements: RefinableElements | null;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GenerationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  // Get refinable elements for current selection
  const refinableElements = session?.refinableElements ?? null;

  // Load existing session
  const loadSession = useCallback(async (storyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSession(storyId);
      setSession(data);
      setSelectedPackageId(data.currentPackageId ?? data.packages[0]?.id ?? null);
    } catch (err) {
      // Session not found is not an error
      if ((err as Error).message?.includes('not found')) {
        setSession(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Start new generation
  const startGeneration = useCallback(
    async (storyId: string, request: GenerateRequest) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.generate(storyId, request);

        // Construct session from response
        const newSession: GenerationSession = {
          id: data.sessionId,
          storyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          entryPoint: request.entryPoint,
          packages: data.packages,
          status: 'active',
        };

        setSession(newSession);
        setSelectedPackageId(data.packages[0]?.id ?? null);
        setIsOpen(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Refine package
  const refinePackage = useCallback(
    async (storyId: string, request: RefineRequest) => {
      if (!session) return;

      try {
        setLoading(true);
        setError(null);
        const data = await api.refine(storyId, request);

        // Add variations to session
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            packages: [...prev.packages, ...data.variations],
            updatedAt: new Date().toISOString(),
          };
        });

        // Select first variation
        const firstVariation = data.variations[0];
        if (firstVariation) {
          setSelectedPackageId(firstVariation.id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  // Accept package
  const acceptPackage = useCallback(
    async (storyId: string, packageId: string) => {
      try {
        setLoading(true);
        setError(null);
        await api.acceptPackage(storyId, packageId);

        // Mark session as accepted
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'accepted',
            acceptedPackageId: packageId,
          };
        });

        // Close panel after short delay
        setTimeout(() => {
          setIsOpen(false);
          setSession(null);
        }, 500);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Reject package (local only - removes from session)
  const rejectPackage = useCallback((packageId: string) => {
    setSession((prev) => {
      if (!prev) return prev;

      const filtered = prev.packages.filter((p) => p.id !== packageId);

      // Also remove any children of this package
      const removeChildren = (packages: NarrativePackage[], parentId: string): NarrativePackage[] => {
        const childIds = packages
          .filter((p) => p.parent_package_id === parentId)
          .map((p) => p.id);

        let result = packages.filter((p) => p.parent_package_id !== parentId);

        for (const childId of childIds) {
          result = removeChildren(result, childId);
        }

        return result;
      };

      const finalPackages = removeChildren(filtered, packageId);

      return {
        ...prev,
        packages: finalPackages,
      };
    });

    // Select a different package
    setSelectedPackageId((prev) => {
      if (prev === packageId) {
        const remaining = session?.packages.filter((p) => p.id !== packageId) ?? [];
        return remaining[0]?.id ?? null;
      }
      return prev;
    });
  }, [session?.packages]);

  // Regenerate all
  const regenerateAll = useCallback(async (storyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.regenerate(storyId);

      // Update session with new packages
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          packages: data.packages,
          updatedAt: new Date().toISOString(),
        };
      });

      setSelectedPackageId(data.packages[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Abandon session
  const abandonSession = useCallback(async (storyId: string) => {
    try {
      setLoading(true);
      setError(null);
      await api.deleteSession(storyId);
      setSession(null);
      setSelectedPackageId(null);
      setIsOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Panel control
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  // Select package
  const selectPackage = useCallback((packageId: string) => {
    setSelectedPackageId(packageId);
  }, []);

  const value: GenerationContextValue = {
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
    loadSession,
    openPanel,
    closePanel,
    selectedPackageId,
    selectPackage,
    refinableElements,
  };

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration(): GenerationContextValue {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
}
