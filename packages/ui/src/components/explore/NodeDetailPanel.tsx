import type { NodeRelationsData, EdgeData } from '../../api/types';
import { NodeRelations, InteractiveEdgeData } from './NodeRelations';
import styles from './NodeDetailPanel.module.css';

interface NodeDetailPanelProps {
  relations: NodeRelationsData;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  onEdit: () => void;
  // Edge editing handlers (optional - enables interactive mode when provided)
  onEditEdge?: ((edge: EdgeData) => void) | undefined;
  onDeleteEdge?: ((edgeId: string) => void) | undefined;
  onAddEdge?: ((direction: 'outgoing' | 'incoming') => void) | undefined;
  // Full edge data for interactive mode (includes edge IDs)
  fullEdges?: {
    outgoing: InteractiveEdgeData[];
    incoming: InteractiveEdgeData[];
  } | undefined;
}

export function NodeDetailPanel({
  relations,
  loading,
  onGenerate,
  generating,
  onEdit,
  onEditEdge,
  onDeleteEdge,
  onAddEdge,
  fullEdges,
}: NodeDetailPanelProps) {
  if (loading) {
    return <div className={styles.loading}>Loading details...</div>;
  }

  const { node, outgoing, incoming, relatedNodes } = relations;

  // Enable interactive mode if handlers are provided
  // Add button always works; edit/delete buttons only work when we have edge IDs
  const isInteractive = !!(onEditEdge || onDeleteEdge || onAddEdge);

  // Use full edge data if provided, otherwise fall back to basic relation data
  const outgoingEdges = fullEdges?.outgoing ?? outgoing;
  const incomingEdges = fullEdges?.incoming ?? incoming;

  return (
    <div className={styles.container}>
      {/* Node Header */}
      <div className={styles.header}>
        <h3 className={styles.label}>{node.label}</h3>
        <span className={styles.type}>{node.type}</span>
      </div>

      {/* Node ID */}
      <div className={styles.id}>
        <span className={styles.idLabel}>ID:</span>
        <code className={styles.idValue}>{node.id}</code>
      </div>

      {/* Node Data Fields */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Properties</h4>
        <div className={styles.fields}>
          {Object.entries(node.data).map(([key, value]) => (
            <div key={key} className={styles.field}>
              <span className={styles.fieldName}>{key}</span>
              <span className={styles.fieldValue}>{formatValue(value)}</span>
            </div>
          ))}
          {Object.keys(node.data).length === 0 && (
            <div className={styles.empty}>No properties</div>
          )}
        </div>
      </div>

      {/* Relations */}
      <NodeRelations
        outgoing={outgoingEdges}
        incoming={incomingEdges}
        relatedNodes={relatedNodes}
        currentNodeType={node.type}
        onEdit={onEditEdge}
        onDelete={onDeleteEdge}
        onAdd={onAddEdge}
        interactive={isInteractive}
      />

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.editBtn}
          onClick={onEdit}
          type="button"
        >
          Edit Node
        </button>
        <button
          className={styles.actionBtn}
          onClick={onGenerate}
          disabled={generating}
          type="button"
        >
          {generating ? 'Generating...' : 'Generate Moves'}
        </button>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
