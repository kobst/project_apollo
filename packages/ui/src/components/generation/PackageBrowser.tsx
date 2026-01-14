import { useState, useMemo, useCallback } from 'react';
import type { NarrativePackage, GenerationSession } from '../../api/types';
import { PackageCard } from './PackageCard';
import styles from './PackageBrowser.module.css';

interface PackageBrowserProps {
  /** Current generation session */
  session: GenerationSession;
  /** Called when user accepts a package */
  onAccept: (packageId: string) => void;
  /** Called when user wants to refine a package */
  onRefine: (packageId: string) => void;
  /** Called when user rejects a package */
  onReject: (packageId: string) => void;
  /** Called when user wants to regenerate all packages */
  onRegenerate: () => void;
  /** Called when user abandons the session */
  onAbandon: () => void;
  /** Loading state */
  loading?: boolean;
}

// Build a tree structure from flat packages list
interface PackageTreeNode {
  package: NarrativePackage;
  children: PackageTreeNode[];
}

function buildPackageTree(packages: NarrativePackage[]): PackageTreeNode[] {
  const nodeMap = new Map<string, PackageTreeNode>();
  const roots: PackageTreeNode[] = [];

  // Create nodes
  for (const pkg of packages) {
    nodeMap.set(pkg.id, { package: pkg, children: [] });
  }

  // Build tree
  for (const pkg of packages) {
    const node = nodeMap.get(pkg.id)!;
    if (pkg.parent_package_id) {
      const parent = nodeMap.get(pkg.parent_package_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// Get path from root to a package
function getPathToPackage(
  packages: NarrativePackage[],
  targetId: string
): string[] {
  const path: string[] = [];
  let currentId: string | undefined = targetId;

  while (currentId) {
    path.unshift(currentId);
    const pkg = packages.find((p) => p.id === currentId);
    currentId = pkg?.parent_package_id;
  }

  return path;
}

// Get siblings of a package
function getSiblings(
  packages: NarrativePackage[],
  packageId: string
): NarrativePackage[] {
  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) return [];

  return packages.filter(
    (p) => p.parent_package_id === pkg.parent_package_id && p.id !== packageId
  );
}

// Get children of a package
function getChildren(
  packages: NarrativePackage[],
  packageId: string
): NarrativePackage[] {
  return packages.filter((p) => p.parent_package_id === packageId);
}

export function PackageBrowser({
  session,
  onAccept,
  onRefine,
  onReject,
  onRegenerate,
  onAbandon,
  loading = false,
}: PackageBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    session.currentPackageId ?? session.packages[0]?.id ?? null
  );

  // Build tree and get current context
  const tree = useMemo(() => buildPackageTree(session.packages), [session.packages]);

  const selectedPackage = useMemo(
    () => session.packages.find((p) => p.id === selectedId),
    [session.packages, selectedId]
  );

  const path = useMemo(
    () => (selectedId ? getPathToPackage(session.packages, selectedId) : []),
    [session.packages, selectedId]
  );

  const siblings = useMemo(
    () => (selectedId ? getSiblings(session.packages, selectedId) : []),
    [session.packages, selectedId]
  );

  const children = useMemo(
    () => (selectedId ? getChildren(session.packages, selectedId) : []),
    [session.packages, selectedId]
  );

  // Navigation
  const navigateUp = useCallback(() => {
    if (selectedPackage?.parent_package_id) {
      setSelectedId(selectedPackage.parent_package_id);
    }
  }, [selectedPackage]);

  const navigateToRoot = useCallback(() => {
    const firstNode = tree[0];
    if (firstNode) {
      setSelectedId(firstNode.package.id);
    }
  }, [tree]);

  // Actions
  const handleAccept = useCallback(() => {
    if (selectedId) {
      onAccept(selectedId);
    }
  }, [selectedId, onAccept]);

  const handleRefine = useCallback(() => {
    if (selectedId) {
      onRefine(selectedId);
    }
  }, [selectedId, onRefine]);

  const handleReject = useCallback(() => {
    if (selectedId) {
      onReject(selectedId);
      // Select next sibling or parent
      const firstSibling = siblings[0];
      if (firstSibling) {
        setSelectedId(firstSibling.id);
      } else if (selectedPackage?.parent_package_id) {
        setSelectedId(selectedPackage.parent_package_id);
      } else {
        const remaining = session.packages.filter((p) => p.id !== selectedId);
        setSelectedId(remaining[0]?.id ?? null);
      }
    }
  }, [selectedId, onReject, siblings, selectedPackage, session.packages]);

  if (session.packages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No packages generated yet.</p>
          <button
            className={styles.regenerateBtn}
            onClick={onRegenerate}
            disabled={loading}
            type="button"
          >
            Generate Packages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Generated Packages</h2>
          <span className={styles.count}>
            {session.packages.length} package(s)
          </span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.regenerateBtn}
            onClick={onRegenerate}
            disabled={loading}
            type="button"
          >
            Regenerate All
          </button>
          <button
            className={styles.abandonBtn}
            onClick={onAbandon}
            disabled={loading}
            type="button"
          >
            Abandon
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      {path.length > 1 && (
        <div className={styles.breadcrumb}>
          <button
            className={styles.breadcrumbItem}
            onClick={navigateToRoot}
            type="button"
          >
            Root
          </button>
          {path.slice(0, -1).map((id) => {
            const pkg = session.packages.find((p) => p.id === id);
            return (
              <span key={id}>
                <span className={styles.breadcrumbSep}>›</span>
                <button
                  className={styles.breadcrumbItem}
                  onClick={() => setSelectedId(id)}
                  type="button"
                >
                  {pkg?.title.slice(0, 20) ?? id.slice(-8)}
                </button>
              </span>
            );
          })}
          <span className={styles.breadcrumbSep}>›</span>
          <span className={styles.breadcrumbCurrent}>
            {selectedPackage?.title.slice(0, 20)}
          </span>
        </div>
      )}

      {/* Package tabs (siblings + self) */}
      <div className={styles.tabs}>
        {/* Root packages or siblings of current */}
        {(path.length === 1 ? tree.map((n) => n.package) : [selectedPackage!, ...siblings]).map(
          (pkg) => (
            <button
              key={pkg.id}
              className={`${styles.tab} ${pkg.id === selectedId ? styles.tabActive : ''}`}
              onClick={() => setSelectedId(pkg.id)}
              type="button"
            >
              {pkg.title.length > 25 ? `${pkg.title.slice(0, 25)}...` : pkg.title}
            </button>
          )
        )}
      </div>

      {/* Children indicator */}
      {children.length > 0 && (
        <div className={styles.childrenIndicator}>
          <span className={styles.childrenLabel}>Refinements:</span>
          {children.map((child) => (
            <button
              key={child.id}
              className={styles.childBtn}
              onClick={() => setSelectedId(child.id)}
              type="button"
            >
              {child.title.slice(0, 20)}
            </button>
          ))}
        </div>
      )}

      {/* Selected package */}
      {selectedPackage && (
        <div className={styles.selectedPackage}>
          <PackageCard package={selectedPackage} selected expanded />
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {selectedPackage?.parent_package_id && (
          <button
            className={styles.backBtn}
            onClick={navigateUp}
            type="button"
          >
            ← Back
          </button>
        )}
        <div className={styles.actionsSpacer} />
        <button
          className={styles.rejectBtn}
          onClick={handleReject}
          disabled={loading || !selectedId}
          type="button"
        >
          Reject
        </button>
        <button
          className={styles.refineBtn}
          onClick={handleRefine}
          disabled={loading || !selectedId}
          type="button"
        >
          Refine...
        </button>
        <button
          className={styles.acceptBtn}
          onClick={handleAccept}
          disabled={loading || !selectedId}
          type="button"
        >
          {loading ? 'Accepting...' : 'Accept Package'}
        </button>
      </div>
    </div>
  );
}
