import type { NodeData, GapData } from '../../api/types';
import styles from './NodeCardGrid.module.css';

interface NodeCardGridProps {
  nodes: NodeData[];
  gaps: GapData[];
  onSelectNode: (node: NodeData) => void;
  categoryLabel: string;
}

export function NodeCardGrid({ nodes, gaps, onSelectNode, categoryLabel }: NodeCardGridProps) {
  // Build a map of nodeId -> gaps for that node
  const gapsByNode = new Map<string, GapData[]>();
  for (const gap of gaps) {
    const nodeIds = gap.scopeRefs?.nodeIds ?? [];
    for (const nodeId of nodeIds) {
      const existing = gapsByNode.get(nodeId) ?? [];
      existing.push(gap);
      gapsByNode.set(nodeId, existing);
    }
  }

  // Category-level gaps (not tied to specific nodes)
  const categoryGaps = gaps.filter(g => !g.scopeRefs?.nodeIds?.length);

  if (nodes.length === 0 && categoryGaps.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No {categoryLabel.toLowerCase()} found</p>
        <p className={styles.hint}>Use the extraction panel to add new elements</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Category-level gaps banner */}
      {categoryGaps.length > 0 && (
        <div className={styles.categoryGaps}>
          {categoryGaps.map(gap => (
            <div
              key={gap.id}
              className={`${styles.gapBanner} ${styles[gap.severity]}`}
            >
              <span className={styles.gapIcon}>{getSeverityIcon(gap.severity)}</span>
              <span className={styles.gapTitle}>{gap.title}</span>
              <span className={styles.gapMessage}>{gap.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Card grid */}
      <div className={styles.grid}>
        {nodes.map(node => {
          const nodeGaps = gapsByNode.get(node.id) ?? [];
          const worstSeverity = getWorstSeverity(nodeGaps);

          return (
            <button
              key={node.id}
              className={styles.card}
              onClick={() => onSelectNode(node)}
              type="button"
            >
              {/* Gap indicator */}
              {worstSeverity && (
                <div className={`${styles.gapIndicator} ${styles[worstSeverity]}`}>
                  {getSeverityIcon(worstSeverity)}
                  {nodeGaps.length > 1 && <span className={styles.gapCount}>{nodeGaps.length}</span>}
                </div>
              )}

              {/* Card content */}
              <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>{node.label}</span>
                <span className={styles.cardType}>{node.type}</span>
              </div>

              <div className={styles.cardBody}>
                {getNodePreview(node)}
              </div>

              {/* Gap tooltips on hover */}
              {nodeGaps.length > 0 && (
                <div className={styles.gapTooltip}>
                  {nodeGaps.map(g => (
                    <div key={g.id} className={styles.gapTooltipItem}>
                      <span className={`${styles.tooltipIcon} ${styles[g.severity]}`}>
                        {getSeverityIcon(g.severity)}
                      </span>
                      {g.title}
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'blocker': return '!';
    case 'warn': return '?';
    case 'info': return 'i';
    default: return '';
  }
}

function getWorstSeverity(gaps: GapData[]): string | null {
  if (gaps.length === 0) return null;
  if (gaps.some(g => g.severity === 'blocker')) return 'blocker';
  if (gaps.some(g => g.severity === 'warn')) return 'warn';
  if (gaps.some(g => g.severity === 'info')) return 'info';
  return null;
}

function getNodePreview(node: NodeData): string {
  const data = node.data;

  // For Scene: show heading or overview
  if (node.type === 'Scene') {
    if (typeof data.scene_overview === 'string') {
      return truncate(data.scene_overview, 120);
    }
    if (typeof data.heading === 'string' && data.heading !== node.label) {
      return data.heading;
    }
  }

  // Try various common fields
  if (typeof data.description === 'string') {
    return truncate(data.description, 120);
  }
  if (typeof data.overview === 'string') {
    return truncate(data.overview, 120);
  }
  if (typeof data.logline === 'string') {
    return truncate(data.logline, 120);
  }
  if (typeof data.archetype === 'string') {
    return `Archetype: ${data.archetype}`;
  }
  if (typeof data.beatName === 'string') {
    return `Beat: ${data.beatName}`;
  }
  if (typeof data.genre === 'string') {
    return `Genre: ${data.genre}`;
  }
  if (typeof data.tone === 'string') {
    return `Tone: ${data.tone}`;
  }

  return 'Click to view details';
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
