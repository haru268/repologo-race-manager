import React from 'react';
import './ControlPanel.css';

interface ControlPanelProps {
  slotCount: number;
  maxSlots: number;
  columns: number;
  saveStatus: 'idle' | 'saving' | 'saved';
  onAddSlot: () => void;
  onRemoveSlot: () => void;
  onColumnsChange: (columns: number) => void;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
}

export default function ControlPanel({
  slotCount,
  maxSlots,
  columns,
  saveStatus,
  onAddSlot,
  onRemoveSlot,
  onColumnsChange,
  onSave,
  onLoad,
  onReset,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <div className="control-section">
        <label>
          グリッド列数:
          <select
            value={columns}
            onChange={(e) => onColumnsChange(Number(e.target.value))}
            className="columns-select"
          >
            <option value="2">2列</option>
            <option value="3">3列</option>
            <option value="4">4列</option>
          </select>
        </label>
      </div>

      <div className="control-section">
        <span className="slot-count">
          現在の枠数: {slotCount} / {maxSlots}
        </span>
        <button
          onClick={onAddSlot}
          disabled={slotCount >= maxSlots}
          className="control-btn add-btn"
        >
          + 枠を追加
        </button>
        <button
          onClick={onRemoveSlot}
          disabled={slotCount <= 1}
          className="control-btn remove-btn"
        >
          - 枠を削除
        </button>
      </div>

      <div className="control-section">
        <button 
          onClick={onSave} 
          className={`control-btn save-btn ${saveStatus === 'saving' ? 'saving' : ''} ${saveStatus === 'saved' ? 'saved' : ''}`}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 保存済み' : '設定を保存'}
        </button>
        <button onClick={onLoad} className="control-btn load-btn">
          設定を読み込み
        </button>
        <button onClick={onReset} className="control-btn reset-btn">
          全リセット
        </button>
      </div>
    </div>
  );
}

