import { useEffect, useState, memo } from 'react';
import { IconUpload } from '@tabler/icons-react';

interface DropOverlayProps {
  onFilesDropped(paths: string[]): void;
}

export const DropOverlay = memo(function DropOverlay({ onFilesDropped }: DropOverlayProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setActive(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setActive(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setActive(false);
      dragCounter = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const path = window.zavorthDesktop?.getPathForFile(file)
            || (file as File & { path?: string }).path
            || '';
          if (path) {
            paths.push(path);
          }
        }
        if (paths.length > 0) {
          onFilesDropped(paths);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  if (!active) return null;

  return (
    <div className="zvd-drop-overlay">
      <style>{`
        .zvd-drop-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: zvdFadeIn 200ms ease;
        }
        .zvd-drop-overlay__card {
          background: #1e1e1e;
          border: 2px dashed var(--zvd-accent, #d86b2a);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          transform: translateY(0);
          animation: zvdSlideUp 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .zvd-drop-overlay__icon {
          color: var(--zvd-accent, #d86b2a);
          margin-bottom: 20px;
          animation: zvdBounce 1.5s infinite;
        }
        .zvd-drop-overlay__card h3 {
          margin: 0 0 10px;
          font-size: 20px;
          font-weight: 600;
          color: #fff;
        }
        .zvd-drop-overlay__card p {
          margin: 0;
          font-size: 14px;
          color: #aaa;
        }
        @keyframes zvdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zvdSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes zvdBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      <div className="zvd-drop-overlay__card">
        <IconUpload size={48} stroke={1.5} className="zvd-drop-overlay__icon" />
        <h3>Drop files here</h3>
        <p>They will be added as references in your conversation.</p>
      </div>
    </div>
  );
});
