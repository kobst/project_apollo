import { useState } from 'react';
import type {
  NodeChangeAI,
  EdgeChangeAI,
  StoryContextChange,
  PackageElementType,
  GenerationCount,
} from '../../api/types';
import styles from './EditableElement.module.css';

interface EditableElementProps {
  elementType: PackageElementType;
  elementIndex: number;
  element: NodeChangeAI | EdgeChangeAI | StoryContextChange;
  onEdit: (updated: NodeChangeAI | EdgeChangeAI | StoryContextChange) => void;
  onRegenerate: (guidance: string, count: GenerationCount) => void;
  loading?: boolean | undefined;
  regenerateOptions?: Array<NodeChangeAI | EdgeChangeAI | StoryContextChange> | undefined;
  onSelectOption?: ((option: NodeChangeAI | EdgeChangeAI | StoryContextChange) => void) | undefined;
}

// Get operation display
function getOpDisplay(op: string): { icon: string; className: string } {
  switch (op) {
    case 'add':
      return { icon: '+', className: styles.opAdd ?? '' };
    case 'modify':
      return { icon: '~', className: styles.opModify ?? '' };
    case 'delete':
      return { icon: '-', className: styles.opDelete ?? '' };
    default:
      return { icon: '?', className: '' };
  }
}

export function EditableElement({
  elementType,
  element,
  onEdit,
  onRegenerate,
  loading = false,
  regenerateOptions,
  onSelectOption,
}: EditableElementProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'regenerate'>('view');
  const [editedElement, setEditedElement] = useState(element);
  const [guidance, setGuidance] = useState('');
  const [count, setCount] = useState<GenerationCount>('few');

  const { icon, className } = getOpDisplay(element.operation);

  const handleSaveEdit = () => {
    onEdit(editedElement);
    setMode('view');
  };

  const handleCancelEdit = () => {
    setEditedElement(element);
    setMode('view');
  };

  const handleStartRegenerate = () => {
    onRegenerate(guidance, count);
  };

  const handleSelectOption = (option: NodeChangeAI | EdgeChangeAI | StoryContextChange) => {
    onSelectOption?.(option);
    setMode('view');
  };

  // Render based on element type
  if (elementType === 'storyContext') {
    return renderStoryContextElement(
      element as StoryContextChange,
      editedElement as StoryContextChange,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      regenerateOptions as StoryContextChange[] | undefined,
      icon,
      className
    );
  }

  if (elementType === 'node') {
    return renderNodeElement(
      element as NodeChangeAI,
      editedElement as NodeChangeAI,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      regenerateOptions as NodeChangeAI[] | undefined,
      icon,
      className
    );
  }

  if (elementType === 'edge') {
    return renderEdgeElement(
      element as EdgeChangeAI,
      editedElement as EdgeChangeAI,
      mode,
      setMode,
      setEditedElement,
      handleSaveEdit,
      handleCancelEdit,
      handleStartRegenerate,
      handleSelectOption,
      guidance,
      setGuidance,
      count,
      setCount,
      loading,
      regenerateOptions as EdgeChangeAI[] | undefined,
      icon,
      className
    );
  }

  return null;
}

