import type {
  NarrativePackage,
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
  StoryContextChangeOperation,
  ConflictInfo,
} from '../../api/types';
import styles from './PackageCard.module.css';

// Get operation category from structured operation
function getOperationCategory(op: StoryContextChangeOperation): 'add' | 'modify' | 'delete' {
  if (op.type.startsWith('add') || op.type.startsWith('set')) {
    return 'add';
  }
  if (op.type.startsWith('update')) {
    return 'modify';
  }
  if (op.type.startsWith('remove')) {
    return 'delete';
  }
  return 'add';
}

// Get label for operation type
function getOperationLabel(op: StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return op.field;
    case 'addThematicPillar':
    case 'removeThematicPillar':
    case 'setThematicPillars':
      return 'Pillar';
    case 'addBanned':
    case 'removeBanned':
    case 'setBanned':
      return 'Banned';
    case 'addHardRule':
    case 'updateHardRule':
    case 'removeHardRule':
      return 'Rule';
    case 'addGuideline':
    case 'updateGuideline':
    case 'removeGuideline':
      return 'Guideline';
    case 'setWorkingNotes':
      return 'Notes';
    default:
      return 'Context';
  }
}

// Get content preview from operation
function getOperationContent(op: StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return op.value;
    case 'addThematicPillar':
      return op.pillar;
    case 'setThematicPillars':
      return op.pillars.join(', ');
    case 'addBanned':
      return op.item;
    case 'setBanned':
      return op.banned.join(', ');
    case 'addHardRule':
      return op.rule.text;
    case 'updateHardRule':
      return op.text;
    case 'addGuideline':
      return op.guideline.text;
    case 'updateGuideline':
      return op.changes.text ?? op.id;
    case 'setWorkingNotes':
      return op.content;
    default:
      return '';
  }
}

interface PackageCardProps {
  /** The package to display */
  package: NarrativePackage;
  /** Whether this package is selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Show full details or summary */
  expanded?: boolean;
}

// Group node changes by category
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
    } else if (['storybeat', 'scene', 'beat', 'idea'].includes(type)) {
      outline.push(node);
    } else {
      other.push(node);
    }
  }

  return { storyElements, outline, other };
}

// Get operation icon
function getOpIcon(operation: string): string {
  switch (operation) {
    case 'add':
      return '+';
    case 'modify':
      return '~';
    case 'delete':
      return '-';
    default:
      return '?';
  }
}

// Get operation class
function getOpClass(operation: string): string {
  switch (operation) {
    case 'add':
      return styles.opAdd ?? '';
    case 'modify':
      return styles.opModify ?? '';
    case 'delete':
      return styles.opDelete ?? '';
    default:
      return '';
  }
}

// Get node label from data
function getNodeLabel(node: NodeChangeAI): string {
  const data = node.data ?? {};
  return (
    (data.name as string) ??
    (data.title as string) ??
    (data.heading as string) ??
    node.node_id
  );
}

// Render a node change
function NodeChangeItem({ node }: { node: NodeChangeAI }) {
  return (
    <div className={`${styles.changeItem} ${getOpClass(node.operation)}`}>
      <span className={styles.opIcon}>{getOpIcon(node.operation)}</span>
      <span className={styles.nodeType}>{node.node_type}:</span>
      <span className={styles.nodeLabel}>{getNodeLabel(node)}</span>
    </div>
  );
}

// Render an edge change
function EdgeChangeItem({ edge }: { edge: EdgeChangeAI }) {
  return (
    <div className={`${styles.edgeItem} ${getOpClass(edge.operation)}`}>
      <span className={styles.edgeIcon}>└─</span>
      <span className={styles.edgeType}>{edge.edge_type}</span>
      <span className={styles.edgeArrow}>→</span>
      <span className={styles.edgeTarget}>{edge.to}</span>
    </div>
  );
}

// Render story context change
function StoryContextItem({ change }: { change: StoryContextChange }) {
  const category = getOperationCategory(change.operation);
  const label = getOperationLabel(change.operation);
  const content = getOperationContent(change.operation);
  const displayContent = content.length > 60 ? `${content.slice(0, 60)}...` : content;

  return (
    <div className={`${styles.changeItem} ${getOpClass(category)}`}>
      <span className={styles.opIcon}>{getOpIcon(category)}</span>
      <span className={styles.nodeType}>{label}:</span>
      <span className={styles.nodeLabel}>"{displayContent}"</span>
    </div>
  );
}

