import styles from './PatchBuilder.module.css';

interface PatchOp {
  op: string;
  nodeId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface PatchBuilderProps {
  nodeId: string;
  nodeType: string;
  changes: Record<string, unknown>;
  originalData: Record<string, unknown>;
}

export function PatchBuilder({ nodeId, nodeType, changes, originalData }: PatchBuilderProps) {
  const ops: PatchOp[] = Object.entries(changes).map(([field, newValue]) => ({
    op: 'UPDATE_NODE',
    nodeId,
    field,
    oldValue: originalData[field],
    newValue,
  }));

  if (ops.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No changes to preview</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Pending Changes</h4>
        <span className={styles.count}>{ops.length} op{ops.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.ops}>
        {ops.map((patchOp, idx) => (
          <div key={idx} className={styles.op}>
            <div className={styles.opHeader}>
              <span className={styles.opType}>{patchOp.op}</span>
              <span className={styles.opTarget}>{nodeType}.{patchOp.field}</span>
            </div>
            <div className={styles.opDiff}>
              <div className={styles.oldValue}>
                <span className={styles.diffLabel}>-</span>
                <span className={styles.diffValue}>{formatValue(patchOp.oldValue)}</span>
              </div>
              <div className={styles.newValue}>
                <span className={styles.diffLabel}>+</span>
                <span className={styles.diffValue}>{formatValue(patchOp.newValue)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.nodeId}>
        <span className={styles.idLabel}>Target:</span>
        <code className={styles.idValue}>{nodeId}</code>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '(empty)';
  }
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 100) {
      return `"${value.slice(0, 100)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
