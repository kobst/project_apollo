import { useState } from 'react';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';

interface DeleteNodeModalProps {
  storyId: string;
  node: NodeData;
  onDeleted: () => void;
  onCancel: () => void;
}

export function DeleteNodeModal({ storyId, node, onDeleted, onCancel }: DeleteNodeModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await api.deleteNode(storyId, node.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1a1a1a', color: '#eee', width: 420, padding: 16, borderRadius: 8, border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Delete {node.type}</h3>
        <p style={{ opacity: 0.9 }}>Are you sure you want to delete “{node.label}”?</p>
        {error && <div style={{ color: '#ff6b6b', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={deleting}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={{ background: '#8b0000', color: '#fff' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

