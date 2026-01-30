import { useState, useCallback, useEffect } from 'react';
import { useAgentJobs } from '../../hooks/useAgentJobs';

interface JobsDrawerProps {
  storyId: string;
}

export function JobsDrawer({ storyId }: JobsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const { jobs, runInterpreter, runGeneratorQuick } = useAgentJobs(storyId);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const runInterpreterAction = useCallback(async () => {
    if (!storyId || !userInput.trim()) return;
    await runInterpreter(userInput);
  }, [storyId, userInput, runInterpreter]);

  useEffect(() => {
    setOpen(false);
  }, [storyId]);

  return (
    <div style={{ position: 'fixed', right: 0, bottom: 0, width: open ? 360 : 48, height: open ? 420 : 48, background: '#111', color: '#eee', borderTopLeftRadius: 8, borderLeft: '1px solid #333', borderTop: '1px solid #333', overflow: 'hidden', transition: 'width 0.2s ease, height 0.2s ease', zIndex: 50 }}>
      <button style={{ width: 48, height: 48, background: 'transparent', color: '#eee', border: 'none', cursor: 'pointer', float: 'right' }} onClick={toggle} title={open ? 'Close Jobs' : 'Open Jobs'}>
        {open ? '×' : '⚙️'}
      </button>
      {open && (
        <div style={{ padding: 12 }}>
          <h3 style={{ margin: '4px 0 8px' }}>Agent Jobs</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Interpret: free text" style={{ flex: 1 }} />
            <button onClick={runInterpreterAction}>Run</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={async () => { await runGeneratorQuick('midpointX2'); }}>Generator (Midpoint x2)</button>
          </div>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {jobs.map((j) => (
              <div key={j.jobId} style={{ marginBottom: 10, padding: 8, background: '#1a1a1a', borderRadius: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>{j.agent} · <code>{j.jobId}</code></div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Status: {j.status}</div>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {j.events.slice(-5).map((e, idx) => (
                    <div key={idx}>
                      {e.type}: {e.type === 'progress' ? e.data.step : e.type === 'status' ? e.data.status : e.type === 'error' ? e.data.message : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
