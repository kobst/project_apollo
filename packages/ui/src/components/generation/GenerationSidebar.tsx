import { useGeneration } from '../../context/GenerationContext';
import type { NarrativePackage, SavedPackageData } from '../../api/types';
import { SavedPackagesPanel } from './SavedPackagesPanel';
import styles from './GenerationSidebar.module.css';

interface GenerationSidebarProps {
  selectedPackageId: string | null;
  onSelectPackage: (packageId: string | null) => void;
  savedPackages?: SavedPackageData[];
  savedPackagesLoading?: boolean;
  onApplySavedPackage?: (savedPackageId: string) => void;
  onDeleteSavedPackage?: (savedPackageId: string) => void;
  onViewSavedPackage?: (savedPkg: SavedPackageData) => void;
  viewingSavedPackageId?: string | null;
  onNewProposal?: () => void;
  isComposing?: boolean;
}

// Build tree structure from packages
interface PackageNode {
  pkg: NarrativePackage;
  children: PackageNode[];
}

function buildPackageTree(packages: NarrativePackage[]): PackageNode[] {
  const nodeMap = new Map<string, PackageNode>();
  const roots: PackageNode[] = [];

  for (const pkg of packages) {
    nodeMap.set(pkg.id, { pkg, children: [] });
  }

  for (const pkg of packages) {
    const node = nodeMap.get(pkg.id)!;
    if (pkg.parent_package_id) {
      const parent = nodeMap.get(pkg.parent_package_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function GenerationSidebar({
  selectedPackageId,
  onSelectPackage,
  savedPackages = [],
  savedPackagesLoading = false,
  onApplySavedPackage,
  onDeleteSavedPackage,
  onViewSavedPackage,
  viewingSavedPackageId,
  onNewProposal,
  isComposing = false,
}: GenerationSidebarProps) {
  const { session, loading } = useGeneration();

  const packageTree = session ? buildPackageTree(session.packages) : [];

  // Render package tree node
  const renderPackageNode = (node: PackageNode, level: number = 0) => {
    const isSelected = node.pkg.id === selectedPackageId && !isComposing;
    const confidence = Math.round(node.pkg.confidence * 100);

    return (
      <div key={node.pkg.id}>
        <button
          className={`${styles.packageItem} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => onSelectPackage(node.pkg.id)}
          type="button"
        >
          <span className={styles.packageIndicator}>
            {isSelected ? '●' : '○'}
          </span>
          <span className={styles.packageTitle}>
            {node.pkg.title.length > 20
              ? `${node.pkg.title.slice(0, 20)}...`
              : node.pkg.title}
          </span>
          <span className={styles.packageConfidence}>{confidence}%</span>
        </button>
        {node.children.length > 0 && (
          <div className={styles.packageChildren}>
            {node.children.map((child) => renderPackageNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.sidebar}>
      {/* Sessions Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Sessions</h3>
        <div className={styles.sessionsList}>
          {session ? (
            <div className={styles.sessionItem + ' ' + styles.active}>
              <span className={styles.sessionIndicator}>●</span>
              <span className={styles.sessionLabel}>
                Active ({session.packages.length} pkg)
              </span>
            </div>
          ) : (
            <div className={styles.emptyState}>No active session</div>
          )}
        </div>
      </div>

      {/* Packages Section */}
      {session && session.packages.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Packages</h3>
          <div className={styles.packagesList}>
            {packageTree.map((node) => renderPackageNode(node))}
          </div>
        </div>
      )}

      {/* Saved Packages Section */}
      {savedPackages.length > 0 && onApplySavedPackage && onDeleteSavedPackage && onViewSavedPackage && (
        <SavedPackagesPanel
          packages={savedPackages}
          loading={savedPackagesLoading}
          onApply={onApplySavedPackage}
          onDelete={onDeleteSavedPackage}
          onView={onViewSavedPackage}
          viewingPackageId={viewingSavedPackageId}
        />
      )}

      {/* Divider */}
      <div className={styles.divider} />

      {/* New Proposal Button - hidden when already composing */}
      {onNewProposal && !isComposing && (
        <div className={styles.section}>
          <button
            className={styles.newProposalBtn}
            onClick={onNewProposal}
            disabled={loading}
            type="button"
          >
            {loading ? 'Generating...' : 'New Proposal'}
          </button>
        </div>
      )}
    </div>
  );
}
