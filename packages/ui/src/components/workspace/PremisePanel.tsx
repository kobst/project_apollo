/**
 * PremisePanel - Card-based view for editing premise fields (Logline, Genre/Tone, Setting).
 * Replaces the modal-based editing with an inline panel view.
 * Includes staged proposal preview section when a package is staged.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import type { MergedNode } from '../../utils/stagingUtils';
import { InlineEditor } from './InlineEditor';
import styles from './PremisePanel.module.css';

interface PremiseNodes {
  logline: NodeData | null;
  genreTone: NodeData | null;
  setting: NodeData | null;
}

type EditingCard = 'logline' | 'genreTone' | 'setting' | null;

interface FormData {
  loglineText: string;
  genre: string;
  tone: string;
  settingName: string;
  settingPeriod: string;
}

export function PremisePanel() {
  const { currentStoryId, refreshStatus } = useStory();
  const { stagedPackage, staging, updateEditedNode, removeProposedNode } = useGeneration();
  const [nodes, setNodes] = useState<PremiseNodes>({
    logline: null,
    genreTone: null,
    setting: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<EditingCard>(null);
  const [formData, setFormData] = useState<FormData>({
    loglineText: '',
    genre: '',
    tone: '',
    settingName: '',
    settingPeriod: '',
  });
  const [saving, setSaving] = useState(false);

  // Compute proposed premise nodes from staged package
  const proposedPremiseNodes = useMemo((): MergedNode[] => {
    if (!stagedPackage) return [];

    const proposedNodes: MergedNode[] = [];
    for (const nodeChange of stagedPackage.changes.nodes) {
      const nodeType = nodeChange.node_type;
      if (nodeType === 'Logline' || nodeType === 'Setting' || nodeType === 'GenreTone') {
        const localEdits = staging.editedNodes.get(nodeChange.node_id);
        const isRemoved = staging.removedNodeIds.has(nodeChange.node_id);
        if (!isRemoved || nodeChange.operation !== 'add') {
          proposedNodes.push({
            id: nodeChange.node_id,
            type: nodeType,
            label: (nodeChange.data?.name as string) ?? (nodeChange.data?.text as string) ?? nodeType,
            data: { ...nodeChange.data, ...localEdits },
            _isProposed: true,
            _packageId: stagedPackage.id,
            _operation: nodeChange.operation,
            _previousData: nodeChange.previous_data,
          });
        }
      }
    }
    return proposedNodes;
  }, [stagedPackage, staging.editedNodes, staging.removedNodeIds]);

  const handleEditProposedNode = useCallback((nodeId: string, updates: Partial<Record<string, unknown>>) => {
    updateEditedNode(nodeId, updates);
  }, [updateEditedNode]);

  const handleRemoveProposedNode = useCallback((nodeId: string) => {
    removeProposedNode(nodeId);
  }, [removeProposedNode]);

  const fetchPremiseData = useCallback(async () => {
    if (!currentStoryId) return;

    setLoading(true);
    setError(null);
    try {
      const [loglineRes, genreToneRes, settingRes] = await Promise.all([
        api.listNodes(currentStoryId, 'Logline', 1),
        api.listNodes(currentStoryId, 'GenreTone', 1),
        api.listNodes(currentStoryId, 'Setting', 1),
      ]);

      const loglineNode = loglineRes.nodes[0] ?? null;
      const genreToneNode = genreToneRes.nodes[0] ?? null;
      const settingNode = settingRes.nodes[0] ?? null;

      setNodes({
        logline: loglineNode,
        genreTone: genreToneNode,
        setting: settingNode,
      });

      // Populate form with existing data
      setFormData({
        loglineText: (loglineNode?.data?.text as string) ?? '',
        genre: (genreToneNode?.data?.genre as string) ?? '',
        tone: (genreToneNode?.data?.tone as string) ?? '',
        settingName: (settingNode?.data?.name as string) ?? '',
        settingPeriod: (settingNode?.data?.time_period as string) ?? '',
      });
    } catch (err) {
      console.error('Failed to fetch premise data:', err);
      setError('Failed to load premise data');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchPremiseData();
  }, [fetchPremiseData]);

  const handleEdit = (card: EditingCard) => {
    setEditingCard(card);
  };

  const handleCancel = () => {
    // Reset form data to current node values
    setFormData({
      loglineText: (nodes.logline?.data?.text as string) ?? '',
      genre: (nodes.genreTone?.data?.genre as string) ?? '',
      tone: (nodes.genreTone?.data?.tone as string) ?? '',
      settingName: (nodes.setting?.data?.name as string) ?? '',
      settingPeriod: (nodes.setting?.data?.time_period as string) ?? '',
    });
    setEditingCard(null);
    setError(null);
  };

  const handleSaveLogline = async () => {
    if (!currentStoryId) return;

    setSaving(true);
    setError(null);
    try {
      if (formData.loglineText.trim()) {
        if (nodes.logline) {
          await api.updateNode(currentStoryId, nodes.logline.id, {
            text: formData.loglineText.trim(),
          });
        } else {
          const extractResult = await api.extract(currentStoryId, {
            input: formData.loglineText.trim(),
            targetType: 'Logline',
          });
          const firstProposal = extractResult.proposals?.[0];
          if (firstProposal) {
            await api.acceptExtract(currentStoryId, firstProposal.id);
          }
        }
      }
      void refreshStatus();
      await fetchPremiseData();
      setEditingCard(null);
    } catch (err) {
      console.error('Failed to save logline:', err);
      setError(err instanceof Error ? err.message : 'Failed to save logline');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGenreTone = async () => {
    if (!currentStoryId) return;

    setSaving(true);
    setError(null);
    try {
      if (formData.genre.trim() || formData.tone.trim()) {
        if (nodes.genreTone) {
          await api.updateNode(currentStoryId, nodes.genreTone.id, {
            genre: formData.genre.trim() || undefined,
            tone: formData.tone.trim() || undefined,
          });
        } else {
          const genreToneText = [formData.genre, formData.tone].filter(Boolean).join(' - ');
          const extractResult = await api.extract(currentStoryId, {
            input: genreToneText,
            targetType: 'GenreTone',
          });
          const firstProposal = extractResult.proposals?.[0];
          if (firstProposal) {
            await api.acceptExtract(currentStoryId, firstProposal.id);
          }
        }
      }
      void refreshStatus();
      await fetchPremiseData();
      setEditingCard(null);
    } catch (err) {
      console.error('Failed to save genre/tone:', err);
      setError(err instanceof Error ? err.message : 'Failed to save genre/tone');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSetting = async () => {
    if (!currentStoryId) return;

    setSaving(true);
    setError(null);
    try {
      if (formData.settingName.trim() || formData.settingPeriod.trim()) {
        if (nodes.setting) {
          await api.updateNode(currentStoryId, nodes.setting.id, {
            name: formData.settingName.trim() || undefined,
            time_period: formData.settingPeriod.trim() || undefined,
          });
        } else {
          const settingText = [formData.settingName, formData.settingPeriod].filter(Boolean).join(', ');
          const extractResult = await api.extract(currentStoryId, {
            input: settingText,
            targetType: 'Setting',
          });
          const firstProposal = extractResult.proposals?.[0];
          if (firstProposal) {
            await api.acceptExtract(currentStoryId, firstProposal.id);
          }
        }
      }
      void refreshStatus();
      await fetchPremiseData();
      setEditingCard(null);
    } catch (err) {
      console.error('Failed to save setting:', err);
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, saveHandler: () => Promise<void>) => {
    if (e.key === 'Enter' && e.metaKey && !saving) {
      void saveHandler();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Extract display values
  const loglineText = (nodes.logline?.data?.text as string) || '';
  const genre = (nodes.genreTone?.data?.genre as string) || '';
  const tone = (nodes.genreTone?.data?.tone as string) || '';
  const genreToneDisplay = [genre, tone].filter(Boolean).join(' / ') || '';
  const settingName = (nodes.setting?.data?.name as string) || '';
  const settingPeriod = (nodes.setting?.data?.time_period as string) || '';
  const settingDisplay = [settingName, settingPeriod].filter(Boolean).join(', ') || '';

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading premise data...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.viewTitle}>Premise</h2>
      </div>

      <div className={styles.content}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Proposed Changes Section */}
        {proposedPremiseNodes.length > 0 && (
          <div className={styles.proposedSection}>
            <h3 className={styles.proposedTitle}>
              <span className={styles.proposedIcon}>{'\u2728'}</span>
              Proposed Changes ({proposedPremiseNodes.length})
            </h3>
            <div className={styles.proposedList}>
              {proposedPremiseNodes.map((node) => (
                <InlineEditor
                  key={node.id}
                  node={node}
                  onEdit={handleEditProposedNode}
                  onRemove={node._operation === 'add' ? handleRemoveProposedNode : undefined}
                  isRemoved={staging.removedNodeIds.has(node.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Logline Card - Full Width */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>LOGLINE</h3>
            {editingCard !== 'logline' && (
              <button
                className={styles.editButton}
                onClick={() => handleEdit('logline')}
                type="button"
              >
                Edit
              </button>
            )}
          </div>
          <div className={styles.cardContent}>
            {editingCard === 'logline' ? (
              <div
                className={styles.editForm}
                onKeyDown={(e) => handleKeyDown(e, handleSaveLogline)}
              >
                <textarea
                  className={styles.textarea}
                  value={formData.loglineText}
                  onChange={(e) => setFormData({ ...formData, loglineText: e.target.value })}
                  placeholder="A one-sentence summary of your story..."
                  rows={3}
                  disabled={saving}
                  autoFocus
                />
                <div className={styles.editActions}>
                  <span className={styles.hint}>Cmd+Enter to save</span>
                  <div className={styles.buttons}>
                    <button
                      className={styles.cancelButton}
                      onClick={handleCancel}
                      disabled={saving}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.saveButton}
                      onClick={() => void handleSaveLogline()}
                      disabled={saving}
                      type="button"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : loglineText ? (
              <p className={styles.loglineText}>"{loglineText}"</p>
            ) : (
              <p className={styles.placeholder}>Add a logline to describe your story...</p>
            )}
          </div>
        </div>

        {/* Genre/Tone and Setting Cards - Side by Side */}
        <div className={styles.cardRow}>
          {/* Genre/Tone Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>GENRE / TONE</h3>
              {editingCard !== 'genreTone' && (
                <button
                  className={styles.editButton}
                  onClick={() => handleEdit('genreTone')}
                  type="button"
                >
                  Edit
                </button>
              )}
            </div>
            <div className={styles.cardContent}>
              {editingCard === 'genreTone' ? (
                <div
                  className={styles.editForm}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveGenreTone)}
                >
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="genre">Genre</label>
                      <input
                        id="genre"
                        type="text"
                        className={styles.input}
                        value={formData.genre}
                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                        placeholder="e.g., Thriller, Drama"
                        disabled={saving}
                        autoFocus
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="tone">Tone</label>
                      <input
                        id="tone"
                        type="text"
                        className={styles.input}
                        value={formData.tone}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        placeholder="e.g., Dark, Comedic"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className={styles.editActions}>
                    <span className={styles.hint}>Cmd+Enter to save</span>
                    <div className={styles.buttons}>
                      <button
                        className={styles.cancelButton}
                        onClick={handleCancel}
                        disabled={saving}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.saveButton}
                        onClick={() => void handleSaveGenreTone()}
                        disabled={saving}
                        type="button"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : genreToneDisplay ? (
                <p className={styles.displayText}>
                  <span className={styles.icon}>&#127916;</span>
                  {genreToneDisplay}
                </p>
              ) : (
                <p className={styles.placeholder}>Add genre and tone...</p>
              )}
            </div>
          </div>

          {/* Setting Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>SETTING</h3>
              {editingCard !== 'setting' && (
                <button
                  className={styles.editButton}
                  onClick={() => handleEdit('setting')}
                  type="button"
                >
                  Edit
                </button>
              )}
            </div>
            <div className={styles.cardContent}>
              {editingCard === 'setting' ? (
                <div
                  className={styles.editForm}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveSetting)}
                >
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="settingName">Location/World</label>
                      <input
                        id="settingName"
                        type="text"
                        className={styles.input}
                        value={formData.settingName}
                        onChange={(e) => setFormData({ ...formData, settingName: e.target.value })}
                        placeholder="e.g., Los Angeles"
                        disabled={saving}
                        autoFocus
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="settingPeriod">Time Period</label>
                      <input
                        id="settingPeriod"
                        type="text"
                        className={styles.input}
                        value={formData.settingPeriod}
                        onChange={(e) => setFormData({ ...formData, settingPeriod: e.target.value })}
                        placeholder="e.g., 1920s"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className={styles.editActions}>
                    <span className={styles.hint}>Cmd+Enter to save</span>
                    <div className={styles.buttons}>
                      <button
                        className={styles.cancelButton}
                        onClick={handleCancel}
                        disabled={saving}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.saveButton}
                        onClick={() => void handleSaveSetting()}
                        disabled={saving}
                        type="button"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : settingDisplay ? (
                <p className={styles.displayText}>
                  <span className={styles.icon}>&#128205;</span>
                  {settingDisplay}
                </p>
              ) : (
                <p className={styles.placeholder}>Add setting details...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