// Story Context Element Renderer
function renderStoryContextElement(
  element: StoryContextChange,
  editedElement: StoryContextChange,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  setEditedElement: (e: StoryContextChange) => void,
  handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: StoryContextChange) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  regenerateOptions: StoryContextChange[] | undefined,
  icon: string,
  className: string
) {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type}>{element.section}</span>
        <div className={styles.actions}>
          {mode === 'view' && (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('edit')}
                disabled={loading}
                type="button"
              >
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'view' && (
        <p className={styles.content}>"{element.content}"</p>
      )}

      {mode === 'edit' && (
        <div className={styles.editForm}>
          <textarea
            className={styles.textarea}
            value={editedElement.content}
            onChange={(e) =>
              setEditedElement({ ...editedElement, content: e.target.value })
            }
            rows={4}
          />
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              type="button"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <p className={styles.optionContent}>"{opt.content}"</p>
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Node Element Renderer
function renderNodeElement(
  element: NodeChangeAI,
  editedElement: NodeChangeAI,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  setEditedElement: (e: NodeChangeAI) => void,
  handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: NodeChangeAI) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  regenerateOptions: NodeChangeAI[] | undefined,
  icon: string,
  className: string
) {
  const label = getNodeLabel(element);
  const description = getNodeDescription(element);

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type}>{element.node_type}:</span>
        <span className={styles.label}>{label}</span>
        <div className={styles.actions}>
          {mode === 'view' && (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('edit')}
                disabled={loading}
                type="button"
              >
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'view' && description && (
        <p className={styles.description}>{description}</p>
      )}

      {mode === 'edit' && (
        <div className={styles.editForm}>
          {renderNodeEditFields(element, editedElement, setEditedElement)}
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              type="button"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance (e.g., 'make more sympathetic')..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <div className={styles.optionHeader}>
                <span className={styles.optionLabel}>{getNodeLabel(opt)}</span>
              </div>
              {getNodeDescription(opt) && (
                <p className={styles.optionDescription}>
                  {getNodeDescription(opt)}
                </p>
              )}
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Edge Element Renderer
function renderEdgeElement(
  element: EdgeChangeAI,
  editedElement: EdgeChangeAI,
  mode: 'view' | 'edit' | 'regenerate',
  setMode: (m: 'view' | 'edit' | 'regenerate') => void,
  setEditedElement: (e: EdgeChangeAI) => void,
  handleSaveEdit: () => void,
  handleCancelEdit: () => void,
  handleStartRegenerate: () => void,
  handleSelectOption: (opt: EdgeChangeAI) => void,
  guidance: string,
  setGuidance: (g: string) => void,
  count: GenerationCount,
  setCount: (c: GenerationCount) => void,
  loading: boolean,
  regenerateOptions: EdgeChangeAI[] | undefined,
  icon: string,
  className: string
) {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <span className={styles.opIcon}>{icon}</span>
        <span className={styles.type}>{element.edge_type}:</span>
        <span className={styles.label}>
          {element.from} → {element.to}
        </span>
        <div className={styles.actions}>
          {mode === 'view' && (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('edit')}
                disabled={loading}
                type="button"
              >
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setMode('regenerate')}
                disabled={loading}
                type="button"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'edit' && (
        <div className={styles.editForm}>
          <div className={styles.formRow}>
            <label>From:</label>
            <input
              type="text"
              value={editedElement.from}
              onChange={(e) =>
                setEditedElement({ ...editedElement, from: e.target.value })
              }
            />
          </div>
          <div className={styles.formRow}>
            <label>To:</label>
            <input
              type="text"
              value={editedElement.to}
              onChange={(e) =>
                setEditedElement({ ...editedElement, to: e.target.value })
              }
            />
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={handleCancelEdit}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              type="button"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && !regenerateOptions && (
        <div className={styles.regenerateForm}>
          <input
            type="text"
            className={styles.guidanceInput}
            placeholder="Optional guidance..."
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <div className={styles.countSelector}>
            <label>Options:</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value as GenerationCount)}
            >
              <option value="few">Few (3)</option>
              <option value="standard">Standard (5)</option>
              <option value="many">Many (7)</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setMode('view')}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.regenerateBtn}
              onClick={handleStartRegenerate}
              disabled={loading}
              type="button"
            >
              {loading ? 'Generating...' : 'Generate Options'}
            </button>
          </div>
        </div>
      )}

      {mode === 'regenerate' && regenerateOptions && (
        <div className={styles.optionsList}>
          <h4 className={styles.optionsTitle}>Choose an option:</h4>
          {regenerateOptions.map((opt, idx) => (
            <button
              key={idx}
              className={styles.optionCard}
              onClick={() => handleSelectOption(opt)}
              type="button"
            >
              <span className={styles.optionLabel}>
                {opt.from} → {opt.to}
              </span>
            </button>
          ))}
          <button
            className={styles.cancelBtn}
            onClick={() => setMode('view')}
            type="button"
          >
            Keep Original
          </button>
        </div>
      )}
    </div>
  );
}

