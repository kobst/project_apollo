import { useState, useMemo } from 'react';
import type { StashIdeaItem } from '../../context/StashContext';
import styles from './PlanningInventory.module.css';

type PlanningKind = NonNullable<StashIdeaItem['planningKind']>;
type StatusFilter = 'active' | 'all' | 'promoted' | 'dismissed';

interface PlanningInventoryProps {
  ideas: StashIdeaItem[];
  selectedIdeaId: string | null;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSelectIdea: (idea: StashIdeaItem) => void;
}

const KIND_ORDER: PlanningKind[] = ['constraint', 'question', 'direction', 'proposal', 'note'];

const KIND_LABELS: Record<PlanningKind, string> = {
  constraint: 'Constraints',
  question: 'Open Questions',
  direction: 'Directions',
  proposal: 'Proposals',
  note: 'Notes',
};

const DEFAULT_DOT = { char: '\u25CB', className: 'dotOpen' } as const;

const RESOLUTION_DOT: Record<string, { char: string; className: string }> = {
  open: DEFAULT_DOT,
  discussed: { char: '\u25D0', className: 'dotDiscussed' },
  resolved: { char: '\u25CF', className: 'dotResolved' },
  archived: { char: '\u25CF', className: 'dotResolved' },
};

export function PlanningInventory({
  ideas,
  selectedIdeaId,
  statusFilter,
  onStatusFilterChange,
  onSelectIdea,
}: PlanningInventoryProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(KIND_ORDER)
  );

  const filteredIdeas = useMemo(() => {
    if (statusFilter === 'all') return ideas;
    return ideas.filter((idea) => idea.status === statusFilter);
  }, [ideas, statusFilter]);

  const groupedByKind = useMemo(() => {
    const groups = new Map<PlanningKind, StashIdeaItem[]>();
    for (const kind of KIND_ORDER) {
      groups.set(kind, []);
    }
    for (const idea of filteredIdeas) {
      const kind = idea.planningKind ?? 'proposal';
      const list = groups.get(kind);
      if (list) list.push(idea);
    }
    return groups;
  }, [filteredIdeas]);

  const toggleGroup = (kind: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>Inventory</div>

      <div className={styles.groups}>
        {KIND_ORDER.map((kind) => {
          const items = groupedByKind.get(kind) ?? [];
          const isExpanded = expandedGroups.has(kind);

          return (
            <div key={kind} className={styles.group}>
              <button
                type="button"
                className={styles.groupHeader}
                onClick={() => toggleGroup(kind)}
              >
                <span className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}>
                  {'\u25B6'}
                </span>
                <span className={styles.groupLabel}>{KIND_LABELS[kind]}</span>
                <span className={styles.groupCount}>{items.length}</span>
              </button>

              {isExpanded && items.length > 0 && (
                <div className={styles.itemList}>
                  {kind === 'direction' ? (
                    <DirectionItems
                      items={items}
                      selectedIdeaId={selectedIdeaId}
                      onSelectIdea={onSelectIdea}
                    />
                  ) : (
                    items.map((idea) => (
                      <InventoryItem
                        key={idea.id}
                        idea={idea}
                        isSelected={idea.id === selectedIdeaId}
                        onSelect={() => onSelectIdea(idea)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <select
          className={styles.statusSelect}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
        >
          <option value="active">Active</option>
          <option value="all">All</option>
          <option value="promoted">Promoted</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
    </div>
  );
}

function InventoryItem({
  idea,
  isSelected,
  onSelect,
}: {
  idea: StashIdeaItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const dot = RESOLUTION_DOT[idea.resolutionStatus ?? 'open'] ?? DEFAULT_DOT;

  return (
    <button
      type="button"
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      onClick={onSelect}
    >
      <span className={styles.itemTitle}>{idea.title}</span>
      <span className={`${styles.resolutionDot} ${styles[dot.className]}`}>
        {dot.char}
      </span>
    </button>
  );
}

function DirectionItems({
  items,
  selectedIdeaId,
  onSelectIdea,
}: {
  items: StashIdeaItem[];
  selectedIdeaId: string | null;
  onSelectIdea: (idea: StashIdeaItem) => void;
}) {
  const byAct = useMemo(() => {
    const groups = new Map<number | 'unassigned', StashIdeaItem[]>();
    for (const idea of items) {
      const key = idea.targetAct ?? 'unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(idea);
    }
    // Sort by act number, unassigned last
    const sorted = [...groups.entries()].sort((a, b) => {
      if (a[0] === 'unassigned') return 1;
      if (b[0] === 'unassigned') return -1;
      return (a[0] as number) - (b[0] as number);
    });
    return sorted;
  }, [items]);

  // If all directions have no targetAct, just render flat
  if (byAct.length === 1 && byAct[0]?.[0] === 'unassigned') {
    return (
      <>
        {items.map((idea) => (
          <InventoryItem
            key={idea.id}
            idea={idea}
            isSelected={idea.id === selectedIdeaId}
            onSelect={() => onSelectIdea(idea)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {byAct.map(([act, actItems]) => (
        <div key={String(act)} className={styles.actSubGroup}>
          <div className={styles.actLabel}>
            {act === 'unassigned' ? 'Unassigned' : `Act ${act}`}
          </div>
          {actItems.map((idea) => (
            <InventoryItem
              key={idea.id}
              idea={idea}
              isSelected={idea.id === selectedIdeaId}
              onSelect={() => onSelectIdea(idea)}
            />
          ))}
        </div>
      ))}
    </>
  );
}
