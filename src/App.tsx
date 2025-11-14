import React, { useState, useEffect } from 'react';
import { AppState, StreamSlot, Platform } from './types';
import { saveState, loadState, clearState } from './utils/storage';
import ControlPanel from './components/ControlPanel';
import StreamSlotComponent from './components/StreamSlot';
import './App.css';

const INITIAL_SLOT_COUNT = 9;
const MAX_SLOTS = 16;

function createEmptySlot(id: number): StreamSlot {
  return {
    id,
    platform: null,
    source: '',
    title: '',
    isMuted: false,
    isMain: false,
  };
}

function createInitialState(): AppState {
  return {
    slots: Array.from({ length: INITIAL_SLOT_COUNT }, (_, i) => createEmptySlot(i + 1)),
    maxSlots: MAX_SLOTS,
    layout: {
      columns: 3,
    },
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState();
    return loaded || createInitialState();
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 状態が変更されたら自動保存
  useEffect(() => {
    // 初期ロード時は保存しない
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveState(state);
      setSaveStatus('saved');
      // 2秒後にステータスをリセット
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => clearTimeout(timer);
  }, [state, isInitialLoad]);

  const handleAddSlot = () => {
    if (state.slots.length >= state.maxSlots) return;

    const newId = Math.max(...state.slots.map(s => s.id), 0) + 1;
    const newSlot = createEmptySlot(newId);

    setState(prev => ({
      ...prev,
      slots: [...prev.slots, newSlot],
    }));
  };

  const handleRemoveSlot = () => {
    if (state.slots.length <= 1) return;

    setState(prev => ({
      ...prev,
      slots: prev.slots.slice(0, -1),
    }));
  };

  const handleUpdateSlot = (updatedSlot: StreamSlot) => {
    setState(prev => ({
      ...prev,
      slots: prev.slots.map(slot =>
        slot.id === updatedSlot.id ? updatedSlot : slot
      ),
    }));
  };

  const handleDeleteSlot = (slotId: number) => {
    setState(prev => ({
      ...prev,
      slots: prev.slots.filter(slot => slot.id !== slotId),
    }));
  };

  const handleSetMain = (slotId: number) => {
    setState(prev => ({
      ...prev,
      slots: prev.slots.map(slot => ({
        ...slot,
        isMain: slot.id === slotId ? !slot.isMain : false,
      })),
    }));
  };

  const handleColumnsChange = (columns: number) => {
    setState(prev => ({
      ...prev,
      layout: { ...prev.layout, columns },
    }));
  };

  const handleSave = () => {
    saveState(state);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleLoad = () => {
    const loaded = loadState();
    if (loaded) {
      setState(loaded);
      alert('設定を読み込みました');
    } else {
      alert('保存された設定が見つかりません');
    }
  };

  const handleReset = () => {
    if (confirm('すべての設定をリセットしますか？')) {
      clearState();
      setState(createInitialState());
      alert('リセットしました');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>マルチ配信ビューア</h1>
        <p className="subtitle">YouTubeとTwitchのライブ配信を同時に視聴</p>
      </header>

      <ControlPanel
        slotCount={state.slots.length}
        maxSlots={state.maxSlots}
        columns={state.layout.columns}
        saveStatus={saveStatus}
        onAddSlot={handleAddSlot}
        onRemoveSlot={handleRemoveSlot}
        onColumnsChange={handleColumnsChange}
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={handleReset}
      />

      <div
        className="stream-grid"
        style={{
          gridTemplateColumns: `repeat(${state.layout.columns}, 1fr)`,
        }}
      >
        {state.slots.map(slot => (
          <StreamSlotComponent
            key={slot.id}
            slot={slot}
            onUpdate={handleUpdateSlot}
            onDelete={() => handleDeleteSlot(slot.id)}
            onSetMain={() => handleSetMain(slot.id)}
          />
        ))}
      </div>
    </div>
  );
}

