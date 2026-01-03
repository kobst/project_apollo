/**
 * Modal for adding a new edge/relation.
 * Guides user through edge type selection, target node selection, and properties.
 */

import { useState, useCallback, useMemo } from 'react';
import type { NodeData, EdgeType, EdgeProperties, CreateEdgeRequest } from '../../api/types';
import { EDGE_TEMPLATES, getEdgeTypesForSource, getEdgeTypesForTarget } from '../../config/edgeTemplates';
import { EdgePropertiesForm } from './EdgePropertiesForm';
import { NodePicker } from './NodePicker';
import styles from './AddRelationModal.module.css';

interface AddRelationModalProps {
  /** The node we're adding a relation from/to */
  currentNode: NodeData;
  /** Direction of the relation relative to current node */
  direction: 'outgoing' | 'incoming';
  /** All available nodes for the picker */
  availableNodes: NodeData[];
  /** Called when user confirms the new edge */
  onAdd: (edge: CreateEdgeRequest) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Loading state */
  saving?: boolean;
}

type Step = 'type' | 'target' | 'properties';

export function AddRelationModal({
  currentNode,
  direction,
  availableNodes,
  onAdd,
  onCancel,
  saving = false,
}: AddRelationModalProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<EdgeType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<NodeData | null>(null);
  const [properties, setProperties] = useState<EdgeProperties>({});
  const [propertiesValid, setPropertiesValid] = useState(true);

  // Get valid edge types based on current node type and direction
  const validEdgeTypes = useMemo(() => {
    if (direction === 'outgoing') {
      return getEdgeTypesForSource(currentNode.type);
    }
    return getEdgeTypesForTarget(currentNode.type);
  }, [currentNode.type, direction]);

  // Get allowed target types for selected edge type
  const allowedTargetTypes = useMemo(() => {
    if (!selectedType) return [];
    const template = EDGE_TEMPLATES[selectedType];
    return direction === 'outgoing' ? template.targetTypes : template.sourceTypes;
  }, [selectedType, direction]);

  // Filter out current node from available nodes
  const targetNodes = useMemo(() => {
    return availableNodes.filter((n) => n.id !== currentNode.id);
  }, [availableNodes, currentNode.id]);

  const handleTypeSelect = useCallback((type: EdgeType) => {
    setSelectedType(type);
    // Reset target if it's no longer valid for new type
    if (selectedTarget) {
      const template = EDGE_TEMPLATES[type];
      const validTypes = direction === 'outgoing' ? template.targetTypes : template.sourceTypes;
      if (!validTypes.includes(selectedTarget.type)) {
        setSelectedTarget(null);
      }
    }
    setStep('target');
  }, [direction, selectedTarget]);

  const handleTargetSelect = useCallback((node: NodeData | null) => {
    setSelectedTarget(node);
    if (node) {
      setStep('properties');
    }
  }, []);

  const handlePropertiesChange = useCallback((props: EdgeProperties, isValid: boolean) => {
    setProperties(props);
    setPropertiesValid(isValid);
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'target') {
      setStep('type');
    } else if (step === 'properties') {
      setStep('target');
    }
  }, [step]);

  const handleAdd = useCallback(() => {
    if (!selectedType || !selectedTarget || !propertiesValid) return;

    const edge: CreateEdgeRequest = {
      type: selectedType,
      from: direction === 'outgoing' ? currentNode.id : selectedTarget.id,
      to: direction === 'outgoing' ? selectedTarget.id : currentNode.id,
      status: 'approved',
    };

    // Only include properties if there are any
    if (Object.keys(properties).length > 0) {
      edge.properties = properties;
    }

    onAdd(edge);
  }, [selectedType, selectedTarget, properties, propertiesValid, direction, currentNode.id, onAdd]);

  const canProceed = useMemo(() => {
    if (step === 'type') return selectedType !== null;
    if (step === 'target') return selectedTarget !== null;
    if (step === 'properties') return propertiesValid;
    return false;
  }, [step, selectedType, selectedTarget, propertiesValid]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            Add {direction === 'outgoing' ? 'Outgoing' : 'Incoming'} Relation
          </h3>
          <button className={styles.closeBtn} onClick={onCancel} type="button" aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {/* Progress indicator */}
          <div className={styles.progress}>
            <div className={`${styles.progressStep} ${step === 'type' ? styles.active : ''} ${selectedType ? styles.completed : ''}`}>
              1. Type
            </div>
            <div className={styles.progressLine} />
            <div className={`${styles.progressStep} ${step === 'target' ? styles.active : ''} ${selectedTarget ? styles.completed : ''}`}>
              2. Target
            </div>
            <div className={styles.progressLine} />
            <div className={`${styles.progressStep} ${step === 'properties' ? styles.active : ''}`}>
              3. Properties
            </div>
          </div>

          {/* Current node info */}
          <div className={styles.currentNode}>
            <span className={styles.currentNodeLabel}>
              {direction === 'outgoing' ? 'From:' : 'To:'}
            </span>
            <span className={styles.currentNodeName}>{currentNode.label}</span>
            <span className={styles.currentNodeType}>{currentNode.type}</span>
          </div>

          {/* Step 1: Select edge type */}
          {step === 'type' && (
            <div className={styles.stepContent}>
              <h4 className={styles.stepTitle}>Select Relation Type</h4>
              {validEdgeTypes.length === 0 ? (
                <div className={styles.noOptions}>
                  No valid edge types for {currentNode.type} nodes.
                </div>
              ) : (
                <div className={styles.typeList}>
                  {validEdgeTypes.map((type) => {
                    const template = EDGE_TEMPLATES[type];
                    return (
                      <button
                        key={type}
                        className={`${styles.typeOption} ${selectedType === type ? styles.typeSelected : ''}`}
                        onClick={() => handleTypeSelect(type)}
                        type="button"
                      >
                        <span className={styles.typeName}>{template.label}</span>
                        <span className={styles.typeCode}>{type}</span>
                        <span className={styles.typeDesc}>{template.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select target node */}
          {step === 'target' && selectedType && (
            <div className={styles.stepContent}>
              <h4 className={styles.stepTitle}>
                Select {direction === 'outgoing' ? 'Target' : 'Source'} Node
              </h4>
              <div className={styles.selectedTypeInfo}>
                <span className={styles.edgeTypeTag}>{selectedType}</span>
                <span className={styles.edgeTypeLabel}>{EDGE_TEMPLATES[selectedType].label}</span>
              </div>
              <NodePicker
                nodes={targetNodes}
                selectedId={selectedTarget?.id}
                allowedTypes={allowedTargetTypes}
                placeholder={`Select a ${allowedTargetTypes.join(' or ')}...`}
                disabled={saving}
                onChange={handleTargetSelect}
              />
            </div>
          )}

          {/* Step 3: Configure properties */}
          {step === 'properties' && selectedType && selectedTarget && (
            <div className={styles.stepContent}>
              <h4 className={styles.stepTitle}>Configure Properties</h4>
              <div className={styles.edgeSummary}>
                <span className={styles.summaryNode}>{currentNode.label}</span>
                <span className={styles.summaryArrow}>
                  {direction === 'outgoing' ? '→' : '←'}
                </span>
                <span className={styles.summaryType}>{selectedType}</span>
                <span className={styles.summaryArrow}>
                  {direction === 'outgoing' ? '→' : '←'}
                </span>
                <span className={styles.summaryNode}>{selectedTarget.label}</span>
              </div>
              <EdgePropertiesForm
                edgeType={selectedType}
                onChange={handlePropertiesChange}
                disabled={saving}
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {step !== 'type' && (
            <button
              className={styles.backBtn}
              onClick={handleBack}
              disabled={saving}
              type="button"
            >
              Back
            </button>
          )}
          <div className={styles.rightActions}>
            <button
              className={styles.cancelBtn}
              onClick={onCancel}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            {step === 'properties' ? (
              <button
                className={styles.addBtn}
                onClick={handleAdd}
                disabled={!canProceed || saving}
                type="button"
              >
                {saving ? 'Adding...' : 'Add Relation'}
              </button>
            ) : (
              <button
                className={styles.nextBtn}
                onClick={() => setStep(step === 'type' ? 'target' : 'properties')}
                disabled={!canProceed}
                type="button"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
