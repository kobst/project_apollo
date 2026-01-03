/**
 * Modal for editing an existing edge's properties and status.
 * Edge type, from, and to are immutable - user must delete and recreate to change.
 */

import { useState, useCallback, useMemo } from 'react';
import type { EdgeData, EdgeProperties, EdgeStatus } from '../../api/types';
import { EDGE_TEMPLATES } from '../../config/edgeTemplates';
import { EdgePropertiesForm } from './EdgePropertiesForm';
import styles from './EditEdgeModal.module.css';

interface EditEdgeModalProps {
  edge: EdgeData;
  onSave: (edgeId: string, changes: { properties?: EdgeProperties | undefined; status?: EdgeStatus | undefined }) => void;
  onDelete: (edgeId: string) => void;
  onCancel: () => void;
  saving?: boolean | undefined;
}

export function EditEdgeModal({
  edge,
  onSave,
  onDelete,
  onCancel,
  saving = false,
}: EditEdgeModalProps) {
  const template = EDGE_TEMPLATES[edge.type];
  const [properties, setProperties] = useState<EdgeProperties>(edge.properties ?? {});
  const [propertiesValid, setPropertiesValid] = useState(true);
  const [status, setStatus] = useState<EdgeStatus>(edge.status ?? 'approved');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track if anything changed
  const hasChanges = useMemo(() => {
    const propsChanged = JSON.stringify(properties) !== JSON.stringify(edge.properties ?? {});
    const statusChanged = status !== (edge.status ?? 'approved');
    return propsChanged || statusChanged;
  }, [properties, status, edge.properties, edge.status]);

  const handlePropertiesChange = useCallback((props: EdgeProperties, isValid: boolean) => {
    setProperties(props);
    setPropertiesValid(isValid);
  }, []);

  const handleSave = useCallback(() => {
    if (!propertiesValid || !hasChanges) return;

    const changes: { properties?: EdgeProperties; status?: EdgeStatus } = {};

    if (JSON.stringify(properties) !== JSON.stringify(edge.properties ?? {})) {
      changes.properties = properties;
    }

    if (status !== (edge.status ?? 'approved')) {
      changes.status = status;
    }

    onSave(edge.id, changes);
  }, [edge.id, edge.properties, edge.status, properties, status, propertiesValid, hasChanges, onSave]);

  const handleDelete = useCallback(() => {
    if (showDeleteConfirm) {
      onDelete(edge.id);
    } else {
      setShowDeleteConfirm(true);
    }
  }, [edge.id, showDeleteConfirm, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Edit Relation</h3>
          <button className={styles.closeBtn} onClick={onCancel} type="button" aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {/* Read-only edge info */}
          <div className={styles.edgeInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Type</span>
              <span className={styles.infoValue}>
                <span className={styles.edgeType}>{edge.type}</span>
                <span className={styles.edgeTypeLabel}>{template.label}</span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>From</span>
              <span className={styles.infoValue}>
                <code className={styles.nodeId}>{edge.from}</code>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>To</span>
              <span className={styles.infoValue}>
                <code className={styles.nodeId}>{edge.to}</code>
              </span>
            </div>
          </div>

          {/* Properties form */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Properties</h4>
            <EdgePropertiesForm
              edgeType={edge.type}
              initialValues={edge.properties}
              onChange={handlePropertiesChange}
              disabled={saving}
            />
          </div>

          {/* Status selector */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Status</h4>
            <div className={styles.statusGroup}>
              <label className={styles.statusOption}>
                <input
                  type="radio"
                  name="status"
                  value="proposed"
                  checked={status === 'proposed'}
                  onChange={() => setStatus('proposed')}
                  disabled={saving}
                />
                <span className={`${styles.statusLabel} ${styles.statusProposed}`}>Proposed</span>
              </label>
              <label className={styles.statusOption}>
                <input
                  type="radio"
                  name="status"
                  value="approved"
                  checked={status === 'approved'}
                  onChange={() => setStatus('approved')}
                  disabled={saving}
                />
                <span className={`${styles.statusLabel} ${styles.statusApproved}`}>Approved</span>
              </label>
              <label className={styles.statusOption}>
                <input
                  type="radio"
                  name="status"
                  value="rejected"
                  checked={status === 'rejected'}
                  onChange={() => setStatus('rejected')}
                  disabled={saving}
                />
                <span className={`${styles.statusLabel} ${styles.statusRejected}`}>Rejected</span>
              </label>
            </div>
          </div>

          {/* Provenance info (read-only) */}
          {edge.provenance && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Provenance</h4>
              <div className={styles.provenanceInfo}>
                <span className={styles.provenanceSource}>
                  Source: {edge.provenance.source}
                </span>
                {edge.provenance.createdBy && (
                  <span className={styles.provenanceDetail}>
                    by {edge.provenance.createdBy}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {showDeleteConfirm ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deleteWarning}>Delete this relation?</span>
              <button
                className={styles.confirmDeleteBtn}
                onClick={handleDelete}
                disabled={saving}
                type="button"
              >
                Yes, Delete
              </button>
              <button
                className={styles.cancelDeleteBtn}
                onClick={handleCancelDelete}
                disabled={saving}
                type="button"
              >
                No
              </button>
            </div>
          ) : (
            <>
              <button
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={saving}
                type="button"
              >
                Delete
              </button>
              <div className={styles.rightActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={onCancel}
                  disabled={saving}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={!hasChanges || !propertiesValid || saving}
                  type="button"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
