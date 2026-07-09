import React, { useState, useEffect, useCallback } from 'react';
import { asErrorLike } from '../../utils/errorLike';

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface KanbanBoard {
  id: string;
  name: string;
  columns: string[];
  cardCount: number;
}

interface KanbanCard {
  id: string;
  board_id: string;
  title: string;
  description: string;
  column_name: string;
  assignee: string | null;
  subagent_id: string | null;
  priority: Priority;
  labels: string[];
  blocked_by: string | null;
  blocked_reason: string | null;
  auto_blocked: boolean;
  subtasks: Array<{ title: string; done: boolean }>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

interface KanbanComment {
  id: string;
  card_id: string;
  author: string;
  content: string;
  timestamp: string;
}

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  low: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  medium: { bg: 'rgba(250, 204, 21, 0.15)', text: '#facc15' },
  high: { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' },
  critical: { bg: 'rgba(248, 113, 113, 0.15)', text: '#f87171' },
};

const COLUMN_ICONS: Record<string, string> = {
  backlog: '📋',
  todo: '📝',
  in_progress: '🔄',
  review: '🔍',
  done: '✅',
};

export function KanbanBoardComponent() {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [boardData, setBoardData] = useState<{ board: KanbanBoard; cards: KanbanCard[] } | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [comments, setComments] = useState<KanbanComment[]>([]);
  
  // Form states
  const [newBoardName, setNewBoardName] = useState('');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');
  const [newCardPriority, setNewCardPriority] = useState<Priority>('medium');
  const [newCardCol, setNewCardCol] = useState('todo');
  const [newCommentText, setNewCommentText] = useState('');
  
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingBoard, setIsAddingBoard] = useState(false);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/web/kanban/boards');
      const data = await res.json();
      if (data.ok && Array.isArray(data.boards)) {
        setBoards(data.boards);
        if (data.boards.length > 0 && !selectedBoardId) {
          setSelectedBoardId(data.boards[0].id);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to fetch boards:', err);
    }
  }, [selectedBoardId]);

  const fetchBoardData = useCallback(async (boardId: string) => {
    if (!boardId) return;
    try {
      const res = await fetch(`/api/web/kanban/board?boardId=${boardId}`);
      const data = await res.json();
      if (data.ok) {
        setBoardData({ board: data.board, cards: data.cards });
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to fetch board details:', err);
    }
  }, []);

  const fetchComments = async (cardId: string) => {
    try {
      const res = await fetch(`/api/web/kanban/card/comments?cardId=${cardId}`);
      const data = await res.json();
      if (data.ok) {
        setComments(data.comments || []);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to fetch comments:', err);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (selectedBoardId) {
      fetchBoardData(selectedBoardId);
    }
  }, [selectedBoardId, fetchBoardData]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    try {
      const res = await fetch('/api/web/kanban/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBoardName }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewBoardName('');
        setIsAddingBoard(false);
        fetchBoards();
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to create board:', err);
    }
  };

  const handleCreateCard = async () => {
    if (!newCardTitle.trim() || !selectedBoardId) return;
    try {
      const res = await fetch('/api/web/kanban/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: selectedBoardId,
          title: newCardTitle,
          description: newCardDesc,
          column: newCardCol,
          priority: newCardPriority,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewCardTitle('');
        setNewCardDesc('');
        setIsAddingCard(false);
        fetchBoardData(selectedBoardId);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to create card:', err);
    }
  };

  const handleMoveCard = async (cardId: string, targetCol: string) => {
    if (!selectedBoardId) return;
    try {
      const res = await fetch('/api/web/kanban/card/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: selectedBoardId,
          cardId,
          targetColumn: targetCol,
          reason: 'Moved from Web Hub',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchBoardData(selectedBoardId);
        if (selectedCard?.id === cardId) {
          setSelectedCard((prev) => prev ? { ...prev, column_name: targetCol } : null);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to move card:', err);
    }
  };

  const handleAddComment = async (cardId: string) => {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch('/api/web/kanban/card/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          author: 'web-user',
          content: newCommentText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewCommentText('');
        fetchComments(cardId);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Failed to add comment:', err);
    }
  };

  const openCardDetails = (card: KanbanCard) => {
    setSelectedCard(card);
    fetchComments(card.id);
  };

  const columns = boardData?.board.columns || ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const cards = boardData?.cards || [];

  return (
    <div style={styles.container}>
      {/* Sidebar - Boards Navigation */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.title}>ZAVORTH KANBAN</span>
          <button style={styles.addBtnSmall} onClick={() => setIsAddingBoard(true)}>+</button>
        </div>

        {isAddingBoard && (
          <div style={styles.inlineForm}>
            <input
              type="text"
              placeholder="Board Name"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              style={styles.input}
            />
            <div style={styles.formActions}>
              <button onClick={handleCreateBoard} style={styles.submitBtnSmall}>Save</button>
              <button onClick={() => setIsAddingBoard(false)} style={styles.cancelBtnSmall}>X</button>
            </div>
          </div>
        )}

        <div style={styles.boardList}>
          {boards.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedBoardId(b.id)}
              style={{
                ...styles.boardItem,
                backgroundColor: selectedBoardId === b.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                borderLeft: selectedBoardId === b.id ? '3px solid #6366f1' : '3px solid transparent',
              }}
            >
              <span style={styles.boardItemName}>📋 {b.name}</span>
              <span style={styles.badge}>{b.cardCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Kanban Content Area */}
      <div style={styles.main}>
        <div style={styles.mainHeader}>
          <div style={styles.headerTitleArea}>
            <h2 style={styles.mainTitle}>{boardData?.board.name || 'Select a Board'}</h2>
            <span style={styles.subtitle}>{cards.length} cards active</span>
          </div>
          <button style={styles.addCardBtn} onClick={() => setIsAddingCard(true)}>
            + Add Card
          </button>
        </div>

        {/* Modal for adding cards */}
        {isAddingCard && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>Add New Task Card</h3>
              <input
                type="text"
                placeholder="Task Title"
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                style={styles.inputLarge}
              />
              <textarea
                placeholder="Description"
                value={newCardDesc}
                onChange={(e) => setNewCardDesc(e.target.value)}
                style={styles.textarea}
              />
              <div style={styles.formRow}>
                <div>
                  <label style={styles.label}>Column</label>
                  <select
                    value={newCardCol}
                    onChange={(e) => setNewCardCol(e.target.value)}
                    style={styles.select}
                  >
                    {columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Priority</label>
                  <select
                    value={newCardPriority}
                    onChange={(e) => setNewCardPriority(e.target.value as Priority)}
                    style={styles.select}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={styles.modalActions}>
                <button onClick={handleCreateCard} style={styles.submitBtn}>Create Card</button>
                <button onClick={() => setIsAddingCard(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board Grid */}
        <div style={styles.boardGrid}>
          {columns.map((col) => {
            const colCards = cards.filter((c) => c.column_name === col);
            return (
              <div key={col} style={styles.column}>
                <div style={styles.columnHeader}>
                  <span style={styles.columnName}>
                    {COLUMN_ICONS[col] || '📄'} {col.toUpperCase().replace('_', ' ')}
                  </span>
                  <span style={styles.badge}>{colCards.length}</span>
                </div>

                <div style={styles.columnContent}>
                  {colCards.map((card) => {
                    const pri = PRIORITY_COLORS[card.priority] || { bg: 'rgba(255,255,255,0.1)', text: '#fff' };
                    const doneSubtasks = card.subtasks ? card.subtasks.filter((s) => s.done).length : 0;
                    const totalSubtasks = card.subtasks ? card.subtasks.length : 0;
                    
                    return (
                      <div
                        key={card.id}
                        onClick={() => openCardDetails(card)}
                        style={{
                          ...styles.card,
                          borderLeft: card.blocked_by ? '4px solid #f87171' : `4px solid ${pri.text}`,
                        }}
                      >
                        <div style={styles.cardHeader}>
                          <span style={{ ...styles.priorityTag, backgroundColor: pri.bg, color: pri.text }}>
                            {card.priority}
                          </span>
                          {card.blocked_by && (
                            <span style={styles.blockedBadge}>🚫 Blocked</span>
                          )}
                        </div>

                        <div style={styles.cardTitle}>{card.title}</div>
                        {card.description && (
                          <div style={styles.cardDesc}>{card.description.slice(0, 100)}...</div>
                        )}

                        {totalSubtasks > 0 && (
                          <div style={styles.subtaskProgress}>
                            <div style={styles.subtaskText}>
                              Subtasks: {doneSubtasks}/{totalSubtasks}
                            </div>
                            <div style={styles.progressBarBg}>
                              <div
                                style={{
                                  ...styles.progressBarFill,
                                  width: `${(doneSubtasks / totalSubtasks) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div style={styles.cardFooter}>
                          {card.subagent_id && (
                            <span style={styles.subagentBadge}>🤖 {card.subagent_id.slice(0, 8)}</span>
                          )}
                          {card.assignee && (
                            <span style={styles.assigneeAvatar} title={`Assigned to ${card.assignee}`}>
                              {card.assignee.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Details Modal (Comments Stream & Handoff Info) */}
      {selectedCard && (
        <div style={styles.modalOverlay}>
          <div style={styles.detailsModal}>
            <div style={styles.detailsModalHeader}>
              <div>
                <span style={styles.cardIdBadge}>{selectedCard.id}</span>
                <h3 style={styles.detailsModalTitle}>{selectedCard.title}</h3>
              </div>
              <button onClick={() => setSelectedCard(null)} style={styles.closeModalBtn}>×</button>
            </div>

            <div style={styles.detailsModalBody}>
              <div style={styles.detailsLeftCol}>
                <h4 style={styles.sectionHeader}>Description</h4>
                <p style={styles.detailsDesc}>{selectedCard.description || 'No description provided.'}</p>

                {selectedCard.blocked_reason && (
                  <div style={styles.blockedReasonBox}>
                    <strong>🚫 Blocking Reason:</strong> {selectedCard.blocked_reason}
                  </div>
                )}

                <h4 style={styles.sectionHeader}>Move to Column</h4>
                <div style={styles.moveButtonGroup}>
                  {columns.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleMoveCard(selectedCard.id, c)}
                      disabled={selectedCard.column_name === c}
                      style={{
                        ...styles.moveBtn,
                        backgroundColor: selectedCard.column_name === c ? '#6366f1' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {COLUMN_ICONS[c] || ''} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right column - comments feed */}
              <div style={styles.detailsRightCol}>
                <h4 style={styles.sectionHeader}>Activity Log & Comments</h4>
                <div style={styles.commentsStream}>
                  {comments.length === 0 ? (
                    <p style={styles.emptyText}>No activity comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} style={styles.commentItem}>
                        <div style={styles.commentHeader}>
                          <span style={styles.commentAuthor}>
                            {comment.author === 'web-user' ? '👤 User' : `🤖 ${comment.author}`}
                          </span>
                          <span style={styles.commentTime}>
                            {new Date(comment.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={styles.commentContent}>{comment.content}</div>
                      </div>
                    ))
                  )}
                </div>

                <div style={styles.newCommentForm}>
                  <input
                    type="text"
                    placeholder="Add comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    style={styles.commentInput}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(selectedCard.id)}
                  />
                  <button onClick={() => handleAddComment(selectedCard.id)} style={styles.commentBtn}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    backgroundColor: '#0a0a0c',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#111115',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#6366f1',
    letterSpacing: '1px',
  },
  addBtnSmall: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflowY: 'auto',
  },
  boardItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background-color 0.2s',
  },
  boardItemName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginRight: '8px',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '2px 8px',
    fontSize: '11px',
    color: '#94a3b8',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    overflow: 'hidden',
  },
  mainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  headerTitleArea: {
    display: 'flex',
    flexDirection: 'column',
  },
  mainTitle: {
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px',
  },
  addCardBtn: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  boardGrid: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    overflowX: 'auto',
    paddingBottom: '16px',
  },
  column: {
    width: '280px',
    minWidth: '280px',
    backgroundColor: '#121216',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
    border: '1px solid rgba(255,255,255,0.02)',
  },
  columnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  columnName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: '0.5px',
  },
  columnContent: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
  },
  card: {
    backgroundColor: '#18181f',
    borderRadius: '6px',
    padding: '12px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.02)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityTag: {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  blockedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: '1.4',
  },
  cardDesc: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  subtaskProgress: {
    marginTop: '4px',
  },
  subtaskText: {
    fontSize: '10px',
    color: '#94a3b8',
    marginBottom: '2px',
  },
  progressBarBg: {
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: '2px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid rgba(255,255,255,0.03)',
  },
  subagentBadge: {
    fontSize: '9px',
    color: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  assigneeAvatar: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: '420px',
    backgroundColor: '#121216',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
  },
  inputLarge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '14px',
  },
  textarea: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    height: '100px',
    resize: 'none',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  select: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    width: '160px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#94a3b8',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  inlineForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: '12px',
    borderRadius: '6px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  submitBtnSmall: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  cancelBtnSmall: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#94a3b8',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  detailsModal: {
    width: '780px',
    height: '520px',
    backgroundColor: '#121216',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  detailsModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '16px',
  },
  cardIdBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  detailsModalTitle: {
    margin: '6px 0 0 0',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1',
  },
  detailsModalBody: {
    flex: 1,
    display: 'flex',
    gap: '24px',
    overflow: 'hidden',
  },
  detailsLeftCol: {
    flex: 1.2,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
  },
  sectionHeader: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  detailsDesc: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#cbd5e1',
  },
  blockedReasonBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '13px',
    color: '#f87171',
    lineHeight: '1.4',
  },
  moveButtonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  moveBtn: {
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  detailsRightCol: {
    flex: 1,
    borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
    paddingLeft: '24px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  commentsStream: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '8px',
    marginBottom: '16px',
  },
  commentItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
  },
  commentAuthor: {
    fontWeight: 'bold',
    color: '#818cf8',
  },
  commentTime: {
    color: '#64748b',
  },
  commentContent: {
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#cbd5e1',
  },
  newCommentForm: {
    display: 'flex',
    gap: '8px',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '6px 12px',
    color: '#fff',
    fontSize: '12px',
  },
  commentBtn: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  emptyText: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
};
