import { useEffect, useMemo, useState, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { useGeneration } from '../../context/GenerationContext';
import { api } from '../../api/client';
import type { NarrativePackage, LintData, OverlayDiffData, DiffData } from '../../api/types';
import { JobsDrawer } from '../jobs/JobsDrawer';

export function StagingView() {
  const { currentStoryId } = useStory();
  const { session, loadSession, acceptPackage, rejectPackage, refinePackage, updatePackageElement } = useGeneration();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [lint, setLint] = useState<LintData | null>(null);
  const [overlay, setOverlay] = useState<OverlayDiffData | null>(null);
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);
  const [editingNodeJson, setEditingNodeJson] = useState<string>('');
  const [refinePrompt, setRefinePrompt] = useState<string>('Tighten pacing and sharpen conflict');
  const [highlightConflicts, setHighlightConflicts] = useState<boolean>(false);
  const [nodeOpsFilter, setNodeOpsFilter] = useState<Set<'add'|'modify'|'delete'>>(new Set(['add','modify','delete']));
  const [edgeOpsFilter, setEdgeOpsFilter] = useState<Set<'add'|'delete'>>(new Set(['add','delete']));
  const selectedPackage = useMemo(() => session?.packages.find(p => p.id === selectedPackageId) ?? null, [session, selectedPackageId]);
  const siblings = useMemo(() => {
    if (!session || !selectedPackage) return [] as NarrativePackage[];
    const parentId = (selectedPackage as any).parent_package_id as string | undefined;
    if (!parentId) return [];
    return session.packages.filter(p => (p as any).parent_package_id === parentId && p.id !== selectedPackage.id);
  }, [session, selectedPackage]);
  const children = useMemo(() => {
    if (!session || !selectedPackage) return [] as NarrativePackage[];
    return session.packages.filter(p => (p as any).parent_package_id === selectedPackage.id);
  }, [session, selectedPackage]);
  const ancestors = useMemo(() => {
    if (!session || !selectedPackage) return [] as NarrativePackage[];
    const map = new Map(session.packages.map(p => [p.id, p] as const));
    const list: NarrativePackage[] = [];
    let cursor: any = selectedPackage;
    while (cursor && cursor.parent_package_id) {
      const parent = map.get(cursor.parent_package_id as string);
      if (!parent) break;
      list.push(parent);
      cursor = parent as any;
    }
    return list.reverse();
  }, [session, selectedPackage]);

  const conflictNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedPackage?.impact?.conflicts) {
      for (const c of selectedPackage.impact.conflicts) {
        if ((c as any).existing_node_id) set.add((c as any).existing_node_id);
      }
    }
    return set;
  }, [selectedPackage]);

  useEffect(() => {
    if (currentStoryId) loadSession(currentStoryId);
  }, [currentStoryId, loadSession]);

  useEffect(() => {
    if (!selectedPackageId && session?.packages[0]) {
      setSelectedPackageId(session.packages[0].id);
    }
  }, [session, selectedPackageId]);

  const runStagedLint = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    const result = await api.lintStaged(currentStoryId, selectedPackageId);
    setLint(result);
  }, [currentStoryId, selectedPackageId]);

  const loadOverlay = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    const diff = await api.getOverlayDiff(currentStoryId, selectedPackageId);
    setOverlay(diff);
  }, [currentStoryId, selectedPackageId]);

  const [acceptInfo, setAcceptInfo] = useState<{ newVersionId: string; patchOpsApplied: number } | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const handleAccept = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    const resp = await acceptPackage(currentStoryId, selectedPackageId) as any;
    if (resp && resp.newVersionId) {
      setAcceptInfo({ newVersionId: resp.newVersionId, patchOpsApplied: resp.patchOpsApplied ?? 0 });
    }
    await loadSession(currentStoryId);
  }, [currentStoryId, selectedPackageId, acceptPackage, loadSession]);

  const handleReject = useCallback(() => {
    if (!selectedPackageId) return;
    rejectPackage(selectedPackageId);
  }, [selectedPackageId, rejectPackage]);

  const handleSendNodeToIdeas = useCallback(async (index: number) => {
    if (!currentStoryId || !selectedPackageId) return;
    const c = window.prompt('Idea category (character, plot, scene, worldbuilding, general):', 'general');
    const category = (c || '').trim().toLowerCase();
    const valid = ['character','plot','scene','worldbuilding','general'];
    const payload: any = { packageId: selectedPackageId, elementType: 'node', elementIndex: index };
    if (valid.includes(category)) payload.category = category;
    await api.createIdeaFromPackage(currentStoryId, payload);
  }, [currentStoryId, selectedPackageId]);

  const handleSendEdgeToIdeas = useCallback(async (index: number) => {
    if (!currentStoryId || !selectedPackageId) return;
    const c = window.prompt('Idea category (character, plot, scene, worldbuilding, general):', 'plot');
    const category = (c || '').trim().toLowerCase();
    const valid = ['character','plot','scene','worldbuilding','general'];
    const payload: any = { packageId: selectedPackageId, elementType: 'edge', elementIndex: index };
    if (valid.includes(category)) payload.category = category;
    await api.createIdeaFromPackage(currentStoryId, payload);
  }, [currentStoryId, selectedPackageId]);

  const handleSendSCToIdeas = useCallback(async (index: number) => {
    if (!currentStoryId || !selectedPackageId) return;
    const c = window.prompt('Idea category (character, plot, scene, worldbuilding, general):', 'general');
    const category = (c || '').trim().toLowerCase();
    const valid = ['character','plot','scene','worldbuilding','general'];
    const payload: any = { packageId: selectedPackageId, elementType: 'storyContext', elementIndex: index };
    if (valid.includes(category)) payload.category = category;
    await api.createIdeaFromPackage(currentStoryId, payload);
  }, [currentStoryId, selectedPackageId]);

  const startEditNode = (index: number) => {
    if (!selectedPackage) return;
    setEditingNodeIndex(index);
    const nc = selectedPackage.changes.nodes[index];
    if (!nc) return;
    setEditingNodeJson(JSON.stringify(nc.data ?? {}, null, 2));
  };

  const saveEditNode = async () => {
    if (!currentStoryId || !selectedPackageId || editingNodeIndex == null || !selectedPackage) return;
    try {
      const parsed = editingNodeJson ? JSON.parse(editingNodeJson) : {};
      const nc = selectedPackage.changes.nodes[editingNodeIndex];
      const newElement = { ...nc, data: parsed };
      await updatePackageElement(currentStoryId, selectedPackageId, 'node', editingNodeIndex, newElement as any);
      setEditingNodeIndex(null);
    } catch (err) {
      alert('Invalid JSON for node data');
    }
  };

  const handleRefine = useCallback(async () => {
    if (!currentStoryId || !selectedPackageId) return;
    await refinePackage(currentStoryId, selectedPackageId, refinePrompt, 0.5);
    await loadSession(currentStoryId);
  }, [currentStoryId, selectedPackageId, refinePrompt, refinePackage, loadSession]);

  if (!currentStoryId) return <div style={{ padding: 16 }}>Select a story to view staging.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: 'calc(100vh - 120px)' }}>
      {/* Packages Pane */}
      <div style={{ borderRight: '1px solid #333', overflow: 'auto' }}>
        <div style={{ padding: '12px 12px 8px', fontWeight: 600 }}>Staged Packages</div>
        <div>
          {(session?.packages ?? []).map((p: NarrativePackage) => (
            <button key={p.id} onClick={() => setSelectedPackageId(p.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: selectedPackageId === p.id ? '#222' : 'transparent', color: '#eee', cursor: 'pointer'
            }}>
              <div style={{ fontWeight: 600 }}>{p.title || '(Untitled Package)'}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Conf: {Math.round((p.confidence ?? 0) * 100)}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* Package Detail */}
      <div style={{ padding: 16, position: 'relative' }}>
        {selectedPackage ? (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{selectedPackage.title}</h2>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Confidence {Math.round((selectedPackage.confidence ?? 0)*100)}%</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={loadOverlay}>Preview Overlay</button>
                <button onClick={runStagedLint}>Run Critic</button>
                <input value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} placeholder="Refine prompt" style={{ width: 240 }} />
                <button onClick={handleRefine}>Refine</button>
                <button onClick={handleAccept} disabled={lint?.summary?.hasBlockingErrors === true}>Accept</button>
                <button onClick={handleReject}>Reject</button>
              </div>
            </div>

            {/* Lineage */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
              {/* Breadcrumbs */}
              {ancestors.length > 0 && (
                <div style={{ fontSize: 12 }}>
                  {ancestors.map((a, idx) => (
                    <span key={a.id}>
                      <button onClick={() => setSelectedPackageId(a.id)}>{a.title || a.id}</button>
                      {idx < ancestors.length ? ' → ' : ''}
                    </span>
                  ))}
                  <span style={{ opacity: 0.7 }}>{selectedPackage.title || selectedPackage.id}</span>
                </div>
              )}
              {((selectedPackage as any).parent_package_id) && (
                <button onClick={() => setSelectedPackageId((selectedPackage as any).parent_package_id)}>↑ Parent</button>
              )}
              {siblings.length > 0 && (
                <div style={{ fontSize: 12 }}>
                  Siblings:
                  {siblings.map(s => (
                    <button key={s.id} style={{ marginLeft: 6 }} onClick={() => setSelectedPackageId(s.id)}>{s.title || s.id}</button>
                  ))}
                </div>
              )}
              {children.length > 0 && (
                <div style={{ fontSize: 12 }}>
                  Children:
                  {children.map(c => (
                    <button key={c.id} style={{ marginLeft: 6 }} onClick={() => setSelectedPackageId(c.id)}>{c.title || c.id}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Overview */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Nodes</div>
                  {/* Filters */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                    <label style={{ fontSize: 12 }}><input type="checkbox" checked={nodeOpsFilter.has('add')} onChange={(e) => {
                      const next = new Set(nodeOpsFilter); e.target.checked ? next.add('add') : next.delete('add'); setNodeOpsFilter(next);
                    }} /> add</label>
                    <label style={{ fontSize: 12 }}><input type="checkbox" checked={nodeOpsFilter.has('modify')} onChange={(e) => {
                      const next = new Set(nodeOpsFilter); e.target.checked ? next.add('modify') : next.delete('modify'); setNodeOpsFilter(next);
                    }} /> modify</label>
                    <label style={{ fontSize: 12 }}><input type="checkbox" checked={nodeOpsFilter.has('delete')} onChange={(e) => {
                      const next = new Set(nodeOpsFilter); e.target.checked ? next.add('delete') : next.delete('delete'); setNodeOpsFilter(next);
                    }} /> delete</label>
                    <label style={{ fontSize: 12, marginLeft: 12 }}><input type="checkbox" checked={highlightConflicts} onChange={(e) => setHighlightConflicts(e.target.checked)} /> highlight conflicts</label>
                  </div>
                  <ul>
                    {selectedPackage.changes.nodes.filter(n => nodeOpsFilter.has(n.operation as any)).map((n, i) => (
                      <li key={i} style={{ marginBottom: 8, background: highlightConflicts && conflictNodeIds.has(n.node_id) ? '#402020' : 'transparent', borderRadius: 4, padding: highlightConflicts && conflictNodeIds.has(n.node_id) ? 6 : 0 }}>
                        <div>
                          <code>{n.operation}</code> {n.node_type} <span style={{ opacity: 0.8 }}>({n.node_id})</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button onClick={() => handleSendNodeToIdeas(i)}>Send to Ideas</button>
                          <button onClick={() => startEditNode(i)}>Edit</button>
                          {n.data && ((n.data as any).name || (n.data as any).title) && (
                            <button onClick={async () => {
                              const currentName = (n.data as any).name ?? (n.data as any).title ?? '';
                              const next = window.prompt('New name/title', String(currentName));
                              if (next != null && currentStoryId && selectedPackageId) {
                                const updated = { ...n, data: { ...(n.data ?? {}), ...(((n.data as any).name != null) ? { name: next } : { title: next }) } };
                                await updatePackageElement(currentStoryId, selectedPackageId, 'node', i, updated as any);
                              }
                            }}>Rename</button>
                          )}
                        </div>
                        {editingNodeIndex === i && (
                          <div style={{ marginTop: 6 }}>
                            <textarea value={editingNodeJson} onChange={(e) => setEditingNodeJson(e.target.value)} style={{ width: '100%', height: 120, fontFamily: 'monospace' }} />
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <button onClick={saveEditNode}>Save</button>
                              <button onClick={() => setEditingNodeIndex(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Edges</div>
                  {/* Filters */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                    <label style={{ fontSize: 12 }}><input type="checkbox" checked={edgeOpsFilter.has('add')} onChange={(e) => {
                      const next = new Set(edgeOpsFilter); e.target.checked ? next.add('add') : next.delete('add'); setEdgeOpsFilter(next);
                    }} /> add</label>
                    <label style={{ fontSize: 12 }}><input type="checkbox" checked={edgeOpsFilter.has('delete')} onChange={(e) => {
                      const next = new Set(edgeOpsFilter); e.target.checked ? next.add('delete') : next.delete('delete'); setEdgeOpsFilter(next);
                    }} /> delete</label>
                  </div>
                  <ul>
                    {selectedPackage.changes.edges.filter(e => edgeOpsFilter.has(e.operation as any)).map((e, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        <div><code>{e.operation}</code> {e.edge_type} <span style={{ opacity: 0.8 }}>({e.from} → {e.to})</span></div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button onClick={() => handleSendEdgeToIdeas(i)}>Send to Ideas</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Critic */}
            {lint && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Critic</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
                  Errors: {lint.summary.errorCount} · Warnings: {lint.summary.warningCount}
                </div>
                <ul>
                  {lint.violations.map(v => (
                    <li key={v.id} style={{ color: v.severity === 'hard' ? '#ff6b6b' : '#ffd166' }}>
                      [{v.severity}] {v.ruleId}: {v.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Impact */}
            {selectedPackage.impact && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Impact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Fulfills</div>
                    <ul style={{ fontSize: 12 }}>
                      {(selectedPackage.impact.fulfills_gaps ?? []).map((g) => (<li key={g}><code>{g}</code></li>))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Creates</div>
                    <ul style={{ fontSize: 12 }}>
                      {(selectedPackage.impact.creates_gaps ?? []).map((g) => (<li key={g}><code>{g}</code></li>))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Conflicts</div>
                    <ul style={{ fontSize: 12 }}>
                      {(selectedPackage.impact.conflicts ?? []).map((c, i) => (<li key={i}>{c.type}: {c.description}</li>))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Story Context suggestions */}
            {selectedPackage.changes.storyContext && selectedPackage.changes.storyContext.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Story Context</div>
                <ul>
                  {selectedPackage.changes.storyContext.map((sc, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <code>{(sc as any).operation ?? (sc as any).type}</code>
                      <button style={{ marginLeft: 8 }} onClick={() => handleSendSCToIdeas(i)}>Send to Ideas</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overlay */}
            {overlay && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Overlay Preview (Summary)</div>
                <div style={{ fontSize: 12 }}>
                  Nodes +{overlay.nodes.created.length} ~{overlay.nodes.modified.length} -{overlay.nodes.deleted.length}
                  {'  '}Edges +{overlay.edges.created.length} -{overlay.edges.deleted.length}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 24, opacity: 0.8 }}>No package selected.</div>
        )}

        {acceptInfo && (
          <div style={{ position: 'fixed', left: 16, bottom: diffOpen ? 220 : 16, background: '#0f5132', color: '#d1e7dd', border: '1px solid #0f5132', padding: '10px 12px', borderRadius: 6 }}>
            Accepted package. New version: <code>{acceptInfo.newVersionId}</code> (ops: {acceptInfo.patchOpsApplied}).
            <button style={{ marginLeft: 8 }} onClick={() => { navigator.clipboard?.writeText(acceptInfo.newVersionId).catch(() => {}); }}>Copy ID</button>
            <button style={{ marginLeft: 8 }} onClick={async () => {
              if (!currentStoryId || !acceptInfo) return;
              const d = await api.getDiff(currentStoryId, undefined, acceptInfo.newVersionId);
              setDiffData(d);
              setDiffOpen(true);
            }}>View Diff</button>
            <button style={{ marginLeft: 8 }} onClick={() => window.open(`/api/stories/${currentStoryId}/log?limit=10`, '_blank')}>View Log (raw)</button>
          </div>
        )}
        {diffOpen && diffData && (
          <div style={{ position: 'fixed', left: 16, bottom: 16, width: 520, maxHeight: 180, overflow: 'auto', background: '#1a1a1a', color: '#eee', border: '1px solid #333', borderRadius: 6, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong>Diff Summary</strong>
              <button style={{ marginLeft: 'auto' }} onClick={() => setDiffOpen(false)}>×</button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, margin: '6px 0' }}>
              Nodes +{diffData.summary.nodesAdded} ~{diffData.summary.nodesModified} -{diffData.summary.nodesRemoved}
              {'  '}Edges +{diffData.summary.edgesAdded} -{diffData.summary.edgesRemoved}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>Added Nodes</div>
                <ul>
                  {diffData.nodes.added.slice(0, 6).map((n) => (<li key={n.id}>{n.type}: {n.label || n.id}</li>))}
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Modified Nodes</div>
                <ul>
                  {diffData.nodes.modified.slice(0, 6).map((m) => (<li key={m.id}>{m.nodeType} ({m.id})</li>))}
                </ul>
              </div>
            </div>
          </div>
        )}
        {currentStoryId && <JobsDrawer storyId={currentStoryId} />}
      </div>
    </div>
  );
}