// Helper to render node edit fields based on type
function renderNodeEditFields(
  element: NodeChangeAI,
  editedElement: NodeChangeAI,
  setEditedElement: (e: NodeChangeAI) => void
) {
  const data = (editedElement.data ?? {}) as Record<string, unknown>;
  const nodeType = element.node_type.toLowerCase();

  const updateData = (field: string, value: unknown) => {
    setEditedElement({
      ...editedElement,
      data: { ...data, [field]: value },
    });
  };

  // Common fields based on node type
  if (nodeType === 'character') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Name:</label>
          <input
            type="text"
            value={(data.name as string) ?? ''}
            onChange={(e) => updateData('name', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Role:</label>
          <input
            type="text"
            value={(data.role as string) ?? ''}
            onChange={(e) => updateData('role', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Description:</label>
          <textarea
            rows={3}
            value={(data.description as string) ?? ''}
            onChange={(e) => updateData('description', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Arc Summary:</label>
          <textarea
            rows={2}
            value={(data.arc_summary as string) ?? ''}
            onChange={(e) => updateData('arc_summary', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'plotpoint') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Title:</label>
          <input
            type="text"
            value={(data.title as string) ?? ''}
            onChange={(e) => updateData('title', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Intent:</label>
          <select
            value={(data.intent as string) ?? 'plot'}
            onChange={(e) => updateData('intent', e.target.value)}
          >
            <option value="plot">Plot</option>
            <option value="character">Character</option>
            <option value="tone">Tone</option>
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Summary:</label>
          <textarea
            rows={3}
            value={(data.summary as string) ?? ''}
            onChange={(e) => updateData('summary', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'scene') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Heading:</label>
          <input
            type="text"
            value={(data.heading as string) ?? ''}
            onChange={(e) => updateData('heading', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Overview:</label>
          <textarea
            rows={3}
            value={(data.scene_overview as string) ?? ''}
            onChange={(e) => updateData('scene_overview', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Tone:</label>
          <input
            type="text"
            value={(data.tone as string) ?? ''}
            onChange={(e) => updateData('tone', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'location') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Name:</label>
          <input
            type="text"
            value={(data.name as string) ?? ''}
            onChange={(e) => updateData('name', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Description:</label>
          <textarea
            rows={3}
            value={(data.description as string) ?? ''}
            onChange={(e) => updateData('description', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (nodeType === 'beat') {
    return (
      <>
        <div className={styles.formRow}>
          <label>Type:</label>
          <input
            type="text"
            value={(data.beat_type as string) ?? ''}
            onChange={(e) => updateData('beat_type', e.target.value)}
          />
        </div>
        <div className={styles.formRow}>
          <label>Act:</label>
          <select
            value={(data.act as number) ?? 1}
            onChange={(e) => updateData('act', parseInt(e.target.value, 10))}
          >
            <option value={1}>Act 1</option>
            <option value={2}>Act 2</option>
            <option value={3}>Act 3</option>
            <option value={4}>Act 4</option>
            <option value={5}>Act 5</option>
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Guidance:</label>
          <textarea
            rows={2}
            value={(data.guidance as string) ?? ''}
            onChange={(e) => updateData('guidance', e.target.value)}
          />
        </div>
      </>
    );
  }

  // Fallback: generic JSON editor
  return (
    <div className={styles.formRow}>
      <label>Data (JSON):</label>
      <textarea
        rows={6}
        value={JSON.stringify(data, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            setEditedElement({ ...editedElement, data: parsed });
          } catch {
            // Invalid JSON, ignore
          }
        }}
        className={styles.jsonEditor}
      />
    </div>
  );
}

// Helper functions
function getNodeLabel(node: NodeChangeAI): string {
  const data = node.data ?? {};
  return (
    (data.name as string) ??
    (data.title as string) ??
    (data.heading as string) ??
    node.node_id
  );
}

function getNodeDescription(node: NodeChangeAI): string | null {
  const data = node.data ?? {};
  return (
    (data.description as string) ??
    (data.summary as string) ??
    (data.scene_overview as string) ??
    null
  );
}
