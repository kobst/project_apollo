/**
 * ExpandOptions - Options for Expand generation mode.
 * Elaborate on story context or a selected node.
 */

import styles from './ModeOptions.module.css';

export type ExpandTargetType = 'story-context' | 'story-context-section' | 'node';
export type ContextSection =
  | 'genre-tone'
  | 'setting'
  | 'themes'
  | 'backstory'
  | 'worldbuilding'
  | 'rules';
export type ExpandDepth = 'surface' | 'deep';

export interface ExpandOptionsState {
  targetType: ExpandTargetType;
  contextSection?: ContextSection | undefined;
  nodeId?: string | undefined;
  nodeType?: string | undefined;
  nodeName?: string | undefined;
  depth: ExpandDepth;
}

interface NodeInfo {
  id: string;
  type: string;
  name: string;
}

interface ExpandOptionsProps {
  /** Current options state */
  value: ExpandOptionsState;
  /** Callback when options change */
  onChange: (options: ExpandOptionsState) => void;
  /** Currently selected node in the Story Bible (if any) */
  selectedNode?: NodeInfo | undefined;
  /** Whether controls are disabled */
  disabled?: boolean;
}

const CONTEXT_SECTIONS: { value: ContextSection; label: string }[] = [
  { value: 'genre-tone', label: 'Genre & Tone' },
  { value: 'setting', label: 'Setting' },
  { value: 'themes', label: 'Themes' },
  { value: 'backstory', label: 'Backstory' },
  { value: 'worldbuilding', label: 'Worldbuilding' },
  { value: 'rules', label: 'Rules & Constraints' },
];

export function ExpandOptions({
  value,
  onChange,
  selectedNode,
  disabled = false,
}: ExpandOptionsProps) {
  const handleTargetTypeChange = (targetType: ExpandTargetType) => {
    const updates: Partial<ExpandOptionsState> = { targetType };

    // Clear irrelevant fields based on target type
    if (targetType === 'story-context') {
      updates.contextSection = undefined;
      updates.nodeId = undefined;
      updates.nodeType = undefined;
      updates.nodeName = undefined;
    } else if (targetType === 'story-context-section') {
      updates.contextSection = value.contextSection ?? 'genre-tone';
      updates.nodeId = undefined;
      updates.nodeType = undefined;
      updates.nodeName = undefined;
    } else if (targetType === 'node') {
      updates.contextSection = undefined;
      // If we have a selected node, use it
      if (selectedNode) {
        updates.nodeId = selectedNode.id;
        updates.nodeType = selectedNode.type;
        updates.nodeName = selectedNode.name;
      }
    }

    onChange({ ...value, ...updates });
  };

  const handleSectionChange = (section: ContextSection) => {
    onChange({ ...value, contextSection: section });
  };

  const handleDepthChange = (depth: ExpandDepth) => {
    onChange({ ...value, depth });
  };

  // Sync with selectedNode when it changes
  const useSelectedNode = () => {
    if (selectedNode && value.targetType === 'node') {
      onChange({
        ...value,
        nodeId: selectedNode.id,
        nodeType: selectedNode.type,
        nodeName: selectedNode.name,
      });
    }
  };

  return (
    <div className={styles.container}>
      {/* Target Type Radio Group */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>Target</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="expandTarget"
              value="story-context"
              checked={value.targetType === 'story-context'}
              onChange={() => handleTargetTypeChange('story-context')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>Story Context</span>
            <span className={styles.radioHint}>Expand the overall story context</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="expandTarget"
              value="story-context-section"
              checked={value.targetType === 'story-context-section'}
              onChange={() => handleTargetTypeChange('story-context-section')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>Context Section</span>
            <span className={styles.radioHint}>Focus on a specific section</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="expandTarget"
              value="node"
              checked={value.targetType === 'node'}
              onChange={() => handleTargetTypeChange('node')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>Selected Node</span>
            <span className={styles.radioHint}>Expand a specific element</span>
          </label>
        </div>
      </div>

      {/* Context Section Selector */}
      {value.targetType === 'story-context-section' && (
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Section</label>
          <select
            className={styles.select}
            value={value.contextSection ?? 'genre-tone'}
            onChange={(e) => handleSectionChange(e.target.value as ContextSection)}
            disabled={disabled}
          >
            {CONTEXT_SECTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Node Selection Display */}
      {value.targetType === 'node' && (
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Selected Element</label>
          {value.nodeId ? (
            <div className={styles.selectedNode}>
              <span className={styles.nodeType}>{value.nodeType}</span>
              <span className={styles.nodeName}>{value.nodeName}</span>
            </div>
          ) : selectedNode ? (
            <div className={styles.nodePrompt}>
              <p>
                Use: <strong>{selectedNode.name}</strong> ({selectedNode.type})
              </p>
              <button
                type="button"
                className={styles.useNodeButton}
                onClick={useSelectedNode}
                disabled={disabled}
              >
                Use Selected
              </button>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No element selected.</p>
              <p className={styles.emptyHint}>
                Click an element in the Story Bible to select it.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Depth Selection */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>Depth</label>
        <div className={styles.depthToggle}>
          <button
            type="button"
            className={`${styles.depthOption} ${value.depth === 'surface' ? styles.selected : ''}`}
            onClick={() => handleDepthChange('surface')}
            disabled={disabled}
          >
            <span className={styles.depthLabel}>Surface</span>
            <span className={styles.depthHint}>Quick elaboration</span>
          </button>
          <button
            type="button"
            className={`${styles.depthOption} ${value.depth === 'deep' ? styles.selected : ''}`}
            onClick={() => handleDepthChange('deep')}
            disabled={disabled}
          >
            <span className={styles.depthLabel}>Deep</span>
            <span className={styles.depthHint}>Thorough exploration</span>
          </button>
        </div>
      </div>
    </div>
  );
}
