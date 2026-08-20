import React, { useEffect, useRef, useState } from 'react';
import { MascotSprite } from './MascotSprite';

interface DragState {
  startX: number;
  startY: number;
  winX: number;
  winY: number;
  moved: boolean;
}

export function MascotOverlayApp() {
  const [state, setState] = useState<'idle' | 'thinking' | 'working' | 'finished'>('idle');
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [bubbleText, setBubbleText] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Force background transparent
    const style = document.createElement('style');
    style.textContent = 'html, body, #root { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }';
    document.head.appendChild(style);

    // Listen for state updates pushed from the main window
    const unsubState = window.zavorthDesktop?.mascotOverlay?.onState((payload) => {
      if (payload.state === 'idle' || payload.state === 'thinking' || payload.state === 'working' || payload.state === 'finished') {
        setState(payload.state);
      }
      if (typeof payload.bubbleText === 'string') {
        setBubbleText(payload.bubbleText);
      } else if (payload.bubbleText === null) {
        setBubbleText(null);
      }
    });

    // Make window click-through initially, except when mouse is over the mascot
    window.zavorthDesktop?.mascotOverlay?.setIgnoreMouse(true);

    return () => {
      unsubState?.();
    };
  }, []);

  const handleMouseEnter = () => {
    // Enable mouse interactions when hovering mascot
    window.zavorthDesktop?.mascotOverlay?.setIgnoreMouse(false);
  };

  const handleMouseLeave = () => {
    // Restore click-through when leaving the mascot
    if (!composerOpen) {
      window.zavorthDesktop?.mascotOverlay?.setIgnoreMouse(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();

    dragRef.current = {
      startX: e.screenX,
      startY: e.screenY,
      winX: window.screenX,
      winY: window.screenY,
      moved: false,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvent.screenX - dragRef.current.startX;
      const dy = moveEvent.screenY - dragRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }

      window.zavorthDesktop?.mascotOverlay?.setBounds({
        x: dragRef.current.winX + dx,
        y: dragRef.current.winY + dy,
        width: 240,
        height: 240,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (dragRef.current && !dragRef.current.moved) {
        handlePetClick();
      }
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handlePetClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = undefined;
      handlePetDoubleClick();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = undefined;
        setComposerOpen(prev => {
          const next = !prev;
          window.zavorthDesktop?.mascotOverlay?.setIgnoreMouse(!next);
          window.zavorthDesktop?.mascotOverlay?.setFocusable(next);
          return next;
        });
      }, 220);
    }
  };

  const handlePetDoubleClick = () => {
    window.zavorthDesktop?.mascotOverlay?.control({ type: 'toggle-main-window' });
  };

  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    window.zavorthDesktop?.mascotOverlay?.control({
      type: 'submit-prompt',
      text: prompt.trim(),
    });

    setPrompt('');
    setComposerOpen(false);
    window.zavorthDesktop?.mascotOverlay?.setIgnoreMouse(true);
    window.zavorthDesktop?.mascotOverlay?.setFocusable(false);
  };

  return (
    <div
      ref={containerRef}
      className="mascot-overlay-root"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Speech / Thought Bubble */}
      {bubbleText && (
        <div className="mascot-bubble animate-bubble-in">
          <p>{bubbleText}</p>
          <div className="mascot-bubble-arrow" />
        </div>
      )}

      {/* Mascot Sprite */}
      <div className="mascot-sprite-wrapper" onMouseDown={handleMouseDown}>
        <MascotSprite state={state} />
      </div>

      {/* Mini Composer */}
      {composerOpen && (
        <form onSubmit={handleSubmitPrompt} className="mascot-mini-composer animate-composer-in">
          <input
            type="text"
            placeholder="Ask Zavorth..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            autoFocus
            className="mascot-composer-input"
          />
          <button type="submit" className="mascot-composer-submit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      )}

      <style>{`
        .mascot-overlay-root {
          width: 240px;
          height: 240px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          position: relative;
          user-select: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .mascot-sprite-wrapper {
          cursor: grab;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .mascot-sprite-wrapper:active {
          cursor: grabbing;
        }

        /* Speech Bubble */
        .mascot-bubble {
          position: absolute;
          bottom: 130px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 8px 12px;
          max-width: 180px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
          z-index: 20;
        }

        .mascot-bubble p {
          margin: 0;
          color: #e4e4e7;
          font-size: 11.5px;
          line-height: 1.4;
          text-align: center;
        }

        .mascot-bubble-arrow {
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: #18181b;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Mini Composer */
        .mascot-mini-composer {
          position: absolute;
          bottom: 5px;
          display: flex;
          align-items: center;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 3px 6px 3px 12px;
          width: 190px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
          z-index: 30;
        }

        .mascot-composer-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #f4f4f5;
          font-size: 11px;
          padding: 4px 0;
        }

        .mascot-composer-input::placeholder {
          color: #71717a;
        }

        .mascot-composer-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f16a21;
          color: #ffffff;
          border: none;
          cursor: pointer;
          margin-left: 4px;
          transition: background 0.2s ease;
        }

        .mascot-composer-submit:hover {
          background: #e05b17;
        }

        /* Animations */
        .animate-bubble-in {
          animation: bubble-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-composer-in {
          animation: composer-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes bubble-in {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes composer-in {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
