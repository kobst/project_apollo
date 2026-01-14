import type {
  NarrativePackage,
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
} from '../../api/types';
import styles from './PackageDetail.module.css';

interface PackageDetailProps {
  package: NarrativePackage;
  onAccept: () => void;
  onRefine: () => void;
  onReject: () => void;
  loading?: boolean;
}

// Categorize nodes
function categorizeNodes(nodes: NodeChangeAI[]): {
  storyElements: NodeChangeAI[];
  outline: NodeChangeAI[];
  other: NodeChangeAI[];
} {
  const storyElements: NodeChangeAI[] = [];
  const outline: NodeChangeAI[] = [];
  const other: NodeChangeAI[] = [];

  for (const node of nodes) {
    const type = node.node_type.toLowerCase();
    if (['character', 'location', 'object', 'setting'].includes(type)) {
      storyElements.push(node);
    } else if (['plotpoint', 'scene', 'beat', 'idea'].includes(type)) {
      outline.push(node);
    } else {
      other.push(node);
    }
  }

  return { storyElements, outline, other };
}

// Get operation display
function getOpDisplay(op: string): { icon: string; className: string } {
  switch (op) {
    case 'add':
      return { icon: '+', className: styles.opAdd };
    case 'modify':
      return { icon: '~', className: styles.opModify };
    case 'delete':
      return { icon: '-', className: styles.opDelete };
    default:
      return { icon: '?', className: '' };
  }
}

// Get node label
function getNodeLabel(node: NodeChangeAI): string {
  const data = node.data ?? {};
  return (
    (data.name as string) ??
    (data.title as string) ??
    (data.heading as string) ??
    node.node_id
  );
}

// Get node description
function getNodeDescription(node: NodeChangeAI): string | null {
  const data = node.data ?? {};
  return (
    (data.description as string) ??
    (data.summary as string) ??
    (data.scene_overview as string) ??
    (data.intent as string) ??
    null
  );
}

export function PackageDetail({
  package: pkg,
  onAccept,
  onRefine,
  onReject,
  loading = false,
}: PackageDetailProps) {
  const { storyElements, outline, other } = categorizeNodes(pkg.changes.nodes);
  const confidence = Math.round(pkg.confidence * 100);

  // Find related edges for a node
  const getRelatedEdges = (nodeId: string): EdgeChangeAI[] =>
    pkg.changes.edges.filter((e) => e.from === nodeId || e.to === nodeId);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h2 className={styles.title}>{pkg.title}</h2>
          <div
            className={`${styles.confidence} ${
              confidence >= 80
                ? styles.high
                : confidence >= 60
                  ? styles.medium
                  : styles.low
            }`}
          >
            {confidence}%
          </div>
        </div>
        <p className={styles.rationale}>{pkg.rationale}</p>
        {pkg.style_tags.length > 0 && (
          <div className={styles.tags}>
            {pkg.style_tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Story Context */}
        {pkg.changes.storyContext && pkg.changes.storyContext.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Story Context</h3>
            <div className={styles.sectionContent}>
              {pkg.changes.storyContext.map((change, idx) => (
                <StoryContextItem key={idx} change={change} />
              ))}
            </div>
          </section>
        )}

        {/* Story Elements */}
        {storyElements.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Story Elements</h3>
            <div className={styles.sectionContent}>
              {storyElements.map((node) => (
                <NodeItem
                  key={node.node_id}
                  node={node}
                  edges={getRelatedEdges(node.node_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Outline */}
        {outline.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Outline</h3>
            <div className={styles.sectionContent}>
              {outline.map((node) => (
                <NodeItem
                  key={node.node_id}
                  node={node}
                  edges={getRelatedEdges(node.node_id)}
                  expanded
                />
              ))}
            </div>
          </section>
        )}

        {/* Other */}
        {other.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Other</h3>
            <div className={styles.sectionContent}>
              {other.map((node) => (
                <NodeItem
                  key={node.node_id}
                  node={node}
                  edges={getRelatedEdges(node.node_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Impact */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Impact</h3>
          <div className={styles.impactContent}>
            {pkg.impact.fulfills_gaps.length > 0 && (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>✓</span>
                <span className={styles.impactLabel}>Fulfills:</span>
                <span className={styles.impactValue}>
                  {pkg.impact.fulfills_gaps.join(', ')}
                </span>
              </div>
            )}
            {pkg.impact.creates_gaps.length > 0 && (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>→</span>
                <span className={styles.impactLabel}>Creates:</span>
                <span className={styles.impactValue}>
                  {pkg.impact.creates_gaps.join(', ')}
                </span>
              </div>
            )}
            {pkg.impact.conflicts.length > 0 ? (
              <div className={styles.conflicts}>
                {pkg.impact.conflicts.map((conflict, idx) => (
                  <div key={idx} className={styles.conflictItem}>
                    <span className={styles.conflictIcon}>⚠</span>
                    <span className={styles.conflictType}>{conflict.type}:</span>
                    <span className={styles.conflictDesc}>
                      {conflict.description}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.impactRow}>
                <span className={styles.impactIcon}>✓</span>
                <span className={styles.impactValue}>No conflicts</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.rejectBtn}
          onClick={onReject}
          disabled={loading}
          type="button"
        >
          Reject
        </button>
        <button
          className={styles.refineBtn}
          onClick={onRefine}
          disabled={loading}
          type="button"
        >
          Refine...
        </button>
        <button
          className={styles.acceptBtn}
          onClick={onAccept}
          disabled={loading}
          type="button"
        >
          {loading ? 'Accepting...' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

// Story Context Item Component
function StoryContextItem({ change }: { change: StoryContextChange }) {
  const { icon, className } = getOpDisplay(change.operation);

  return (
    <div className={`${styles.itemCard} ${className}`}>
      <div className={styles.itemHeader}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.itemType}>{change.section}</span>
      </div>
      <p className={styles.itemContent}>"{change.content}"</p>
    </div>
  );
}

// Node Item Component
function NodeItem({
  node,
  edges,
  expanded = false,
}: {
  node: NodeChangeAI;
  edges: EdgeChangeAI[];
  expanded?: boolean;
}) {
  const { icon, className } = getOpDisplay(node.operation);
  const label = getNodeLabel(node);
  const description = expanded ? getNodeDescription(node) : null;

  return (
    <div className={`${styles.itemCard} ${className}`}>
      <div className={styles.itemHeader}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.itemType}>{node.node_type}:</span>
        <span className={styles.itemLabel}>{label}</span>
      </div>
      {description && <p className={styles.itemDescription}>{description}</p>}
      {edges.length > 0 && (
        <div className={styles.edges}>
          {edges.map((edge, idx) => (
            <div key={idx} className={styles.edge}>
              <span className={styles.edgeIcon}>└─</span>
              <span className={styles.edgeType}>{edge.edge_type}</span>
              <span className={styles.edgeArrow}>→</span>
              <span className={styles.edgeTarget}>
                {edge.from === node.node_id ? edge.to : edge.from}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
