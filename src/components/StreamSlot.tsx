import React, { useState, useEffect } from 'react';
import { StreamSlot as StreamSlotType, Platform } from '../types';
import { generateEmbedUrl } from '../utils/embedUrl';
import './StreamSlot.css';

interface StreamSlotProps {
  slot: StreamSlotType;
  onUpdate: (updatedSlot: StreamSlotType) => void;
  onDelete: () => void;
  onSetMain: () => void;
}

export default function StreamSlot({ slot, onUpdate, onDelete, onSetMain }: StreamSlotProps) {
  const [platform, setPlatform] = useState<Platform | null>(slot.platform);
  const [source, setSource] = useState(slot.source);
  const [title, setTitle] = useState(slot.title);
  const [isMuted, setIsMuted] = useState(slot.isMuted);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // slotが更新されたときにembedUrlを再生成
  useEffect(() => {
    if (slot.platform && slot.source) {
      const url = generateEmbedUrl(slot.platform, slot.source, slot.isMuted);
      setEmbedUrl(url);
      setPlatform(slot.platform);
      setSource(slot.source);
      setTitle(slot.title);
      setIsMuted(slot.isMuted);
    }
  }, [slot.id, slot.platform, slot.source, slot.isMuted]);

  const updateEmbedUrl = (platform: Platform | null, source: string, muted: boolean) => {
    if (!platform || !source.trim()) return null;
    return generateEmbedUrl(platform, source.trim(), muted);
  };

  const handleApply = () => {
    if (!platform || !source.trim()) {
      alert('プラットフォームとURL/IDを入力してください');
      return;
    }

    const url = updateEmbedUrl(platform, source.trim(), isMuted);
    if (!url) {
      alert('無効なURLまたはIDです');
      return;
    }

    setEmbedUrl(url);
    onUpdate({
      ...slot,
      platform,
      source: source.trim(),
      title: title.trim() || source.trim(),
      isMuted,
    });
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    // iframeのミュート状態を更新するには、URLを再生成する必要がある
    if (platform && source.trim()) {
      const url = updateEmbedUrl(platform, source, newMuted);
      if (url) {
        setEmbedUrl(url);
      }
    }
    onUpdate({ ...slot, isMuted: newMuted });
  };

  return (
    <div className={`stream-slot ${slot.isMain ? 'main' : ''}`}>
      <div className="slot-header">
        <div className="slot-controls">
          <select
            value={platform || ''}
            onChange={(e) => setPlatform(e.target.value as Platform | null)}
            className="platform-select"
          >
            <option value="">プラットフォーム選択</option>
            <option value="youtube">YouTube</option>
            <option value="twitch">Twitch</option>
          </select>
          <input
            type="text"
            placeholder="URLまたはIDを入力"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="source-input"
          />
          <input
            type="text"
            placeholder="タイトル（任意）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
          />
          <button onClick={handleApply} className="apply-btn">
            適用
          </button>
          <button onClick={handleMuteToggle} className={`mute-btn ${isMuted ? 'muted' : ''}`}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button onClick={onSetMain} className={`main-btn ${slot.isMain ? 'active' : ''}`}>
            ⭐
          </button>
          <button onClick={onDelete} className="delete-btn">
            ×
          </button>
        </div>
      </div>
      <div className="slot-player">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="embed-iframe"
            title={slot.title || `Stream ${slot.id}`}
          />
        ) : (
          <div className="empty-slot">
            <p>プラットフォームとURL/IDを設定して「適用」をクリック</p>
          </div>
        )}
      </div>
    </div>
  );
}

