import type { PatchOpData } from '../../api/types';
import styles from './PatchOpItem.module.css';

interface Props {
  op: PatchOpData;
}

export function PatchOpItem({ op }: Props) {
  const opClass =
    op.op === 'ADD_NODE' || op.op === 'ADD_EDGE'
      ? styles.add
      : op.op === 'DELETE_NODE' || op.op === 'DELETE_EDGE'
        ? styles.delete
        : styles.update;

  const renderDetails = () => {
    if (op.op === 'ADD_NODE' || op.op === 'UPDATE_NODE' || op.op === 'DELETE_NODE') {
      return (
        <>
          {op.type && <span className={styles.type}>{op.type}</span>}
          {op.id && <span className={styles.id}>{op.id}</span>}
          {op.data && (
            <div className={styles.data}>
              {Object.entries(op.data).map(([key, value]) => (
                <div key={key} className={styles.field}>
                  <span className={styles.fieldKey}>{key}:</span>
                  <span className={styles.fieldValue}>
                    {typeof value === 'string'
                      ? value.length > 50
                        ? `${value.slice(0, 50)}...`
                        : value
                      : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    if (op.edge) {
      return (
        <>
          <span className={styles.type}>{op.edge.type}</span>
          <span className={styles.edge}>
            {op.edge.source} → {op.edge.target}
          </span>
        </>
      );
    }

    return null;
  };

  return (
    <div className={`${styles.item} ${opClass}`}>
      <div className={styles.header}>
        <span className={styles.op}>{op.op}</span>
      </div>
      <div className={styles.details}>{renderDetails()}</div>
    </div>
  );
}
