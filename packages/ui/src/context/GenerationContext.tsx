import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type {
  GenerationSession,
  NarrativePackage,
  RefinableElements,
  PackageElementType,
  GenerationCount,
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
  ProposeRequest,
  ProposeResponseData,
} from '../api/types';
import {
  computeSectionChangeCounts,
  computeDetailedElementCounts,
  computeDetailedStructureCounts,
  type SectionChangeCounts,
  type DetailedElementCounts,
  type DetailedStructureCounts,
} from '../utils/stagingUtils';

// Staging state for workspace integration
export interface StagingState {
  stagedPackage: NarrativePackage | null;
  activePackageIndex: number;
  editedNodes: Map<string, Partial<Record<string, unknown>>>;
  removedNodeIds: Set<string>;
}

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
  /** Unified propose (main AI pipeline) */
  propose: (storyId: string, request: ProposeRequest) => Promise<ProposeResponseData>;
  /** Refine a package via propose */
  refinePackage: (storyId: string, packageId: string, guidance: string, creativity?: number) => Promise<void>;
  /** Accept a package and apply to graph */
  acceptPackage: (storyId: string, packageId: string) => Promise<void>;
  /** Reject a package (remove from session) */
  rejectPackage: (packageId: string) => void;
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

  // Element editing
  /** Regenerate a single element within a package */
  regenerateElement: (
    storyId: string,
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    guidance?: string,
    count?: GenerationCount
  ) => Promise<Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>>;
  /** Apply a selected element option to the package */
  applyElementOption: (
    storyId: string,
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    newElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
  ) => Promise<void>;
  /** Update an element manually (inline edit) */
  updatePackageElement: (
    storyId: string,
    packageId: string,
    elementType: PackageElementType,
    elementIndex: number,
    updatedElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
  ) => Promise<void>;
  /** Validate a package */
  validatePackage: (storyId: string, pkg: NarrativePackage) => Promise<{ valid: boolean; errors: Array<{ type: PackageElementType; index: number; field?: string; message: string }> }>;
  /** Apply a filtered package directly (bypassing session) */
  applyFilteredPackage: (storyId: string, pkg: NarrativePackage) => Promise<void>;

  // Staging state (for unified workspace)
  /** Current staging state */
  staging: StagingState;
  /** Computed section change counts */
  sectionChangeCounts: SectionChangeCounts;
  /** Detailed element change counts (by type) */
  detailedElementCounts: DetailedElementCounts;
  /** Detailed structure change counts (by act) */
  detailedStructureCounts: DetailedStructureCounts;
  /** Stage a package by index */
  stagePackage: (index: number) => void;
  /** Stage a saved package directly (not from session) */
  stageSavedPackage: (pkg: NarrativePackage) => void;
  /** Clear staging state */
  clearStaging: () => void;
  /** Update a node's data in the staged package */
  updateEditedNode: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  /** Remove a proposed node from staging */
  removeProposedNode: (nodeId: string) => void;
  /** Get the currently staged package */
  stagedPackage: NarrativePackage | null;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GenerationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  // Staging state for unified workspace
  const [staging, setStaging] = useState<StagingState>({
    stagedPackage: null,
    activePackageIndex: -1,
    editedNodes: new Map(),
    removedNodeIds: new Set(),
  });

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

  // Map ProposeEntryPointType to GenerationEntryPointType
  const mapProposeToGenerationEntryPointType = (
    proposeType: 'freeText' | 'node' | 'beat' | 'gap' | 'document'
  ): 'beat' | 'plotPoint' | 'character' | 'gap' | 'idea' | 'naked' => {
    switch (proposeType) {
      case 'freeText': return 'naked';
      case 'node': return 'character'; // Default node to character
      case 'beat': return 'beat';
      case 'gap': return 'gap';
      case 'document': return 'naked';
      default: return 'naked';
    }
  };

  // Unified propose (main pipeline)
  const propose = useCallback(
    async (storyId: string, request: ProposeRequest): Promise<ProposeResponseData> => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.propose(storyId, request);

        // Construct session from response
        const newSession: GenerationSession = {
          id: data.sessionId,
          storyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          entryPoint: { type: mapProposeToGenerationEntryPointType(request.scope.entryPoint) },
          packages: data.packages,
          status: 'active',
        };

        setSession(newSession);
        setSelectedPackageId(data.packages[0]?.id ?? null);
        setIsOpen(true);

        return data;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Refine package via propose/refine endpoint
  const refinePackage = useCallback(
    async (storyId: string, packageId: string, guidance: string, creativity: number = 0.5) => {
      if (!session) return;

      try {
        setLoading(true);
        setError(null);
        const data = await api.refineProposal(storyId, { packageId, guidance, creativity });

        // Add variations to session
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            packages: [...prev.packages, ...data.packages],
            updatedAt: new Date().toISOString(),
          };
        });

        // Select first variation
        const firstVariation = data.packages[0];
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

  // Regenerate a single element
  const regenerateElement = useCallback(
    async (
      storyId: string,
      packageId: string,
      elementType: PackageElementType,
      elementIndex: number,
      guidance?: string,
      count?: GenerationCount
    ): Promise<Array<NodeChangeAI | EdgeChangeAI | StoryContextChange>> => {
      try {
        setLoading(true);
        setError(null);
        const request: { packageId: string; elementType: PackageElementType; elementIndex: number; guidance?: string; count?: GenerationCount } = {
          packageId,
          elementType,
          elementIndex,
        };
        if (guidance) {
          request.guidance = guidance;
        }
        if (count) {
          request.count = count;
        }
        const data = await api.regenerateElement(storyId, request);
        return data.options;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Apply a selected element option
  const applyElementOption = useCallback(
    async (
      storyId: string,
      packageId: string,
      elementType: PackageElementType,
      elementIndex: number,
      newElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.applyElementOption(storyId, {
          packageId,
          elementType,
          elementIndex,
          newElement,
        });

        // Update the package in session
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            packages: prev.packages.map((p) =>
              p.id === packageId ? data.package : p
            ),
            updatedAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update an element manually
  const updatePackageElement = useCallback(
    async (
      storyId: string,
      packageId: string,
      elementType: PackageElementType,
      elementIndex: number,
      updatedElement: NodeChangeAI | EdgeChangeAI | StoryContextChange
    ): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.updatePackageElement(storyId, {
          packageId,
          elementType,
          elementIndex,
          updatedElement,
        });

        // Update the package in session
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            packages: prev.packages.map((p) =>
              p.id === packageId ? data.package : p
            ),
            updatedAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Validate a package
  const validatePackage = useCallback(
    async (storyId: string, pkg: NarrativePackage) => {
      try {
        const data = await api.validatePackage(storyId, pkg);
        return data;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    []
  );

  // Apply a filtered package directly (bypassing session)
  const applyFilteredPackage = useCallback(
    async (storyId: string, pkg: NarrativePackage) => {
      try {
        setLoading(true);
        setError(null);

        // Use existing applyPackage endpoint
        await api.applyPackage(storyId, pkg);

        // Mark session as accepted
        setSession((prev) => {
          if (!prev) return prev;
          return { ...prev, status: 'accepted', acceptedPackageId: pkg.id };
        });

        // Clear staging
        setStaging({
          stagedPackage: null,
          activePackageIndex: -1,
          editedNodes: new Map(),
          removedNodeIds: new Set(),
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

  // Stage a package by index
  const stagePackage = useCallback(
    (index: number) => {
      if (!session || index < 0 || index >= session.packages.length) {
        setStaging({
          stagedPackage: null,
          activePackageIndex: -1,
          editedNodes: new Map(),
          removedNodeIds: new Set(),
        });
        return;
      }

      const pkg = session.packages[index];
      if (pkg) {
        setStaging({
          stagedPackage: pkg,
          activePackageIndex: index,
          editedNodes: new Map(),
          removedNodeIds: new Set(),
        });
        setSelectedPackageId(pkg.id);
      }
    },
    [session]
  );

  // Stage a saved package directly (not from session)
  const stageSavedPackage = useCallback(
    (pkg: NarrativePackage) => {
      setStaging({
        stagedPackage: pkg,
        activePackageIndex: -1, // Not from session
        editedNodes: new Map(),
        removedNodeIds: new Set(),
      });
    },
    []
  );

  // Clear staging state
  const clearStaging = useCallback(() => {
    setStaging({
      stagedPackage: null,
      activePackageIndex: -1,
      editedNodes: new Map(),
      removedNodeIds: new Set(),
    });
  }, []);

  // Update a node's data in staging
  const updateEditedNode = useCallback(
    (nodeId: string, updates: Partial<Record<string, unknown>>) => {
      setStaging((prev) => {
        const newEditedNodes = new Map(prev.editedNodes);
        const existing = newEditedNodes.get(nodeId) ?? {};
        newEditedNodes.set(nodeId, { ...existing, ...updates });
        return { ...prev, editedNodes: newEditedNodes };
      });
    },
    []
  );

  // Remove a proposed node from staging
  const removeProposedNode = useCallback((nodeId: string) => {
    setStaging((prev) => {
      const newRemovedIds = new Set(prev.removedNodeIds);
      newRemovedIds.add(nodeId);
      return { ...prev, removedNodeIds: newRemovedIds };
    });
  }, []);

  // Compute section change counts from staged package
  const sectionChangeCounts = useMemo(
    () => computeSectionChangeCounts(staging.stagedPackage),
    [staging.stagedPackage]
  );

  // Compute detailed element counts (by type: Character, Location, Object)
  const detailedElementCounts = useMemo(
    () => computeDetailedElementCounts(staging.stagedPackage),
    [staging.stagedPackage]
  );

  // Compute detailed structure counts (by act)
  const detailedStructureCounts = useMemo(
    () => computeDetailedStructureCounts(staging.stagedPackage),
    [staging.stagedPackage]
  );

  // Get the currently staged package (convenience getter)
  const stagedPackage = staging.stagedPackage;

  const value: GenerationContextValue = {
    session,
    loading,
    error,
    isOpen,
    propose,
    refinePackage,
    acceptPackage,
    rejectPackage,
    abandonSession,
    loadSession,
    openPanel,
    closePanel,
    selectedPackageId,
    selectPackage,
    refinableElements,
    regenerateElement,
    applyElementOption,
    updatePackageElement,
    validatePackage,
    applyFilteredPackage,
    // Staging state
    staging,
    sectionChangeCounts,
    detailedElementCounts,
    detailedStructureCounts,
    stagePackage,
    stageSavedPackage,
    clearStaging,
    updateEditedNode,
    removeProposedNode,
    stagedPackage,
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
