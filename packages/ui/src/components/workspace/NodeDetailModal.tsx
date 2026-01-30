import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import { DeleteNodeModal } from './DeleteNodeModal';

interface NodeDetailModalProps {
  node: NodeData;
  allNodes: NodeData[];
  onClose: () => void;
  onNodeUpdated: () => void;
  onNodeDeleted: () => void;
}

export function NodeDetailModal({ node, onClose, onNodeUpdated, onNodeDeleted }: NodeDetailModalProps) {
  const { currentStoryId } = useStory();
  const [freshNode, setFreshNode] = useState<NodeData>(node);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentStoryId) return;
    try {
      const data = await api.getNode(currentStoryId, node.id);
      setFreshNode(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load node');
    }
  }, [currentStoryId, node.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 640, background: '#1a1a1a', color: '#eee', borderRadius: 8, border: '1px solid #333', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, marginRight: 8 }}>{freshNode.label}</h3>
          <span style={{ opacity: 0.8, fontSize: 12 }}>{freshNode.type}</span>
          <button style={{ marginLeft: 'auto' }} onClick={onClose}>×</button>
        </div>
        {error ? (
          <div style={{ color: '#ff6b6b' }}>{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Properties</div>
              <pre style={{ background: '#111', padding: 8, borderRadius: 6, maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(freshNode.data, null, 2)}</pre>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>IDs</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>ID: <code>{freshNode.id}</code></div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={() => { setShowDelete(true); }}>Delete</button>
          <button onClick={() => { void load(); onNodeUpdated(); }}>Refresh</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      {showDelete && currentStoryId && (
        <DeleteNodeModal
          storyId={currentStoryId}
          node={freshNode}
          onDeleted={() => { setShowDelete(false); onNodeDeleted(); onClose(); }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

