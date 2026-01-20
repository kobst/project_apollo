/**
 * PackageStaging - Review and commit/save/discard generated packages
 *
 * Provides a staging area for reviewing AI-generated packages before
 * committing them to the story graph.
 */

import { useState, useMemo, useCallback } from 'react';
import type { NarrativePackage, GenerationSession } from '../../api/types';
import styles from './PackageStaging.module.css';

interface PackageStagingProps {
  /** The current generation session */
  session: GenerationSession;
  /** Currently selected package ID */
  selectedPackageId: string | null;
  /** Called when package selection changes */
  onSelectPackage: (packageId: string) => void;
  /** Called when user commits (accepts) a package */
  onCommit: (packageId: string) => void;
  /** Called when user saves a package for later */
  onSave?: (packageId: string) => void;
  /** Called when user discards (rejects) a package */
  onDiscard: (packageId: string) => void;
  /** Called when user wants to refine a package */
  onRefine: (packageId: string) => void;
  /** Called when user discards the entire session */
  onDiscardAll: () => void;
  /** Loading state */
  loading?: boolean;
}

// Get change counts for display
function getChangeCounts(pkg: NarrativePackage): { nodes: number; edges: number; context: number } {
  return {
    nodes: pkg.changes.nodes.length,
    edges: pkg.changes.edges.length,
    context: pkg.changes.storyContext?.length ?? 0,
  };
}

// Get impact summary
function getImpactSummary(pkg: NarrativePackage): string[] {
  const impacts: string[] = [];

  if (pkg.impact.fulfills_gaps.length > 0) {
    impacts.push(`Fills ${pkg.impact.fulfills_gaps.length} gap(s)`);
  }
  if (pkg.impact.conflicts.length > 0) {
    impacts.push(`${pkg.impact.conflicts.length} conflict(s)`);
  }

  return impacts;
}

