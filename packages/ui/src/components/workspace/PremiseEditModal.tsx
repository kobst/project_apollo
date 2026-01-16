/**
 * Modal for editing Premise data (Logline, Genre/Tone, Setting).
 * Handles both creating new nodes and updating existing ones.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import styles from './PremiseEditModal.module.css';

interface PremiseEditModalProps {
  onClose: () => void;
  onSave?: () => void;
}

interface PremiseFormData {
  loglineText: string;
  genre: string;
  tone: string;
  settingName: string;
  settingPeriod: string;
}

interface PremiseNodes {
  logline: NodeData | null;
  genreTone: NodeData | null;
  setting: NodeData | null;
}

export function PremiseEditModal({ onClose, onSave }: PremiseEditModalProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const [nodes, setNodes] = useState<PremiseNodes>({
    logline: null,
    genreTone: null,
    setting: null,
  });
  const [formData, setFormData] = useState<PremiseFormData>({
    loglineText: '',
    genre: '',
    tone: '',
    settingName: '',
    settingPeriod: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing premise data
  useEffect(() => {
    async function fetchData() {
      if (!currentStoryId) return;

      setLoading(true);
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
    }

    void fetchData();
  }, [currentStoryId]);

  const handleSave = useCallback(async () => {
    if (!currentStoryId) return;

    setSaving(true);
    setError(null);

    try {
      // Update or create Logline
      if (formData.loglineText.trim()) {
        if (nodes.logline) {
          // Update existing
          await api.updateNode(currentStoryId, nodes.logline.id, {
            text: formData.loglineText.trim(),
          });
        } else {
          // Create new via extraction
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

      // Update or create GenreTone
      if (formData.genre.trim() || formData.tone.trim()) {
        if (nodes.genreTone) {
          // Update existing
          await api.updateNode(currentStoryId, nodes.genreTone.id, {
            genre: formData.genre.trim() || undefined,
            tone: formData.tone.trim() || undefined,
          });
        } else {
          // Create new via extraction
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

      // Update or create Setting
      if (formData.settingName.trim() || formData.settingPeriod.trim()) {
        if (nodes.setting) {
          // Update existing
          await api.updateNode(currentStoryId, nodes.setting.id, {
            name: formData.settingName.trim() || undefined,
            time_period: formData.settingPeriod.trim() || undefined,
          });
        } else {
          // Create new via extraction
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

      // Refresh status to update counts
      void refreshStatus();

      // Notify parent and close
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Failed to save premise:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [currentStoryId, formData, nodes, refreshStatus, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && !saving && !loading) {
        void handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [saving, loading, handleSave, onClose]
  );

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Edit Premise</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <>
              {error && <div className={styles.error}>{error}</div>}

              {/* Logline Section */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Logline</h4>
                <div className={styles.field}>
                  <textarea
                    id="premise-logline"
                    className={styles.textarea}
                    value={formData.loglineText}
                    onChange={(e) => setFormData({ ...formData, loglineText: e.target.value })}
                    placeholder="A one-sentence summary of your story..."
                    rows={3}
                    disabled={saving}
                    autoFocus
                  />
                </div>
              </div>

              {/* Genre/Tone Section */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Genre & Tone</h4>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="premise-genre">
                      Genre
                    </label>
                    <input
                      id="premise-genre"
                      type="text"
                      className={styles.input}
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="e.g., Thriller, Drama"
                      disabled={saving}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="premise-tone">
                      Tone
                    </label>
                    <input
                      id="premise-tone"
                      type="text"
                      className={styles.input}
                      value={formData.tone}
                      onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                      placeholder="e.g., Dark, Comedic"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {/* Setting Section */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Setting</h4>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="premise-setting-name">
                      Location/World
                    </label>
                    <input
                      id="premise-setting-name"
                      type="text"
                      className={styles.input}
                      value={formData.settingName}
                      onChange={(e) => setFormData({ ...formData, settingName: e.target.value })}
                      placeholder="e.g., Los Angeles, Space Station"
                      disabled={saving}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="premise-setting-period">
                      Time Period
                    </label>
                    <input
                      id="premise-setting-period"
                      type="text"
                      className={styles.input}
                      value={formData.settingPeriod}
                      onChange={(e) => setFormData({ ...formData, settingPeriod: e.target.value })}
                      placeholder="e.g., 1920s, Near Future"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>Cmd+Enter to save</span>
          <div className={styles.footerButtons}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={() => void handleSave()}
              disabled={saving || loading}
              type="button"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
