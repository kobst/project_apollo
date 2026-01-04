/**
 * OrderableList - Drag-to-reorder list for selected items.
 * Uses @dnd-kit/sortable for accessible drag-and-drop.
 */

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SelectedTarget } from '../../hooks/useBulkAttach';
import type { NodeData } from '../../api/types';
import styles from './BulkAttachModal.module.css';

interface OrderableListProps {
  items: SelectedTarget[];
  nodes: Map<string, NodeData>;
  ordered: boolean;
  onReorder: (orderedIds: string[]) => void;
  onRemove: (id: string) => void;
}

interface SortableItemProps {
  item: SelectedTarget;
  node: NodeData | undefined;
  ordered: boolean;
  onRemove: (id: string) => void;
}

function SortableItem({ item, node, ordered, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.selectedItem} ${isDragging ? styles.selectedItemDragging : ''}`}
    >
      {ordered && (
        <span className={styles.dragHandle} {...attributes} {...listeners}>
          &#x2630;
        </span>
      )}
      {ordered && item.order !== undefined && (
        <span className={styles.orderBadge}>{item.order}</span>
      )}
      <div className={styles.selectedInfo}>
        <span className={styles.selectedLabel}>
          {node?.label ?? item.id}
        </span>
        {item.isNew && <span className={styles.newBadge}>new</span>}
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(item.id)}
        type="button"
        aria-label={`Remove ${node?.label ?? item.id}`}
      >
        &times;
      </button>
    </div>
  );
}

export function OrderableList({
  items,
  nodes,
  ordered,
  onReorder,
  onRemove,
}: OrderableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Start dragging after 5px movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder(newItems.map((item) => item.id));
      }
    },
    [items, onReorder]
  );

  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#x2610;</div>
        <div className={styles.emptyText}>
          Select items from the left panel
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem
            key={item.id}
            item={item}
            node={nodes.get(item.id)}
            ordered={ordered}
            onRemove={onRemove}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