// Render conflict info
function ConflictItem({ conflict }: { conflict: ConflictInfo }) {
  return (
    <div className={styles.conflictItem}>
      <span className={styles.conflictIcon}>⚠</span>
      <span className={styles.conflictType}>{conflict.type}</span>
      <span className={styles.conflictDesc}>{conflict.description}</span>
    </div>
  );
}

export function PackageCard({
  package: pkg,
  selected = false,
  onClick,
  expanded = false,
}: PackageCardProps) {
  const { storyElements, outline, other } = categorizeNodes(pkg.changes.nodes);
  const hasStoryContext = pkg.changes.storyContext && pkg.changes.storyContext.length > 0;
  const hasConflicts = pkg.impact.conflicts.length > 0;

  // Confidence as percentage
  const confidencePercent = Math.round(pkg.confidence * 100);
  const confidenceClass =
    confidencePercent >= 80
      ? styles.confidenceHigh
      : confidencePercent >= 60
        ? styles.confidenceMedium
        : styles.confidenceLow;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${expanded ? styles.expanded : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{pkg.title}</h3>
        <div className={`${styles.confidence} ${confidenceClass}`}>
          {confidencePercent}%
        </div>
      </div>

      {/* Rationale */}
      {expanded && (
        <p className={styles.rationale}>{pkg.rationale}</p>
      )}

      {/* Style tags */}
      {pkg.style_tags.length > 0 && (
        <div className={styles.tags}>
          {pkg.style_tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Changes */}
      <div className={styles.changes}>
        {/* Story Context */}
        {hasStoryContext && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Story Context</div>
            {expanded ? (
              pkg.changes.storyContext!.map((change, idx) => (
                <StoryContextItem key={idx} change={change} />
              ))
            ) : (
              <div className={styles.summary}>
                {pkg.changes.storyContext!.length} change(s)
              </div>
            )}
          </div>
        )}

        {/* Story Elements */}
        {storyElements.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Story Elements</div>
            {expanded ? (
              storyElements.map((node) => (
                <NodeChangeItem key={node.node_id} node={node} />
              ))
            ) : (
              <div className={styles.summary}>
                {storyElements.length} element(s)
              </div>
            )}
          </div>
        )}

        {/* Outline */}
        {outline.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Outline</div>
            {expanded ? (
              <>
                {outline.map((node) => (
                  <div key={node.node_id}>
                    <NodeChangeItem node={node} />
                    {/* Show related edges */}
                    {pkg.changes.edges
                      .filter((e) => e.from === node.node_id || e.to === node.node_id)
                      .map((edge, idx) => (
                        <EdgeChangeItem key={idx} edge={edge} />
                      ))}
                  </div>
                ))}
              </>
            ) : (
              <div className={styles.summary}>
                {outline.length} item(s)
              </div>
            )}
          </div>
        )}

        {/* Other nodes */}
        {other.length > 0 && expanded && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Other</div>
            {other.map((node) => (
              <NodeChangeItem key={node.node_id} node={node} />
            ))}
          </div>
        )}
      </div>

      {/* Impact */}
      {expanded && (
        <div className={styles.impact}>
          <div className={styles.sectionHeader}>Impact</div>

          {pkg.impact.fulfills_gaps.length > 0 && (
            <div className={styles.impactGroup}>
              <span className={styles.impactIcon}>✓</span>
              <span className={styles.impactLabel}>Fulfills:</span>
              <span className={styles.impactValue}>
                {pkg.impact.fulfills_gaps.join(', ')}
              </span>
            </div>
          )}

          {pkg.impact.creates_gaps.length > 0 && (
            <div className={styles.impactGroup}>
              <span className={styles.impactIcon}>→</span>
              <span className={styles.impactLabel}>Creates:</span>
              <span className={styles.impactValue}>
                {pkg.impact.creates_gaps.join(', ')}
              </span>
            </div>
          )}

          {hasConflicts ? (
            <div className={styles.conflicts}>
              {pkg.impact.conflicts.map((conflict, idx) => (
                <ConflictItem key={idx} conflict={conflict} />
              ))}
            </div>
          ) : (
            <div className={styles.impactGroup}>
              <span className={styles.impactIcon}>✓</span>
              <span className={styles.impactValue}>No conflicts</span>
            </div>
          )}
        </div>
      )}

      {/* Refinement lineage indicator */}
      {pkg.parent_package_id && (
        <div className={styles.lineage}>
          <span className={styles.lineageIcon}>↳</span>
          <span className={styles.lineageText}>
            Refined from {pkg.parent_package_id.slice(-8)}
          </span>
        </div>
      )}
    </div>
  );
}
