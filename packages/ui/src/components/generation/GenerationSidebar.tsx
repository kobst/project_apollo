import { useState, useCallback } from 'react';
import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import type {
  GenerationEntryPoint,
  GenerationDepth,
  GenerationCount,
  NarrativePackage,
} from '../../api/types';
import styles from './GenerationSidebar.module.css';

interface GenerationSidebarProps {
  selectedPackageId: string | null;
  onSelectPackage: (packageId: string) => void;
}

// Entry point options
const ENTRY_POINTS = [
  { type: 'naked' as const, label: 'Auto (AI decides)' },
  { type: 'beat' as const, label: 'Beat' },
  { type: 'plotPoint' as const, label: 'Plot Point' },
  { type: 'character' as const, label: 'Character' },
  { type: 'gap' as const, label: 'Gap' },
  { type: 'idea' as const, label: 'Idea' },
];

const DEPTH_OPTIONS: { value: GenerationDepth; label: string }[] = [
  { value: 'narrow', label: 'Focused' },
  { value: 'medium', label: 'Standard' },
  { value: 'wide', label: 'Expansive' },
];

const COUNT_OPTIONS: { value: GenerationCount; label: string; count: string }[] = [
  { value: 'few', label: 'Quick', count: '3' },
  { value: 'standard', label: 'Explore', count: '5' },
  { value: 'many', label: 'Deep', count: '8' },
];

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
}: GenerationSidebarProps) {
  const { currentStoryId } = useStory();
  const { session, loading, startGeneration } = useGeneration();

  // Generation controls state
  const [entryType, setEntryType] = useState<GenerationEntryPoint['type']>('naked');
  const [depth, setDepth] = useState<GenerationDepth>('medium');
  const [count, setCount] = useState<GenerationCount>('standard');
  const [direction, setDirection] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!currentStoryId) return;

    const entryPoint: GenerationEntryPoint = { type: entryType };
    await startGeneration(currentStoryId, {
      entryPoint,
      depth,
      count,
      direction: direction.trim() || undefined,
    });
  }, [currentStoryId, entryType, depth, count, direction, startGeneration]);

  const packageTree = session ? buildPackageTree(session.packages) : [];

  // Render package tree node
  const renderPackageNode = (node: PackageNode, level: number = 0) => {
    const isSelected = node.pkg.id === selectedPackageId;
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

      {/* Divider */}
      <div className={styles.divider} />

      {/* Generation Controls */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>New Generation</h3>

        {/* Entry Point */}
        <div className={styles.control}>
          <label className={styles.controlLabel}>Entry Point</label>
          <select
            className={styles.select}
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as GenerationEntryPoint['type'])}
            disabled={loading}
          >
            {ENTRY_POINTS.map((ep) => (
              <option key={ep.type} value={ep.type}>
                {ep.label}
              </option>
            ))}
          </select>
        </div>

        {/* Depth */}
        <div className={styles.control}>
          <label className={styles.controlLabel}>Depth</label>
          <div className={styles.radioGroup}>
            {DEPTH_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`${styles.radioOption} ${depth === opt.value ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="depth"
                  value={opt.value}
                  checked={depth === opt.value}
                  onChange={() => setDepth(opt.value)}
                  disabled={loading}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className={styles.control}>
          <label className={styles.controlLabel}>Options</label>
          <div className={styles.radioGroup}>
            {COUNT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`${styles.radioOption} ${count === opt.value ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="count"
                  value={opt.value}
                  checked={count === opt.value}
                  onChange={() => setCount(opt.value)}
                  disabled={loading}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>
                  {opt.label} ({opt.count})
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Direction */}
        <div className={styles.control}>
          <label className={styles.controlLabel}>Direction</label>
          <textarea
            className={styles.textarea}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="Focus on betrayal themes..."
            rows={2}
            disabled={loading}
          />
        </div>

        {/* Generate Button */}
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={loading || !currentStoryId}
          type="button"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
