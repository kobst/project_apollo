import type { GapsData } from '../../api/types';

interface GapIndicatorsProps {
  gaps: GapsData | null;
}

export function GapIndicators({ gaps }: GapIndicatorsProps) {
  if (!gaps) return null;
  const topGaps = gaps.gaps.slice(0, 3);
  const total = gaps.gaps.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: '#666' }}>Gaps: {total}</div>
      {topGaps.map((g) => (
        <div key={g.id} style={{ fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>{g.tier}</span>{' '}
          <span>— {g.title}</span>
        </div>
      ))}
    </div>
  );
}

