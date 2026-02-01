/**
 * ElementDetailModal - Modal for viewing and editing a single element.
 * Similar pattern to EditPanel for scenes/plot points.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { useSavedPackages } from '../../context/SavedPackagesContext';
import { api } from '../../api/client';
import type { NodeData, ConnectedNodeInfo, ImpactEnrichment } from '../../api/types';
import type { ElementType } from './types';
import styles from './ElementDetailModal.module.css';

interface ElementDetailModalProps {
  elementId: string;
  elementType: ElementType;
  onClose: () => void;
  onElementClick?: (elementId: string, elementType: ElementType) => void;
  onDeleted?: () => void;
}

const TYPE_CONFIG: Record<ElementType, { icon: string; label: string }> = {
  Character: { icon: '👤', label: 'CHARACTER' },
  Location: { icon: '📍', label: 'LOCATION' },
  Object: { icon: '📦', label: 'OBJECT' },
};

export function ElementDetailModal({
  elementId,
  elementType,
  onClose,
  onElementClick,
  onDeleted,
}: ElementDetailModalProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { session, acceptedEnrichments } = useGeneration();
  const { savedPackages } = useSavedPackages();
  const [element, setElement] = useState<NodeData | null>(null);
  const [connections, setConnections] = useState<ConnectedNodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchElement = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);
    try {
      const [nodeData, connectedData] = await Promise.all([
        api.getNode(currentStoryId, elementId),
        api.getConnectedNodes(currentStoryId, elementId),
      ]);

      setElement(nodeData);
      setConnections(connectedData.connectedNodes);
      setEditedData(nodeData.data);
    } catch (err) {
      console.error('Failed to fetch element:', err);
      setError('Failed to load element details');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, elementId]);

  useEffect(() => {
    void fetchElement();
  }, [fetchElement]);

  const handleSave = async () => {
    if (!currentStoryId || !element) return;

    setSaving(true);
    setError(null);
    try {
      await api.updateNode(currentStoryId, elementId, editedData);
      await fetchElement();
      setIsEditing(false);
      void refreshStatus();
    } catch (err) {
      console.error('Failed to save element:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStoryId) return;

    setDeleting(true);
    try {
      await api.deleteNode(currentStoryId, elementId);
      void refreshStatus();
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error('Failed to delete element:', err);
      setError('Failed to delete element');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (element) {
      setEditedData(element.data);
    }
    setError(null);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isEditing) {
          handleCancel();
        } else {
          onClose();
        }
      }
      if (e.key === 'Enter' && e.metaKey && isEditing && !saving) {
        void handleSave();
      }
    },
    [onClose, isEditing, saving, showDeleteConfirm]
  );

  const handleRelatedElementClick = (nodeId: string, nodeType: string) => {
    if (['Character', 'Location', 'Object'].includes(nodeType) && onElementClick) {
      onElementClick(nodeId, nodeType as ElementType);
    }
  };

  const config = TYPE_CONFIG[elementType];

  // Get data fields
  const data = element?.data as Record<string, unknown> ?? {};
  const name = (data.name as string) || (data.label as string) || element?.label || elementId;
  const description = (data.description as string) || (data.bio as string) || '';

  // Filter connections by type
  const scenes = connections.filter((c) => c.node.type === 'Scene');
  const relatedElements = connections.filter((c) =>
    ['Character', 'Location', 'Object'].includes(c.node.type)
  );

  // Get extra attributes (excluding name, description, label, bio)
  const extraAttributes = Object.entries(data).filter(
    ([key]) => !['name', 'label', 'description', 'bio'].includes(key)
  );

  // Collect AI insights from enrichment data across all packages
  const aiInsights = useMemo(() => {
    const searchTerms = [name.toLowerCase(), elementId.toLowerCase()];
    const results: Array<{ description: string; narrative: string; kind: 'fulfills' | 'creates'; packageTitle: string }> = [];

    const scan = (enrichment: ImpactEnrichment | undefined, pkgTitle: string) => {
      if (!enrichment) return;
      for (const f of enrichment.fulfills) {
        if (searchTerms.some(t => f.description.toLowerCase().includes(t))) {
          results.push({ description: f.description, narrative: f.narrative, kind: 'fulfills', packageTitle: pkgTitle });
        }
      }
      for (const c of enrichment.creates) {
        if (searchTerms.some(t => c.description.toLowerCase().includes(t))) {
          results.push({ description: c.description, narrative: c.narrative, kind: 'creates', packageTitle: pkgTitle });
        }
      }
    };

    if (session?.packages) {
      for (const pkg of session.packages) scan(pkg.enrichment, pkg.title);
    }
    if (savedPackages) {
      for (const sp of savedPackages) scan(sp.package.enrichment, sp.package.title);
    }
    for (const enrichment of acceptedEnrichments) {
      scan(enrichment, 'Accepted package');
    }
    return results;
  }, [name, elementId, session?.packages, savedPackages, acceptedEnrichments]);

  const title = isEditing ? `Edit ${elementType}` : name;

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.typeBadge}>
              <span className={styles.typeIcon}>{config.icon}</span>
              <span className={styles.typeLabel}>{config.label}</span>
            </div>
            <h3 className={styles.title}>{title}</h3>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : error && !element ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <>
              {error && <div className={styles.error}>{error}</div>}

              {/* Name Field (edit mode) */}
              {isEditing && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="element-name">
                    Name
                  </label>
                  <input
                    id="element-name"
                    type="text"
                    className={styles.input}
                    value={(editedData.name as string) || ''}
                    onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                    placeholder="Name"
                    disabled={saving}
                    autoFocus
                  />
                </div>
              )}

              {/* Description */}
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                {isEditing ? (
                  <textarea
                    className={styles.textarea}
                    value={(editedData.description as string) || ''}
                    onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                    placeholder="Enter a description..."
                    rows={4}
                    disabled={saving}
                  />
                ) : (
                  <p className={styles.text}>
                    {description || <span className={styles.empty}>No description</span>}
                  </p>
                )}
              </div>

              {/* Attributes */}
              {extraAttributes.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Attributes</label>
                  <div className={styles.attributes}>
                    {extraAttributes.map(([key, value]) => (
                      <div key={key} className={styles.attribute}>
                        <span className={styles.attrKey}>{key}:</span>
                        <span className={styles.attrValue}>
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Appears In (read-only) */}
              {!isEditing && scenes.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    Appears In ({scenes.length} scene{scenes.length !== 1 ? 's' : ''})
                  </label>
                  <ul className={styles.list}>
                    {scenes.map((conn) => {
                      const sceneData = conn.node.data as Record<string, unknown>;
                      const heading = (sceneData.heading as string) || conn.node.label || conn.node.id;
                      return (
                        <li key={conn.node.id} className={styles.listItem}>
                          <span className={styles.listIcon}>🎬</span>
                          <span>{heading}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Relationships (read-only) */}
              {!isEditing && relatedElements.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Relationships</label>
                  <ul className={styles.list}>
                    {relatedElements.map((conn) => {
                      const relData = conn.node.data as Record<string, unknown>;
                      const relName = (relData.name as string) || conn.node.label || conn.node.id;
                      const relType = conn.node.type as ElementType;
                      const relConfig = TYPE_CONFIG[relType] || { icon: '📄', label: relType };
                      return (
                        <li key={conn.node.id} className={styles.listItem}>
                          <button
                            className={styles.relationBtn}
                            onClick={() => handleRelatedElementClick(conn.node.id, conn.node.type)}
                            type="button"
                            disabled={!onElementClick}
                          >
                            <span className={styles.listIcon}>{relConfig.icon}</span>
                            <span>{relName}</span>
                            <span className={styles.edgeType}>({conn.edgeType})</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* AI Insights — enrichment matched to this element */}
              {!isEditing && aiInsights.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>AI Insights</label>
                  <ul className={styles.list}>
                    {aiInsights.map((insight, i) => (
                      <li key={i} className={styles.listItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span>
                          <strong>{insight.description}</strong>
                        </span>
                        {insight.narrative && (
                          <span style={{ opacity: 0.7, fontSize: 12 }}>{insight.narrative}</span>
                        )}
                        <span style={{ opacity: 0.4, fontSize: 10 }}>
                          {insight.kind === 'fulfills' ? 'Fulfilled' : 'Created'} by {insight.packageTitle}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {isEditing ? (
            <>
              <span className={styles.footerHint}>Cmd+Enter to save</span>
              <div className={styles.footerButtons}>
                <button
                  className={styles.cancelBtn}
                  onClick={handleCancel}
                  disabled={saving}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={() => void handleSave()}
                  disabled={saving}
                  type="button"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
                type="button"
                disabled={loading}
              >
                Delete
              </button>
              <button
                className={styles.editBtn}
                onClick={() => setIsEditing(true)}
                type="button"
                disabled={loading}
              >
                Edit
              </button>
            </>
          )}
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className={styles.confirmOverlay} onClick={() => setShowDeleteConfirm(false)}>
            <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
              <h4 className={styles.confirmTitle}>Delete {name}?</h4>
              <p className={styles.confirmText}>
                This will permanently delete this {elementType.toLowerCase()} and remove all its
                relationships. This action cannot be undone.
              </p>
              <div className={styles.confirmButtons}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmDeleteBtn}
                  onClick={() => void handleDelete()}
                  type="button"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
