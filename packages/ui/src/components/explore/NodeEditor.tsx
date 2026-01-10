import { useState, useCallback, useMemo } from 'react';
import type { NodeData } from '../../api/types';
import styles from './NodeEditor.module.css';

interface NodeEditorProps {
  node: NodeData;
  onSave: (changes: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}

// Define which fields are editable per node type
const EDITABLE_FIELDS: Record<string, string[]> = {
  // Context layer
  Logline: ['text'],
  Setting: ['name', 'description', 'time_period', 'atmosphere', 'notes'],
  GenreTone: ['genre', 'secondary_genre', 'tone', 'tone_description', 'conventions', 'notes'],
  // Structure
  Beat: ['guidance', 'notes', 'status'],
  Scene: ['title', 'heading', 'scene_overview', 'mood', 'int_ext', 'time_of_day', 'status'],
  Character: ['name', 'description', 'archetype', 'status'],
  Location: ['name', 'description', 'atmosphere'],
  CharacterArc: ['arc_type', 'description', 'status'],
  Object: ['name', 'description', 'significance'],
  PlotPoint: ['title', 'summary', 'intent', 'criteria_of_satisfaction', 'priority', 'urgency', 'stakes_change', 'status', 'act'],
};

// Field types for rendering appropriate inputs
const FIELD_TYPES: Record<string, 'text' | 'textarea' | 'select' | 'number'> = {
  description: 'textarea',
  scene_overview: 'textarea',
  guidance: 'textarea',
  notes: 'textarea',
  summary: 'textarea',
  criteria_of_satisfaction: 'textarea',
  statement: 'textarea',
  significance: 'textarea',
  // Logline fields
  text: 'textarea',
  // Setting fields
  time_period: 'text',
  atmosphere: 'textarea',
  // GenreTone fields
  genre: 'select',
  secondary_genre: 'select',
  tone: 'select',
  tone_description: 'textarea',
  conventions: 'textarea',
  // Select fields
  status: 'select',
  conflict_type: 'select',
  archetype: 'select',
  int_ext: 'select',
  arc_type: 'select',
  intent: 'select',
  priority: 'select',
  urgency: 'select',
  stakes_change: 'select',
  act: 'select',
};

// Select options per field
const SELECT_OPTIONS: Record<string, string[]> = {
  status: ['EMPTY', 'DRAFT', 'COMPLETE', 'ACTIVE', 'FLOATING', 'RESOLVED', 'ABANDONED', 'proposed', 'approved', 'deprecated'],
  conflict_type: ['interpersonal', 'internal', 'societal', 'ideological', 'systemic', 'nature', 'technological'],
  archetype: ['PROTAGONIST', 'ANTAGONIST', 'MENTOR', 'ALLY', 'LOVE_INTEREST', 'TRICKSTER', 'THRESHOLD_GUARDIAN', 'HERALD', 'SHAPESHIFTER', 'SHADOW'],
  int_ext: ['INT', 'EXT', 'INT/EXT'],
  arc_type: ['POSITIVE', 'NEGATIVE', 'FLAT', 'CORRUPTION', 'DISILLUSIONMENT'],
  intent: ['plot', 'character', 'theme', 'tone'],
  priority: ['low', 'medium', 'high'],
  urgency: ['low', 'medium', 'high'],
  stakes_change: ['up', 'down', 'steady'],
  act: ['1', '2', '3', '4', '5'],
  // GenreTone fields
  genre: ['action', 'comedy', 'drama', 'horror', 'thriller', 'romance', 'sci-fi', 'fantasy', 'noir', 'western', 'mystery', 'adventure', 'musical', 'documentary', 'other'],
  secondary_genre: ['', 'action', 'comedy', 'drama', 'horror', 'thriller', 'romance', 'sci-fi', 'fantasy', 'noir', 'western', 'mystery', 'adventure', 'musical', 'documentary', 'other'],
  tone: ['dark', 'light', 'gritty', 'whimsical', 'satirical', 'earnest', 'cynical', 'hopeful', 'melancholic', 'tense', 'comedic', 'dramatic', 'neutral'],
};

export function NodeEditor({ node, onSave, onCancel, saving }: NodeEditorProps) {
  // Get editable fields for this node type
  const editableFields = EDITABLE_FIELDS[node.type] || [];

  // Initialize form state with current values
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of editableFields) {
      initial[field] = node.data[field] ?? '';
    }
    return initial;
  });

  // Track what's changed
  const changes = useMemo(() => {
    const diff: Record<string, unknown> = {};
    for (const field of editableFields) {
      const originalValue = node.data[field] ?? '';
      const currentValue = formData[field] ?? '';
      if (currentValue !== originalValue) {
        diff[field] = currentValue;
      }
    }
    return diff;
  }, [formData, node.data, editableFields]);

  const hasChanges = Object.keys(changes).length > 0;

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (hasChanges) {
      onSave(changes);
    }
  }, [hasChanges, changes, onSave]);

  const renderField = (field: string) => {
    const fieldType = FIELD_TYPES[field] || 'text';
    const value = (formData[field] as string) || '';
    const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (fieldType === 'textarea') {
      return (
        <div key={field} className={styles.field}>
          <label className={styles.label}>{label}</label>
          <textarea
            className={styles.textarea}
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            rows={4}
            disabled={saving}
          />
        </div>
      );
    }

    if (fieldType === 'select') {
      const options = SELECT_OPTIONS[field] || [];
      return (
        <div key={field} className={styles.field}>
          <label className={styles.label}>{label}</label>
          <select
            className={styles.select}
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            disabled={saving}
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldType === 'number') {
      const numValue = formData[field] as number | undefined;
      return (
        <div key={field} className={styles.field}>
          <label className={styles.label}>{label}</label>
          <input
            type="number"
            className={styles.input}
            value={numValue ?? ''}
            onChange={(e) => handleFieldChange(field, e.target.value ? parseInt(e.target.value, 10) : '')}
            min={1}
            disabled={saving}
          />
        </div>
      );
    }

    return (
      <div key={field} className={styles.field}>
        <label className={styles.label}>{label}</label>
        <input
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          disabled={saving}
        />
      </div>
    );
  };

  if (editableFields.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noFields}>
          No editable fields for {node.type} nodes.
        </div>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} type="button">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Edit {node.type}</h3>
        <span className={styles.nodeId}>{node.id}</span>
      </div>

      <div className={styles.form}>
        {editableFields.map(renderField)}
      </div>

      <div className={styles.actions}>
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
          disabled={!hasChanges || saving}
          type="button"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
