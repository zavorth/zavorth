import { useState, useMemo, memo } from 'react';
import { IconSearch, IconSparkles, IconCheck, IconServer } from '@tabler/icons-react';
import type { ModelOption } from '../modelCatalog';

interface ModelPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  modelOptions: ModelOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelPickerDialog = memo(function ModelPickerDialog({
  isOpen,
  onClose,
  modelOptions,
  selectedModel,
  onSelectModel,
}: ModelPickerDialogProps) {
  const [search, setSearch] = useState('');

  const filteredModels = useMemo(() => {
    return modelOptions.filter(model => {
      const term = search.toLowerCase();
      return (
        model.label.toLowerCase().includes(term) ||
        model.family.toLowerCase().includes(term) ||
        model.id.toLowerCase().includes(term)
      );
    });
  }, [modelOptions, search]);

  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    for (const model of filteredModels) {
      const family = model.family || 'Outros';
      groups.set(family, [...(groups.get(family) || []), model]);
    }
    return Array.from(groups.entries());
  }, [filteredModels]);

  if (!isOpen) return null;

  return (
    <div className="zvd-model-dialog-overlay" onClick={onClose}>
      <style>{`
        .zvd-model-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: zvdFadeIn 200ms ease;
        }
        .zvd-model-dialog {
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 16px;
          width: 90%;
          max-width: 480px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: zvdPopUp 250ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zvd-model-dialog__header {
          padding: 16px 20px;
          border-bottom: 1px solid #27272a;
        }
        .zvd-model-dialog__search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .zvd-model-dialog__search-icon {
          position: absolute;
          left: 12px;
          color: #71717a;
        }
        .zvd-model-dialog__search-input {
          width: 100%;
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 12px 10px 38px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .zvd-model-dialog__search-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-model-dialog__body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .zvd-model-dialog__group {
          margin-bottom: 20px;
        }
        .zvd-model-dialog__group-title {
          font-size: 12px;
          font-weight: 650;
          color: #a1a1aa;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.05em;
        }
        .zvd-model-dialog__item {
          display: flex;
          align-items: center;
          width: 100%;
          background: transparent;
          border: none;
          padding: 10px 12px;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          color: #e4e4e7;
          transition: all 150ms ease;
        }
        .zvd-model-dialog__item:hover {
          background: #202022;
          color: #fff;
        }
        .zvd-model-dialog__item--active {
          background: rgba(216, 107, 42, 0.08);
          color: var(--zvd-accent, #d86b2a);
        }
        .zvd-model-dialog__item-info {
          flex: 1;
        }
        .zvd-model-dialog__item-name {
          font-weight: 600;
          font-size: 14px;
        }
        .zvd-model-dialog__item-family {
          font-size: 11px;
          opacity: 0.6;
        }
        .zvd-model-dialog__item-check {
          color: var(--zvd-accent, #d86b2a);
        }
      `}</style>
      <div className="zvd-model-dialog" onClick={e => e.stopPropagation()}>
        <div className="zvd-model-dialog__header">
          <div className="zvd-model-dialog__search-wrap">
            <IconSearch size={16} className="zvd-model-dialog__search-icon" />
            <input
              type="text"
              className="zvd-model-dialog__search-input"
              placeholder="Buscar modelo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="zvd-model-dialog__body">
          {groupedModels.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No model found.
            </div>
          ) : (
            groupedModels.map(([family, models]) => (
              <div key={family} className="zvd-model-dialog__group">
                <div className="zvd-model-dialog__group-title">{family}</div>
                <div className="flex flex-col gap-1">
                  {models.map(model => {
                    const isActive = model.id === selectedModel;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        className={`zvd-model-dialog__item ${isActive ? 'zvd-model-dialog__item--active' : ''}`}
                        onClick={() => {
                          onSelectModel(model.id);
                          onClose();
                        }}
                      >
                        <div className="zvd-model-dialog__item-info">
                          <div className="zvd-model-dialog__item-name">{model.label}</div>
                          <div className="zvd-model-dialog__item-family">{model.family}</div>
                        </div>
                        {isActive && <IconCheck size={16} className="zvd-model-dialog__item-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
