import { useState, useMemo } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import {
  mapRuntimeWorkboardToBoard,
  type RuntimeWorkboardProjection,
} from '../../workboard/runtimeWorkboardProjection';
import {
  IconPlus,
  IconTrash,
  IconLayoutColumns,
  IconFilter,
  IconX,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconTag,
  IconUser,
  IconAlertCircle,
  IconChartBar,
  IconClipboard,
  IconLayoutKanban,
} from '@tabler/icons-react';

// --- Types ---

export type CardPriority = 'low' | 'medium' | 'high' | 'critical';

export type CardLabel = {
  id: string;
  name: string;
  color: string;
};

export type WorkboardCard = {
  id: string;
  title: string;
  description?: string;
  priority: CardPriority;
  assignee?: string;
  labels?: string[];
  columnId: string;
  createdAt: string;
  updatedAt?: string;
};

export type WorkboardColumn = {
  id: string;
  name: string;
  order: number;
  color?: string;
};

export type WorkboardBoard = {
  id: string;
  name: string;
  description?: string;
  columns: WorkboardColumn[];
  cards: WorkboardCard[];
  labels?: CardLabel[];
};

export type WorkboardPanelProps = {
  boards: WorkboardBoard[];
  runtimeWorkboard?: RuntimeWorkboardProjection | null;
  onBoardSelect?: (boardId: string) => void;
  onCardCreate?: (boardId: string, card: Omit<WorkboardCard, 'id' | 'createdAt'>) => void;
  onCardUpdate?: (boardId: string, card: WorkboardCard) => void;
  onCardDelete?: (boardId: string, cardId: string) => void;
  onColumnCreate?: (boardId: string, name: string) => void;
  onColumnUpdate?: (boardId: string, columnId: string, name: string) => void;
  onColumnDelete?: (boardId: string, columnId: string) => void;
  onOpenCardInChat?: (boardId: string, cardId: string) => void;
  syncLabel?: string | null;
  syncDetail?: string | null;
  syncBusy?: boolean;
  onSyncNow?: (boardId?: string) => void | Promise<boolean | void>;
};

// --- Local nanostores ---

const $selectedTab = atom<'boards' | 'cards' | 'stats'>('boards');
const $searchQuery = atom('');
const $selectedBoard = atom<string | null>(null);
const $selectedCard = atom<WorkboardCard | null>(null);
const $filterPriority = atom<CardPriority | 'all'>('all');
const $filterAssignee = atom<string | null>(null);
const $filterLabels = atom<string[]>([]);
const $showFilters = atom(false);

// --- Constants ---

const PRIORITY_COLORS: Record<CardPriority, { bg: string; text: string; label: string }> = {
  low: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', label: 'Low' },
  medium: { bg: 'rgba(250, 204, 21, 0.15)', text: '#facc15', label: 'Medium' },
  high: { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c', label: 'High' },
  critical: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Critical' },
};

const COLUMN_COLORS = ['#60a5fa', '#a78bfa', '#f472b6', '#4ade80', '#facc15', '#22d3ee'];

// --- Helpers ---

function generateId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Sub-components ---

function PriorityBadge({ priority }: { priority: CardPriority }) {
  const style = PRIORITY_COLORS[priority];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: style.bg,
        color: style.text,
      }}
    >
      {priority === 'critical' && <IconAlertCircle size={10} />}
      {style.label}
    </span>
  );
}

function AssigneeAvatar({ name }: { name: string }) {
  const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#4ade80', '#facc15'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  return (
    <div
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: colors[colorIndex],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 500,
        background: 'rgba(255, 255, 255, 0.06)',
        color: '#a1a1aa',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <IconTag size={8} />
      {label}
      {onRemove && (
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: '#71717a',
            display: 'flex',
          }}
        >
          <IconX size={8} />
        </button>
      )}
    </span>
  );
}

