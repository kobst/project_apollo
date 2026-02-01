import type { GapsData, GapData } from '../../api/types';

interface GapIndicatorsProps {
  gaps: GapsData | null;
  onGenerateGap?: (gap: GapData) => void;
}

export function GapIndicators({ gaps, onGenerateGap }: GapIndicatorsProps) {
  if (!gaps) return null;
  const topGaps = gaps.gaps.slice(0, 3);
  const total = gaps.gaps.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: '#666' }}>Gaps: {total}</div>
      {topGaps.map((g) => (
        <div key={g.id} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span><span style={{ opacity: 0.7 }}>{g.tier}</span> — {g.title}</span>
          {onGenerateGap && (
            <button
              onClick={() => onGenerateGap(g)}
              style={{ fontSize: 10, padding: '2px 6px' }}
              type="button"
            >
              Generate
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
