import type { CoverageData } from '../../api/types';

interface CoverageSummaryProps {
  coverage: CoverageData | null;
}

export function CoverageSummary({ coverage }: CoverageSummaryProps) {
  if (!coverage) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {coverage.summary.map((tier) => (
        <div key={tier.tier} style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #eee', borderRadius: 4 }}>
          <span style={{ fontWeight: 600, marginRight: 6 }}>{tier.label}</span>
          <span>{tier.covered}/{tier.total}</span>
          <span style={{ marginLeft: 6, opacity: 0.7 }}>({Math.round(tier.percent)}%)</span>
        </div>
      ))}
    </div>
  );
}

