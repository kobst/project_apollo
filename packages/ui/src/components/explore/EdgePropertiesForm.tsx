/**
 * Schema-aware form for editing edge properties.
 * Shows only fields allowed by the edge type template.
 */

import { useState, useEffect } from 'react';
import type { EdgeType, EdgeProperties } from '../../api/types';
import { EDGE_TEMPLATES, validateEdgeProperties } from '../../config/edgeTemplates';
import styles from './EdgePropertiesForm.module.css';

interface EdgePropertiesFormProps {
  edgeType: EdgeType;
  initialValues?: EdgeProperties | undefined;
  onChange: (properties: EdgeProperties, isValid: boolean) => void;
  disabled?: boolean | undefined;
}

export function EdgePropertiesForm({
  edgeType,
  initialValues,
  onChange,
  disabled = false,
}: EdgePropertiesFormProps) {
  const template = EDGE_TEMPLATES[edgeType];
  const [values, setValues] = useState<EdgeProperties>(initialValues ?? {});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const validation = validateEdgeProperties(edgeType, values as Record<string, unknown>);
    setErrors(validation.errors);
    onChange(values, validation.valid);
  }, [values, edgeType, onChange]);

  const handleChange = (field: keyof EdgeProperties, value: string) => {
    setValues((prev) => {
      const next = { ...prev };
      if (value === '' || value === undefined) {
        delete next[field];
      } else if (field === 'order') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          next.order = parsed;
        }
      } else if (field === 'weight' || field === 'confidence') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          next[field] = parsed;
        }
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const hasOrder = 'order' in template.properties;
  const hasWeight = 'weight' in template.properties;
  const hasConfidence = 'confidence' in template.properties;
  const hasNotes = 'notes' in template.properties;

  const orderConfig = template.properties.order;
  const weightConfig = template.properties.weight;
  const confidenceConfig = template.properties.confidence;

  return (
    <div className={styles.form}>
      {hasOrder && (
        <div className={styles.field}>
          <label className={styles.label}>
            Order
            {orderConfig?.required && <span className={styles.required}>*</span>}
          </label>
          <input
            type="number"
            className={styles.input}
            value={values.order ?? ''}
            onChange={(e) => handleChange('order', e.target.value)}
            min={orderConfig?.min}
            placeholder={orderConfig?.default?.toString() ?? '1'}
            disabled={disabled}
          />
          <span className={styles.hint}>Position in sequence (1, 2, 3...)</span>
        </div>
      )}

      {hasWeight && (
        <div className={styles.field}>
          <label className={styles.label}>Weight</label>
          <input
            type="number"
            className={styles.input}
            value={values.weight ?? ''}
            onChange={(e) => handleChange('weight', e.target.value)}
            min={weightConfig?.min}
            max={weightConfig?.max}
            step="0.1"
            placeholder="0.0 - 1.0"
            disabled={disabled}
          />
          <span className={styles.hint}>Strength of relationship (0-1)</span>
        </div>
      )}

      {hasConfidence && (
        <div className={styles.field}>
          <label className={styles.label}>Confidence</label>
          <input
            type="number"
            className={styles.input}
            value={values.confidence ?? ''}
            onChange={(e) => handleChange('confidence', e.target.value)}
            min={confidenceConfig?.min}
            max={confidenceConfig?.max}
            step="0.1"
            placeholder="0.0 - 1.0"
            disabled={disabled}
          />
          <span className={styles.hint}>How certain is this relationship (0-1)</span>
        </div>
      )}

      {hasNotes && (
        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            value={values.notes ?? ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Optional notes about this relationship..."
            rows={2}
            disabled={disabled}
          />
        </div>
      )}

      {errors.length > 0 && (
        <div className={styles.errors}>
          {errors.map((error, i) => (
            <div key={i} className={styles.error}>
              {error}
            </div>
          ))}
        </div>
      )}

      {!hasOrder && !hasWeight && !hasConfidence && !hasNotes && (
        <div className={styles.noFields}>
          No configurable properties for this edge type.
        </div>
      )}
    </div>
  );
}