function KanbanCard({
  card,
  onClick,
  onMoveLeft,
  onMoveRight,
  columnCount,
  columnIndex,
}: {
  card: WorkboardCard;
  onClick: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  columnCount: number;
  columnIndex: number;
}) {
  return (
    <div
      className="zvd-kanban-card"
      onClick={onClick}
    >
      <div className="zvd-kanban-card-header">
        <PriorityBadge priority={card.priority} />
        <div className="zvd-kanban-card-actions">
          {columnIndex > 0 && onMoveLeft && (
            <button
              className="zvd-icon-btn-sm"
              onClick={e => {
                e.stopPropagation();
                onMoveLeft();
              }}
              title="Move left"
            >
              <IconChevronLeft size={12} />
            </button>
          )}
          {columnIndex < columnCount - 1 && onMoveRight && (
            <button
              className="zvd-icon-btn-sm"
              onClick={e => {
                e.stopPropagation();
                onMoveRight();
              }}
              title="Move right"
            >
              <IconChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
      <p className="zvd-kanban-card-title">{card.title}</p>
      {card.description && (
        <p className="zvd-kanban-card-desc">{card.description}</p>
      )}
      {card.labels && card.labels.length > 0 && (
        <div className="zvd-kanban-card-labels">
          {card.labels.map(label => (
            <LabelChip key={label} label={label} />
          ))}
        </div>
      )}
      <div className="zvd-kanban-card-footer">
        {card.assignee && <AssigneeAvatar name={card.assignee} />}
        <span className="zvd-kanban-card-date">{formatDate(card.createdAt)}</span>
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  cards,
  allColumns,
  columnIndex,
  onCardClick,
  onCardMove,
  onAddCard,
}: {
  column: WorkboardColumn;
  cards: WorkboardCard[];
  allColumns: WorkboardColumn[];
  columnIndex: number;
  onCardClick: (card: WorkboardCard) => void;
  onCardMove: (cardId: string, targetColumnId: string) => void;
  onAddCard: () => void;
}) {
  return (
    <div className="zvd-kanban-column">
      <div
        className="zvd-kanban-column-header"
        style={{ borderTopColor: column.color || COLUMN_COLORS[columnIndex % COLUMN_COLORS.length] }}
      >
        <div className="zvd-kanban-column-title-row">
          <h4 className="zvd-kanban-column-title">{column.name}</h4>
          <span className="zvd-kanban-column-count">{cards.length}</span>
        </div>
        <button className="zvd-icon-btn-sm" onClick={onAddCard} title="Add card">
          <IconPlus size={14} />
        </button>
      </div>
      <div className="zvd-kanban-column-cards">
        {cards.length === 0 ? (
          <div className="zvd-kanban-column-empty">
            <IconClipboard size={20} style={{ opacity: 0.3 }} />
            <span>No cards</span>
          </div>
        ) : (
          cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              columnCount={allColumns.length}
              columnIndex={columnIndex}
              onMoveLeft={
                columnIndex > 0
                  ? () => onCardMove(card.id, allColumns[columnIndex - 1].id)
                  : undefined
              }
              onMoveRight={
                columnIndex < allColumns.length - 1
                  ? () => onCardMove(card.id, allColumns[columnIndex + 1].id)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function CardDetailModal({
  card,
  columns,
  onClose,
  onUpdate,
  onDelete,
  onOpenInChat,
}: {
  card: WorkboardCard;
  columns: WorkboardColumn[];
  onOpenInChat?: () => void;
  onClose: () => void;
  onUpdate: (card: WorkboardCard) => void;
  onDelete: () => void;
}) {
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description || '');
  const [editPriority, setEditPriority] = useState<CardPriority>(card.priority);
  const [editAssignee, setEditAssignee] = useState(card.assignee || '');
  const [editColumnId, setEditColumnId] = useState(card.columnId);

  const handleSave = () => {
    onUpdate({
      ...card,
      title: editTitle,
      description: editDesc,
      priority: editPriority,
      assignee: editAssignee || undefined,
      columnId: editColumnId,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="zvd-modal-overlay" onClick={onClose}>
      <div className="zvd-modal" onClick={e => e.stopPropagation()}>
        <div className="zvd-modal-header">
          <h3>Edit Card</h3>
          <button className="zvd-icon-btn" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <div className="zvd-modal-body">
          <div className="zvd-form-group">
            <label>Title</label>
            <input
              className="zvd-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
          </div>
          <div className="zvd-form-group">
            <label>Description</label>
            <textarea
              className="zvd-input zvd-textarea"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={3}
            />
          </div>
          <div className="zvd-form-row">
            <div className="zvd-form-group" style={{ flex: 1 }}>
              <label>Priority</label>
              <select
                className="zvd-select"
                value={editPriority}
                onChange={e => setEditPriority(e.target.value as CardPriority)}
              >
                {Object.entries(PRIORITY_COLORS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zvd-form-group" style={{ flex: 1 }}>
              <label>Column</label>
              <select
                className="zvd-select"
                value={editColumnId}
                onChange={e => setEditColumnId(e.target.value)}
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="zvd-form-group">
            <label>Assignee</label>
            <input
              className="zvd-input"
              value={editAssignee}
              onChange={e => setEditAssignee(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>
        </div>
        <div className="zvd-modal-footer">
          <button className="zvd-btn-danger" onClick={onDelete}>
            <IconTrash size={14} />
            Delete
          </button>
          <div className="zvd-modal-footer-right">
            {onOpenInChat && (
              <button
                className="zvd-btn-secondary"
                onClick={() => {
                  onOpenInChat();
                  onClose();
                }}
                type="button"
              >
                Open in chat
              </button>
            )}
            <button className="zvd-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="zvd-btn-primary" onClick={handleSave}>
              <IconCheck size={14} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCardModal({
  columnId,
  columns,
  onClose,
  onCreate,
}: {
  columnId: string;
  columns: WorkboardColumn[];
  onClose: () => void;
  onCreate: (card: Omit<WorkboardCard, 'id' | 'createdAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<CardPriority>('medium');
  const [assignee, setAssignee] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState(columnId);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assignee: assignee.trim() || undefined,
      columnId: selectedColumnId,
    });
    onClose();
  };

  return (
    <div className="zvd-modal-overlay" onClick={onClose}>
      <div className="zvd-modal" onClick={e => e.stopPropagation()}>
        <div className="zvd-modal-header">
          <h3>Create Card</h3>
          <button className="zvd-icon-btn" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <div className="zvd-modal-body">
          <div className="zvd-form-group">
            <label>Title</label>
            <input
              className="zvd-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Card title..."
              autoFocus
            />
          </div>
          <div className="zvd-form-group">
            <label>Description</label>
            <textarea
              className="zvd-input zvd-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>
          <div className="zvd-form-row">
            <div className="zvd-form-group" style={{ flex: 1 }}>
              <label>Priority</label>
              <select
                className="zvd-select"
                value={priority}
                onChange={e => setPriority(e.target.value as CardPriority)}
              >
                {Object.entries(PRIORITY_COLORS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zvd-form-group" style={{ flex: 1 }}>
              <label>Column</label>
              <select
                className="zvd-select"
                value={selectedColumnId}
                onChange={e => setSelectedColumnId(e.target.value)}
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="zvd-form-group">
            <label>Assignee</label>
            <input
              className="zvd-input"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>
        </div>
        <div className="zvd-modal-footer">
          <div className="zvd-modal-footer-right">
            <button className="zvd-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="zvd-btn-primary" onClick={handleCreate} disabled={!title.trim()}>
              <IconPlus size={14} />
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardStats({ board }: { board: WorkboardBoard }) {
  const stats = useMemo(() => {
    const total = board.cards.length;
    const byPriority = {
      low: board.cards.filter(c => c.priority === 'low').length,
      medium: board.cards.filter(c => c.priority === 'medium').length,
      high: board.cards.filter(c => c.priority === 'high').length,
      critical: board.cards.filter(c => c.priority === 'critical').length,
    };
    const byColumn = board.columns.map(col => ({
      column: col.name,
      count: board.cards.filter(c => c.columnId === col.id).length,
    }));
    const completionRate =
      total > 0
        ? Math.round(
            ((board.cards.filter(c => {
              const lastCol = board.columns[board.columns.length - 1];
              return lastCol && c.columnId === lastCol.id;
            }).length) /
              total) *
              100
          )
        : 0;
    const assignees = [...new Set(board.cards.filter(c => c.assignee).map(c => c.assignee!))];
    return { total, byPriority, byColumn, completionRate, assignees };
  }, [board]);

  return (
    <div className="zvd-stats-container">
      <div className="zvd-stats-grid">
        <div className="zvd-stat-card">
          <IconLayoutKanban size={20} style={{ color: '#60a5fa' }} />
          <div className="zvd-stat-value">{stats.total}</div>
          <div className="zvd-stat-label">Total Cards</div>
        </div>
        <div className="zvd-stat-card">
          <IconCheck size={20} style={{ color: '#4ade80' }} />
          <div className="zvd-stat-value">{stats.completionRate}%</div>
          <div className="zvd-stat-label">Completion Rate</div>
        </div>
        <div className="zvd-stat-card">
          <IconUser size={20} style={{ color: '#a78bfa' }} />
          <div className="zvd-stat-value">{stats.assignees.length}</div>
          <div className="zvd-stat-label">Assignees</div>
        </div>
        <div className="zvd-stat-card">
          <IconLayoutColumns size={20} style={{ color: '#f472b6' }} />
          <div className="zvd-stat-value">{board.columns.length}</div>
          <div className="zvd-stat-label">Columns</div>
        </div>
      </div>

      <div className="zvd-stats-section">
        <h4 className="zvd-stats-section-title">Cards per Column</h4>
        <div className="zvd-stats-bars">
          {stats.byColumn.map((item, i) => (
            <div key={item.column} className="zvd-stats-bar-row">
              <span className="zvd-stats-bar-label">{item.column}</span>
              <div className="zvd-stats-bar-track">
                <div
                  className="zvd-stats-bar-fill"
                  style={{
                    width: stats.total > 0 ? `${(item.count / stats.total) * 100}%` : '0%',
                    background: COLUMN_COLORS[i % COLUMN_COLORS.length],
                  }}
                />
              </div>
              <span className="zvd-stats-bar-count">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="zvd-stats-section">
        <h4 className="zvd-stats-section-title">Priority Distribution</h4>
        <div className="zvd-stats-bars">
          {(Object.entries(stats.byPriority) as [CardPriority, number][]).map(([key, count]) => (
            <div key={key} className="zvd-stats-bar-row">
              <span className="zvd-stats-bar-label">{PRIORITY_COLORS[key].label}</span>
              <div className="zvd-stats-bar-track">
                <div
                  className="zvd-stats-bar-fill"
                  style={{
                    width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%',
                    background: PRIORITY_COLORS[key].text,
                  }}
                />
              </div>
              <span className="zvd-stats-bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardsListView({
  boards,
  selectedBoardId,
  onSelectBoard,
}: {
  boards: WorkboardBoard[];
  selectedBoardId: string | null;
  onSelectBoard: (id: string) => void;
}) {
  return (
    <div className="zvd-boards-list">
      {boards.length === 0 ? (
        <div className="zvd-empty-state">
          <IconLayoutKanban size={32} style={{ opacity: 0.3 }} />
          <p>No boards available</p>
        </div>
      ) : (
        boards.map(board => (
          <div
            key={board.id}
            className={`zvd-board-item ${selectedBoardId === board.id ? 'active' : ''}`}
            onClick={() => onSelectBoard(board.id)}
          >
            <div className="zvd-board-item-left">
              <IconLayoutKanban size={18} style={{ color: selectedBoardId === board.id ? '#f16a21' : '#71717a' }} />
              <div>
                <div className="zvd-board-item-name">{board.name}</div>
                {board.description && (
                  <div className="zvd-board-item-desc">{board.description}</div>
                )}
              </div>
            </div>
            <div className="zvd-board-item-meta">
              <span className="zvd-board-item-count">{board.cards.length} cards</span>
              <IconChevronRight size={14} style={{ color: '#71717a' }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- Main Panel ---

export function WorkboardPanel(props: WorkboardPanelProps) {
  const tab = useStore($selectedTab);
  const search = useStore($searchQuery);
  const selectedBoardId = useStore($selectedBoard);
  const selectedCard = useStore($selectedCard);
  const filterPriority = useStore($filterPriority);
  const filterAssignee = useStore($filterAssignee);
  const showFilters = useStore($showFilters);

  const [createCardColumnId, setCreateCardColumnId] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');

  const boards = useMemo(
    () => props.runtimeWorkboard ? [mapRuntimeWorkboardToBoard(props.runtimeWorkboard)] : props.boards,
    [props.runtimeWorkboard, props.boards]
  );

  const board = useMemo(
    () => boards.find(b => b.id === selectedBoardId) || boards[0] || null,
    [boards, selectedBoardId]
  );

  const filteredCards = useMemo(() => {
    if (!board) return [];
    let cards = [...board.cards];

    if (search) {
      const q = search.toLowerCase();
      cards = cards.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          (c.assignee && c.assignee.toLowerCase().includes(q))
      );
    }

    if (filterPriority !== 'all') {
      cards = cards.filter(c => c.priority === filterPriority);
    }

    if (filterAssignee) {
      cards = cards.filter(c => c.assignee === filterAssignee);
    }

    return cards;
  }, [board, search, filterPriority, filterAssignee]);

  const cardsByColumn = useMemo(() => {
    if (!board) return {};
    const map: Record<string, WorkboardCard[]> = {};
    board.columns.forEach(col => {
      map[col.id] = filteredCards.filter(c => c.columnId === col.id);
    });
    return map;
  }, [board, filteredCards]);

  const uniqueAssignees = useMemo(() => {
    if (!board) return [];
    return [...new Set(board.cards.filter(c => c.assignee).map(c => c.assignee!))];
  }, [board]);

  const handleSelectBoard = (id: string) => {
    $selectedBoard.set(id);
    props.onBoardSelect?.(id);
  };

  const handleOpenSelectedInChat = () => {
    if (!board || !selectedCard) return;
    props.onOpenCardInChat?.(board.id, selectedCard.id);
  };

  const handleCreateCard = (cardData: Omit<WorkboardCard, 'id' | 'createdAt'>) => {
    if (!board) return;
    props.onCardCreate?.(board.id, cardData);
  };

  const handleUpdateCard = (card: WorkboardCard) => {
    if (!board) return;
    props.onCardUpdate?.(board.id, card);
  };

  const handleDeleteCard = (cardId: string) => {
    if (!board) return;
    props.onCardDelete?.(board.id, cardId);
    $selectedCard.set(null);
  };

  const handleMoveCard = (cardId: string, targetColumnId: string) => {
    if (!board) return;
    const card = board.cards.find(c => c.id === cardId);
    if (!card) return;
    props.onCardUpdate?.(board.id, { ...card, columnId: targetColumnId });
  };

  const handleAddColumn = () => {
    if (!board || !newColumnName.trim()) return;
    props.onColumnCreate?.(board.id, newColumnName.trim());
    setNewColumnName('');
  };

  const handleRenameColumn = (columnId: string) => {
    if (!board || !newColumnName.trim()) return;
    props.onColumnUpdate?.(board.id, columnId, newColumnName.trim());
    setEditingColumn(null);
    setNewColumnName('');
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!board) return;
    props.onColumnDelete?.(board.id, columnId);
  };

  const getCardStats = () => {
    if (!board) return null;
    const total = board.cards.length;
    const done = board.cards.filter(c => {
      const lastCol = board.columns[board.columns.length - 1];
      return lastCol && c.columnId === lastCol.id;
    }).length;
    return { total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const cardStats = getCardStats();

  return (
    <PageFrame
      eyebrow="Project Management"
      description={props.syncDetail || 'Visualize and manage your workflow with Kanban boards. Local-first with optional runtime sync.'}
      meta={props.syncLabel || (board ? `${board.cards.length} cards` : 'no board')}
      title="Workboard"
      actions={props.onSyncNow ? (
        <button
          type="button"
          className="zvd-btn-secondary"
          disabled={props.syncBusy}
          onClick={() => void props.onSyncNow?.(board?.id)}
          aria-label="Sync workboard to runtime"
        >
          {props.syncBusy ? 'Syncing…' : 'Sync now'}
        </button>
      ) : undefined}
    >
      <style>{`
        .zvd-kanban-board {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding-bottom: 16px;
          flex: 1;
          min-height: 400px;
        }

        .zvd-kanban-column {
          min-width: 280px;
          max-width: 320px;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .zvd-kanban-column-header {
          padding: 12px 14px;
          border-top: 3px solid #60a5fa;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-kanban-column-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-kanban-column-title {
          font-size: 13px;
          font-weight: 600;
          color: #e4e4e7;
          margin: 0;
        }

        .zvd-kanban-column-count {
          font-size: 11px;
          font-weight: 600;
          color: #71717a;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .zvd-kanban-column-cards {
          flex: 1;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          max-height: 500px;
        }

        .zvd-kanban-column-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 32px 16px;
          color: #71717a;
          font-size: 12px;
        }

        .zvd-kanban-card {
          background: #0d0e12;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zvd-kanban-card:hover {
          border-color: rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-kanban-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .zvd-kanban-card-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .zvd-kanban-card:hover .zvd-kanban-card-actions {
          opacity: 1;
        }

        .zvd-kanban-card-title {
          font-size: 13px;
          font-weight: 500;
          color: #e4e4e7;
          margin: 0;
          line-height: 1.4;
        }

        .zvd-kanban-card-desc {
          font-size: 12px;
          color: #71717a;
          margin: 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .zvd-kanban-card-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .zvd-kanban-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        .zvd-kanban-card-date {
          font-size: 10px;
          color: #52525b;
        }

        .zvd-icon-btn-sm {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .zvd-icon-btn-sm:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .zvd-icon-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .zvd-icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .zvd-boards-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zvd-board-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .zvd-board-item:hover {
          border-color: rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-board-item.active {
          border-color: var(--zvd-accent, #f16a21);
          background: rgba(241, 106, 33, 0.04);
        }

        .zvd-board-item-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .zvd-board-item-name {
          font-size: 13px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .zvd-board-item-desc {
          font-size: 11px;
          color: #71717a;
          margin-top: 2px;
        }

        .zvd-board-item-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-board-item-count {
          font-size: 11px;
          color: #71717a;
        }

        .zvd-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px 24px;
          color: #71717a;
          font-size: 13px;
        }

        .zvd-stats-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .zvd-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .zvd-stat-card {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }

        .zvd-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #e4e4e7;
        }

        .zvd-stat-label {
          font-size: 11px;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .zvd-stats-section {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 16px;
        }

        .zvd-stats-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #e4e4e7;
          margin: 0 0 12px 0;
        }

        .zvd-stats-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .zvd-stats-bar-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .zvd-stats-bar-label {
          font-size: 12px;
          color: #a1a1aa;
          min-width: 80px;
        }

        .zvd-stats-bar-track {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 4px;
          overflow: hidden;
        }

        .zvd-stats-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }

        .zvd-stats-bar-count {
          font-size: 12px;
          font-weight: 600;
          color: #e4e4e7;
          min-width: 24px;
          text-align: right;
        }

        .zvd-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .zvd-modal {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          width: 440px;
          max-width: 90vw;
          max-height: 85vh;
          overflow-y: auto;
        }

        .zvd-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .zvd-modal-header h3 {
          font-size: 15px;
          font-weight: 600;
          color: #e4e4e7;
          margin: 0;
        }

        .zvd-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .zvd-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .zvd-modal-footer-right {
          display: flex;
          gap: 8px;
        }

        .zvd-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .zvd-form-group label {
          font-size: 12px;
          font-weight: 500;
          color: #a1a1aa;
        }

        .zvd-form-row {
          display: flex;
          gap: 12px;
        }

        .zvd-input {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 12px;
          color: #e4e4e7;
          font-size: 13px;
          outline: none;
        }

        .zvd-input:focus {
          border-color: var(--zvd-accent, #f16a21);
        }

        .zvd-textarea {
          resize: vertical;
          min-height: 60px;
        }

        .zvd-select {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 12px;
          color: #e4e4e7;
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }

        .zvd-btn-primary {
          background: var(--zvd-accent, #f16a21);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .zvd-btn-primary:hover {
          background: #e05b17;
        }

        .zvd-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .zvd-btn-secondary {
          background: rgba(255, 255, 255, 0.06);
          color: #e4e4e7;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .zvd-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .zvd-btn-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .zvd-btn-danger:hover {
          background: rgba(239, 68, 68, 0.25);
        }

        .zvd-filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #0d0e12;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .zvd-filter-select {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 6px 10px;
          color: #e4e4e7;
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }

        .zvd-board-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .zvd-add-column-form {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 240px;
        }

        .zvd-add-column-input {
          flex: 1;
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 6px 10px;
          color: #e4e4e7;
          font-size: 12px;
          outline: none;
        }

        .zvd-add-column-input:focus {
          border-color: var(--zvd-accent, #f16a21);
        }

        .theme-dark .zvd-kanban-column {
          background: #0d0e12;
          border-color: rgba(255, 255, 255, 0.04);
        }

        .theme-dark .zvd-kanban-column-header {
          background: rgba(255, 255, 255, 0.01);
        }

        .theme-dark .zvd-kanban-card {
          background: #08090c;
        }

        .theme-dark .zvd-board-item {
          background: #0d0e12;
        }

        .theme-dark .zvd-stat-card {
          background: #0d0e12;
        }

        .theme-dark .zvd-stats-section {
          background: #0d0e12;
        }

        .theme-dark .zvd-modal {
          background: #0d0e12;
        }

        .theme-dark .zvd-filter-bar {
          background: #08090c;
        }
      `}</style>

      <div className="zvd-workboard-container">
        <div className="zvd-board-toolbar">
          <SearchBox
            value={search}
            onChange={$searchQuery.set}
            placeholder="Search cards..."
          />
          <button
            className="zvd-icon-btn"
            onClick={() => $showFilters.set(!showFilters)}
            style={{
              background: showFilters ? 'rgba(241, 106, 33, 0.15)' : undefined,
              color: showFilters ? '#f16a21' : undefined,
            }}
            title="Toggle filters"
          >
            <IconFilter size={16} />
          </button>
        </div>

        {showFilters && (
          <div className="zvd-filter-bar">
            <IconFilter size={14} style={{ color: '#71717a' }} />
            <select
              className="zvd-filter-select"
              value={filterPriority}
              onChange={e => $filterPriority.set(e.target.value as CardPriority | 'all')}
            >
              <option value="all">All Priorities</option>
              {Object.entries(PRIORITY_COLORS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
            {uniqueAssignees.length > 0 && (
              <select
                className="zvd-filter-select"
                value={filterAssignee || ''}
                onChange={e => $filterAssignee.set(e.target.value || null)}
              >
                <option value="">All Assignees</option>
                {uniqueAssignees.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
            {(filterPriority !== 'all' || filterAssignee) && (
              <button
                className="zvd-icon-btn-sm"
                onClick={() => {
                  $filterPriority.set('all');
                  $filterAssignee.set(null);
                }}
                title="Clear filters"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        )}

        <TextTabs<'boards' | 'cards' | 'stats'>
          value={tab}
          onChange={$selectedTab.set}
          items={[
            { value: 'boards', label: 'Boards', count: boards.length },
            { value: 'cards', label: 'Cards', count: board?.cards.length || 0 },
            { value: 'stats', label: 'Stats' },
          ]}
        />

        {tab === 'boards' && (
          <BoardsListView
            boards={boards}
            selectedBoardId={selectedBoardId}
            onSelectBoard={handleSelectBoard}
          />
        )}

        {tab === 'cards' && board && (
          <div className="zvd-kanban-board">
            {board.columns.map((col, i) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={cardsByColumn[col.id] || []}
                allColumns={board.columns}
                columnIndex={i}
                onCardClick={card => $selectedCard.set(card)}
                onCardMove={handleMoveCard}
                onAddCard={() => setCreateCardColumnId(col.id)}
              />
            ))}
            <div className="zvd-kanban-column" style={{ minWidth: '200px', maxWidth: '240px', borderStyle: 'dashed' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#71717a', fontWeight: 500 }}>Add Column</span>
                <div className="zvd-add-column-form">
                  <input
                    className="zvd-add-column-input"
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    placeholder="Column name"
                    onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                  />
                  <button
                    className="zvd-icon-btn-sm"
                    onClick={handleAddColumn}
                    disabled={!newColumnName.trim()}
                    style={{
                      color: newColumnName.trim() ? '#4ade80' : undefined,
                    }}
                    title="Add column"
                  >
                    <IconCheck size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'cards' && !board && (
          <div className="zvd-empty-state">
            <IconLayoutKanban size={32} style={{ opacity: 0.3 }} />
            <p>Select a board from the Boards tab to view cards.</p>
          </div>
        )}

        {tab === 'stats' && board && <BoardStats board={board} />}

        {tab === 'stats' && !board && (
          <div className="zvd-empty-state">
            <IconChartBar size={32} style={{ opacity: 0.3 }} />
            <p>Select a board from the Boards tab to view statistics.</p>
          </div>
        )}

        {selectedCard && board && (
          <CardDetailModal
            card={selectedCard}
            columns={board.columns}
            onClose={() => $selectedCard.set(null)}
            onUpdate={handleUpdateCard}
            onDelete={() => handleDeleteCard(selectedCard.id)}
            onOpenInChat={props.onOpenCardInChat ? handleOpenSelectedInChat : undefined}
          />
        )}

        {createCardColumnId && board && (
          <CreateCardModal
            columnId={createCardColumnId}
            columns={board.columns}
            onClose={() => setCreateCardColumnId(null)}
            onCreate={handleCreateCard}
          />
        )}
      </div>
    </PageFrame>
  );
}

export default WorkboardPanel;
