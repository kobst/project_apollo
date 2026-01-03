import type { ExtractProposalData } from '../../api/types';
import styles from './ProposalCard.module.css';

interface ProposalCardProps {
  proposal: ExtractProposalData;
  onAccept: () => void;
  loading: boolean;
}

export function ProposalCard({ proposal, onAccept, loading }: ProposalCardProps) {
  const confidencePercent = Math.round(proposal.confidence * 100);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{proposal.title}</span>
        <span className={styles.confidence}>{confidencePercent}%</span>
      </div>

      <div className={styles.description}>{proposal.description}</div>

      {proposal.extractedEntities.length > 0 && (
        <div className={styles.entities}>
          {proposal.extractedEntities.map((entity) => (
            <span key={entity.id} className={styles.entity}>
              <span className={styles.entityType}>{entity.type}</span>
              <span className={styles.entityName}>{entity.name}</span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.ops}>{proposal.opsCount} operations</span>
        <button
          className={styles.acceptBtn}
          onClick={onAccept}
          disabled={loading}
          type="button"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
