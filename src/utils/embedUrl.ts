import { Platform } from '../types';

/**
 * YouTubeのURLまたはIDから動画IDを抽出
 */
function extractYouTubeVideoId(source: string): string | null {
  // URLパターン: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = source.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];

  // URLパターン: https://youtu.be/VIDEO_ID
  const shortMatch = source.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];

  // URLパターン: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = source.match(/\/embed\/([^?]+)/);
  if (embedMatch) return embedMatch[1];

  // 既にIDの形式（11文字の英数字）の場合
  if (/^[a-zA-Z0-9_-]{11}$/.test(source)) {
    return source;
  }

  return null;
}

/**
 * TwitchのURLまたはチャンネル名からチャンネル名を抽出
 */
function extractTwitchChannelName(source: string): string | null {
  // URLパターン: https://www.twitch.tv/CHANNEL_NAME
  const urlMatch = source.match(/twitch\.tv\/([^/?]+)/);
  if (urlMatch) return urlMatch[1];

  // チャンネル名のみの場合（英数字とアンダースコアのみ）
  if (/^[a-zA-Z0-9_]+$/.test(source)) {
    return source;
  }

  return null;
}

/**
 * 埋め込み用URLを生成
 */
export function generateEmbedUrl(platform: Platform, source: string, isMuted: boolean = false): string | null {
  if (platform === 'youtube') {
    const videoId = extractYouTubeVideoId(source);
    if (!videoId) return null;
    const muteParam = isMuted ? '1' : '0';
    // 高画質設定を追加: hd=1 (HD有効化), modestbranding=1, rel=0, playsinline=1
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteParam}&hd=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`;
  }

  if (platform === 'twitch') {
    const channelName = extractTwitchChannelName(source);
    if (!channelName) return null;
    // parentパラメータは現在のドメインを取得
    const parent = window.location.hostname || 'localhost';
    const mutedParam = isMuted ? 'true' : 'false';
    // 高画質設定を追加: quality=chunked (最高画質)
    return `https://player.twitch.tv/?channel=${channelName}&parent=${parent}&muted=${mutedParam}&quality=chunked`;
  }

  return null;
}