export function PackageStaging({
  session,
  selectedPackageId,
  onSelectPackage,
  onCommit,
  onSave,
  onDiscard,
  onRefine,
  onDiscardAll,
  loading = false,
}: PackageStagingProps) {
  const [expandedId, setExpandedId] = useState<string | null>(selectedPackageId);

  // Get root packages (no parent)
  const rootPackages = useMemo(
    () => session.packages.filter((p) => !p.parent_package_id),
    [session.packages]
  );

  // Get children of a package
  const getChildren = useCallback(
    (parentId: string) => session.packages.filter((p) => p.parent_package_id === parentId),
    [session.packages]
  );

  // Get selected package
  const selectedPackage = useMemo(
    () => session.packages.find((p) => p.id === selectedPackageId),
    [session.packages, selectedPackageId]
  );

  // Handle package click
  const handleSelect = useCallback(
    (packageId: string) => {
      onSelectPackage(packageId);
      setExpandedId(packageId);
    },
    [onSelectPackage]
  );

  // Handle commit
  const handleCommit = useCallback(() => {
    if (selectedPackageId) {
      onCommit(selectedPackageId);
    }
  }, [selectedPackageId, onCommit]);

  // Handle save
  const handleSave = useCallback(() => {
    if (selectedPackageId && onSave) {
      onSave(selectedPackageId);
    }
  }, [selectedPackageId, onSave]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    if (selectedPackageId) {
      onDiscard(selectedPackageId);
    }
  }, [selectedPackageId, onDiscard]);

  // Handle refine
  const handleRefine = useCallback(() => {
    if (selectedPackageId) {
      onRefine(selectedPackageId);
    }
  }, [selectedPackageId, onRefine]);

  // Render a package item
  const renderPackageItem = (pkg: NarrativePackage, depth: number = 0) => {
    const isSelected = pkg.id === selectedPackageId;
    const isExpanded = pkg.id === expandedId;
    const counts = getChangeCounts(pkg);
    const impacts = getImpactSummary(pkg);
    const children = getChildren(pkg.id);
    const hasConflicts = pkg.impact.conflicts.length > 0;

    return (
      <div key={pkg.id} className={styles.packageGroup}>
        <button
          className={`${styles.packageItem} ${isSelected ? styles.selected : ''} ${hasConflicts ? styles.hasConflicts : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleSelect(pkg.id)}
          type="button"
        >
          <div className={styles.packageHeader}>
            <span className={styles.packageIndicator}>
              {isSelected ? '●' : '○'}
            </span>
            <span className={styles.packageTitle}>{pkg.title}</span>
            <span className={styles.packageConfidence}>
              {Math.round(pkg.confidence * 100)}%
            </span>
          </div>

          {isExpanded && (
            <div className={styles.packageDetails}>
              <p className={styles.packageRationale}>{pkg.rationale}</p>
              <div className={styles.packageMeta}>
                <span className={styles.changeBadge}>
                  {counts.nodes} node{counts.nodes !== 1 ? 's' : ''}
                </span>
                {counts.edges > 0 && (
                  <span className={styles.changeBadge}>
                    {counts.edges} edge{counts.edges !== 1 ? 's' : ''}
                  </span>
                )}
                {counts.context > 0 && (
                  <span className={styles.changeBadge}>
                    {counts.context} context
                  </span>
                )}
              </div>
              {impacts.length > 0 && (
                <div className={styles.impacts}>
                  {impacts.map((impact, i) => (
                    <span
                      key={i}
                      className={`${styles.impactBadge} ${impact.includes('conflict') ? styles.conflict : styles.positive}`}
                    >
                      {impact}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Render children (refinements) */}
        {children.length > 0 && (
          <div className={styles.children}>
            {children.map((child) => renderPackageItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (session.packages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No packages to review</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Review Packages</h3>
        <span className={styles.count}>{session.packages.length} package(s)</span>
      </div>

      {/* Package list */}
      <div className={styles.packageList}>
        {rootPackages.map((pkg) => renderPackageItem(pkg))}
      </div>

      {/* Selected package preview */}
      {selectedPackage && (
        <div className={styles.preview}>
          <h4 className={styles.previewTitle}>{selectedPackage.title}</h4>
          <p className={styles.previewRationale}>{selectedPackage.rationale}</p>

          {/* Changes breakdown */}
          <div className={styles.changesSection}>
            <h5 className={styles.changesSectionTitle}>Changes</h5>

            {selectedPackage.changes.nodes.length > 0 && (
              <div className={styles.changeGroup}>
                <span className={styles.changeGroupLabel}>Nodes:</span>
                <ul className={styles.changeList}>
                  {selectedPackage.changes.nodes.slice(0, 5).map((node, i) => (
                    <li key={i} className={styles.changeItem}>
                      <span className={`${styles.changeOp} ${styles[node.operation]}`}>
                        {node.operation}
                      </span>
                      <span className={styles.changeType}>{node.node_type}</span>
                      <span className={styles.changeLabel}>
                        {(node.data?.name as string) || (node.data?.title as string) || (node.data?.label as string) || node.node_id}
                      </span>
                    </li>
                  ))}
                  {selectedPackage.changes.nodes.length > 5 && (
                    <li className={styles.moreItems}>
                      +{selectedPackage.changes.nodes.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {selectedPackage.changes.edges.length > 0 && (
              <div className={styles.changeGroup}>
                <span className={styles.changeGroupLabel}>Edges:</span>
                <ul className={styles.changeList}>
                  {selectedPackage.changes.edges.slice(0, 3).map((edge, i) => (
                    <li key={i} className={styles.changeItem}>
                      <span className={`${styles.changeOp} ${styles[edge.operation]}`}>
                        {edge.operation}
                      </span>
                      <span className={styles.changeType}>{edge.edge_type}</span>
                    </li>
                  ))}
                  {selectedPackage.changes.edges.length > 3 && (
                    <li className={styles.moreItems}>
                      +{selectedPackage.changes.edges.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Conflicts warning */}
          {selectedPackage.impact.conflicts.length > 0 && (
            <div className={styles.conflictsSection}>
              <h5 className={styles.conflictsTitle}>Conflicts</h5>
              <ul className={styles.conflictsList}>
                {selectedPackage.impact.conflicts.map((conflict, i) => (
                  <li key={i} className={styles.conflictItem}>
                    {conflict.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.discardAllBtn}
          onClick={onDiscardAll}
          disabled={loading}
          type="button"
        >
          Discard All
        </button>

        <div className={styles.actionsSpacer} />

        <button
          className={styles.discardBtn}
          onClick={handleDiscard}
          disabled={loading || !selectedPackageId}
          type="button"
        >
          Discard
        </button>

        {onSave && (
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={loading || !selectedPackageId}
            type="button"
          >
            Save
          </button>
        )}

        <button
          className={styles.refineBtn}
          onClick={handleRefine}
          disabled={loading || !selectedPackageId}
          type="button"
        >
          Refine
        </button>

        <button
          className={styles.commitBtn}
          onClick={handleCommit}
          disabled={loading || !selectedPackageId}
          type="button"
        >
          {loading ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </div>
  );
}

export default PackageStaging;
