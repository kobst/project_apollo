/**
 * Preview component for pending edge operations.
 * Shows adds, updates, and deletes before they're committed.
 */

import { useMemo } from 'react';
import type { CreateEdgeRequest, EdgeProperties, EdgeStatus } from '../../api/types';
import { EDGE_TEMPLATES } from '../../config/edgeTemplates';
import styles from './EdgePatchBuilder.module.css';

export interface PendingEdgeAdd {
  op: 'ADD_EDGE';
  edge: CreateEdgeRequest;
}

export interface PendingEdgeUpdate {
  op: 'UPDATE_EDGE';
  edgeId: string;
  edgeType: string;
  from: string;
  to: string;
  changes: {
    properties?: EdgeProperties;
    status?: EdgeStatus;
  };
}

export interface PendingEdgeDelete {
  op: 'DELETE_EDGE';
  edgeId: string;
  edgeType: string;
  from: string;
  to: string;
}

export type PendingEdgeOp = PendingEdgeAdd | PendingEdgeUpdate | PendingEdgeDelete;

interface EdgePatchBuilderProps {
  operations: PendingEdgeOp[];
  onRemove?: (index: number) => void;
  onCommit?: () => void;
  onDiscard?: () => void;
  committing?: boolean;
}

export function EdgePatchBuilder({
  operations,
  onRemove,
  onCommit,
  onDiscard,
  committing = false,
}: EdgePatchBuilderProps) {
  const summary = useMemo(() => {
    return {
      adds: operations.filter((op) => op.op === 'ADD_EDGE').length,
      updates: operations.filter((op) => op.op === 'UPDATE_EDGE').length,
      deletes: operations.filter((op) => op.op === 'DELETE_EDGE').length,
    };
  }, [operations]);

  if (operations.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Pending Edge Changes</h4>
        <span className={styles.count}>
          {operations.length} op{operations.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.summary}>
        {summary.adds > 0 && (
          <span className={styles.summaryAdd}>+{summary.adds} add</span>
        )}
        {summary.updates > 0 && (
          <span className={styles.summaryUpdate}>~{summary.updates} update</span>
        )}
        {summary.deletes > 0 && (
          <span className={styles.summaryDelete}>-{summary.deletes} delete</span>
        )}
      </div>

      <div className={styles.operations}>
        {operations.map((pendingOp, idx) => (
          <div key={idx} className={styles.operation}>
            {renderOperation(pendingOp)}
            {onRemove && (
              <button
                className={styles.removeBtn}
                onClick={() => onRemove(idx)}
                type="button"
                title="Remove this change"
                disabled={committing}
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      {(onCommit || onDiscard) && (
        <div className={styles.actions}>
          {onDiscard && (
            <button
              className={styles.discardBtn}
              onClick={onDiscard}
              disabled={committing}
              type="button"
            >
              Discard All
            </button>
          )}
          {onCommit && (
            <button
              className={styles.commitBtn}
              onClick={onCommit}
              disabled={committing}
              type="button"
            >
              {committing ? 'Committing...' : 'Commit Changes'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function renderOperation(op: PendingEdgeOp) {
  switch (op.op) {
    case 'ADD_EDGE': {
      const template = EDGE_TEMPLATES[op.edge.type];
      return (
        <div className={styles.opContent}>
          <div className={styles.opHeader}>
            <span className={`${styles.opType} ${styles.opAdd}`}>ADD_EDGE</span>
            <span className={styles.edgeType}>{op.edge.type}</span>
          </div>
          <div className={styles.opDetails}>
            <span className={styles.edgeLabel}>{template?.label || op.edge.type}</span>
            <div className={styles.edgeEndpoints}>
              <code className={styles.nodeId}>{truncateId(op.edge.from)}</code>
              <span className={styles.arrow}>&rarr;</span>
              <code className={styles.nodeId}>{truncateId(op.edge.to)}</code>
            </div>
            {op.edge.properties && Object.keys(op.edge.properties).length > 0 && (
              <div className={styles.properties}>
                {formatProperties(op.edge.properties)}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'UPDATE_EDGE': {
      const template = EDGE_TEMPLATES[op.edgeType as keyof typeof EDGE_TEMPLATES];
      return (
        <div className={styles.opContent}>
          <div className={styles.opHeader}>
            <span className={`${styles.opType} ${styles.opUpdate}`}>UPDATE_EDGE</span>
            <span className={styles.edgeType}>{op.edgeType}</span>
          </div>
          <div className={styles.opDetails}>
            <span className={styles.edgeLabel}>{template?.label || op.edgeType}</span>
            <div className={styles.edgeEndpoints}>
              <code className={styles.nodeId}>{truncateId(op.from)}</code>
              <span className={styles.arrow}>&rarr;</span>
              <code className={styles.nodeId}>{truncateId(op.to)}</code>
            </div>
            <div className={styles.changes}>
              {op.changes.properties && (
                <div className={styles.changeItem}>
                  <span className={styles.changeLabel}>properties:</span>
                  <span className={styles.changeValue}>{formatProperties(op.changes.properties)}</span>
                </div>
              )}
              {op.changes.status && (
                <div className={styles.changeItem}>
                  <span className={styles.changeLabel}>status:</span>
                  <span className={`${styles.changeValue} ${styles[`status${op.changes.status.charAt(0).toUpperCase() + op.changes.status.slice(1)}`]}`}>
                    {op.changes.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'DELETE_EDGE': {
      const template = EDGE_TEMPLATES[op.edgeType as keyof typeof EDGE_TEMPLATES];
      return (
        <div className={styles.opContent}>
          <div className={styles.opHeader}>
            <span className={`${styles.opType} ${styles.opDelete}`}>DELETE_EDGE</span>
            <span className={styles.edgeType}>{op.edgeType}</span>
          </div>
          <div className={styles.opDetails}>
            <span className={styles.edgeLabel}>{template?.label || op.edgeType}</span>
            <div className={styles.edgeEndpoints}>
              <code className={styles.nodeId}>{truncateId(op.from)}</code>
              <span className={styles.arrow}>&rarr;</span>
              <code className={styles.nodeId}>{truncateId(op.to)}</code>
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatProperties(props: EdgeProperties): string {
  const parts: string[] = [];
  if (props.order !== undefined) parts.push(`order: ${props.order}`);
  if (props.weight !== undefined) parts.push(`weight: ${props.weight}`);
  if (props.confidence !== undefined) parts.push(`confidence: ${props.confidence}`);
  if (props.notes) parts.push(`notes: "${props.notes.slice(0, 20)}${props.notes.length > 20 ? '...' : ''}"`);
  return parts.join(', ') || '(none)';
}
