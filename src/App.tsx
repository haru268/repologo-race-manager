import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AppState, Member, Team } from './types';
import { clearState, loadState, saveState } from './utils/storage';
import { getHpTotal } from './utils/teamUtils';
import { initFirebase, subscribeToRealtimeUpdates, saveStateToFirebase, isFirebaseAvailable } from './utils/firebase';
import RankingPage from './components/RankingPage';
import AnnouncementPage from './components/AnnouncementPage';
import './App.css';

const MEMBER_PRESET_COUNT = 4;
const LEVELS: Team['level'][] = [1, 2, 3, 4, 5];
const LEVEL_SET = new Set<number>(LEVELS);

const createId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID()) ||
  Math.random().toString(36).slice(2, 10);

const createMember = (): Member => ({
  id: createId(),
  name: '',
  hp: '',
});

const ensureMemberSlots = (members?: Member[]): Member[] => {
  const base = Array.isArray(members)
    ? members.map(member => ({
        id: member?.id ?? createId(),
        name: member?.name ?? '',
        hp: typeof member?.hp === 'number' && Number.isFinite(member.hp) ? member.hp : '',
      }))
    : [];
  const trimmed = base.slice(0, MEMBER_PRESET_COUNT);
  while (trimmed.length < MEMBER_PRESET_COUNT) {
    trimmed.push(createMember());
  }
  return trimmed;
};

const normalizeTeam = (raw?: Partial<Team>): Team => ({
  id: raw?.id ?? createId(),
  name: raw?.name ?? '',
  finalAmount:
    typeof raw?.finalAmount === 'number' && Number.isFinite(raw.finalAmount) ? raw.finalAmount : '',
  playTime: {
    minutes:
      typeof raw?.playTime?.minutes === 'number' && Number.isFinite(raw.playTime.minutes)
        ? raw.playTime.minutes
        : '',
  },
  members: ensureMemberSlots(raw?.members),
  level: LEVEL_SET.has(Number(raw?.level)) ? (Number(raw?.level) as Team['level']) : 1,
});

const createTeam = (): Team => normalizeTeam();

const createTestTeams = (): Team[] => {
  return [];
};

const createInitialState = (): AppState => {
  // テストデータを使用（本番では通常のcreateTeam()を使用）
  const useTestData = true; // テストデータを使う場合はtrue、通常はfalse
  return {
    teams: useTestData ? createTestTeams() : [createTeam()],
  };
};

const hydrateState = (): AppState => {
  const stored = loadState();
  if (!stored) return createInitialState();

  const safeTeams =
    Array.isArray(stored.teams) && stored.teams.length > 0
      ? stored.teams.map(team => normalizeTeam(team))
      : [createTeam()];

  return {
    teams: safeTeams,
  };
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toNumberOrEmpty = (value: string, opts?: { max?: number; min?: number }) => {
  if (value === '') return '';
  const parsed = Number(value);
  const safeNumber = Number.isFinite(parsed) ? parsed : 0;
  if (!opts) return safeNumber;
  const { min = 0, max = Number.POSITIVE_INFINITY } = opts;
  return clampNumber(safeNumber, min, max);
};

// R.E.P.O.マスター賞のスコア計算: （最終獲得金額 ÷ プレイ時間［分］） × 生存HP合計 × 最終到達Lv
const calculateRepomasterScore = (team: Team, hpTotal: number): number | null => {
  const amount = typeof team.finalAmount === 'number' ? team.finalAmount : 0;
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : 0;
  
  if (minutes === 0 || amount === 0 || hpTotal === 0) {
    return null; // 計算不可
  }
  
  return (amount / minutes) * hpTotal * team.level;
};

// 資材回収王チーム順位計算（最終獲得金額のみで並び替え）
const calculateCollectionRankings = (teams: Team[]): Map<string, number> => {
  const enriched = teams.map(team => ({
    id: team.id,
    finalAmount: typeof team.finalAmount === 'number' ? team.finalAmount : 0,
  }));
  
  const sorted = [...enriched].sort((a, b) => b.finalAmount - a.finalAmount);
  const rankingMap = new Map<string, number>();
  
  sorted.forEach((team, index) => {
    const prev = sorted[index - 1];
    const rank = prev && prev.finalAmount === team.finalAmount 
      ? (rankingMap.get(prev.id) ?? index + 1)
      : index + 1;
    rankingMap.set(team.id, rank);
  });
  
  return rankingMap;
};

// R.E.P.O.マスター賞順位計算
const calculateRepomasterRankings = (teams: Team[]): Map<string, { rank: number; score: number }> => {
  const enriched = teams.map(team => {
    const hpTotal = getHpTotal(team.members);
    const score = calculateRepomasterScore(team, hpTotal);
    return { id: team.id, score };
  });
  
  // スコアがnullのものは除外して計算
  const validTeams = enriched.filter(t => t.score !== null) as Array<{ id: string; score: number }>;
  const sorted = [...validTeams].sort((a, b) => b.score - a.score);
  const rankingMap = new Map<string, { rank: number; score: number }>();
  
  sorted.forEach((team, index) => {
    const prev = sorted[index - 1];
    const rank = prev && prev.score === team.score 
      ? (rankingMap.get(prev.id)?.rank ?? index + 1)
      : index + 1;
    rankingMap.set(team.id, { rank, score: team.score });
  });
  
  return rankingMap;
};

type Page = 'input' | 'ranking' | 'announcement';

export default function App() {
  const [state, setState] = useState<AppState>(() => hydrateState());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'syncing'>('idle');
  const [currentPage, setCurrentPage] = useState<Page>('input');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [roomId] = useState<string>(() => {
    // URLパラメータからroomIdを取得、なければデフォルト値を使用
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'default';
  });
  
  // 自分の変更かどうかを追跡（無限ループを防ぐ）
  const isLocalChange = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 各ランキングごとに独立したstateを管理（結果発表ページでも使用）
  const [repomasterRevealedRanks, setRepomasterRevealedRanks] = useState<Set<number>>(new Set());
  const [repomasterIsRevealing, setRepomasterIsRevealing] = useState(false);
  
  const [collectionRevealedRanks, setCollectionRevealedRanks] = useState<Set<number>>(new Set());
  const [collectionIsRevealing, setCollectionIsRevealing] = useState(false);
  
  const [timeAttackRevealedRanks, setTimeAttackRevealedRanks] = useState<Set<number>>(new Set());
  const [timeAttackIsRevealing, setTimeAttackIsRevealing] = useState(false);

  // Firebase初期化とリアルタイム同期の設定
  useEffect(() => {
    initFirebase();
    const available = isFirebaseAvailable();
    setIsFirebaseConnected(available);

    if (available) {
      // リアルタイム更新を購読
      const unsubscribe = subscribeToRealtimeUpdates((remoteState) => {
        // リモートからの変更のみ反映（自分の変更は除外）
        if (!isLocalChange.current) {
          setState(remoteState);
          // ローカルストレージにも保存
          saveState(remoteState);
        }
        isLocalChange.current = false; // フラグをリセット
      }, roomId);

      unsubscribeRef.current = unsubscribe;

      return () => {
        unsubscribe();
      };
    }
  }, [roomId]);

  // ローカルストレージへの保存とFirebaseへの同期
  useEffect(() => {
    // ローカルストレージに保存
    saveState(state);

    // Firebaseが利用可能な場合、同期
    if (isFirebaseAvailable() && isLocalChange.current) {
      setSaveStatus('syncing');
      saveStateToFirebase(state, roomId)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
        })
        .catch(() => {
          setSaveStatus('idle');
        });
    } else {
      // Firebaseがない場合は通常の保存
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [state, roomId]);

  // タイムアタック賞順位マップ（ランキングページ用の計算はRankingPage内で行う）
  const timeAttackRankMap = useMemo(() => {
    const enriched = state.teams.map(team => {
      const hpTotal = getHpTotal(team.members);
      return { ...team, hpTotal };
    });
    
    // 最終金額でソート（同点は名前順）
    const sorted = [...enriched].sort((a, b) => {
      const scoreA = typeof a.finalAmount === 'number' ? a.finalAmount : 0;
      const scoreB = typeof b.finalAmount === 'number' ? b.finalAmount : 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });
    
    const map = new Map<string, number>();
    sorted.forEach((team, index) => {
      const prev = sorted[index - 1];
      const scoreA = typeof team.finalAmount === 'number' ? team.finalAmount : 0;
      const scoreB = prev ? (typeof prev.finalAmount === 'number' ? prev.finalAmount : 0) : -1;
      const rank = scoreA === scoreB && prev ? (map.get(prev.id) ?? index + 1) : index + 1;
      map.set(team.id, rank);
    });
    return map;
  }, [state.teams]);

  // 資材回収王チーム順位マップ
  const collectionRankMap = useMemo(() => {
    return calculateCollectionRankings(state.teams);
  }, [state.teams]);

  // R.E.P.O.マスター賞順位マップ
  const repomasterRankMap = useMemo(() => {
    return calculateRepomasterRankings(state.teams);
  }, [state.teams]);

  const handleTeamChange = (teamId: string, updater: (team: Team) => Team) => {
    isLocalChange.current = true; // 自分の変更であることをマーク
    setState(prev => ({
      ...prev,
      teams: prev.teams.map(team => (team.id === teamId ? updater(team) : team)),
    }));
  };

  const handleTeamFieldChange = <K extends keyof Team>(teamId: string, field: K, value: Team[K]) => {
    handleTeamChange(teamId, team => ({ ...team, [field]: value }));
  };

  const handlePlayTimeChange = (teamId: string, value: string) => {
    handleTeamChange(teamId, team => ({
      ...team,
      playTime: {
        ...team.playTime,
        minutes: toNumberOrEmpty(value, { min: 0, max: 9_999 }),
      },
    }));
  };

  const handleMemberChange = (
    teamId: string,
    memberId: string,
    field: keyof Member,
    value: string
  ) => {
    handleTeamChange(teamId, team => ({
      ...team,
      members: team.members.map(member =>
        member.id === memberId
          ? {
              ...member,
              [field]: field === 'hp' ? toNumberOrEmpty(value, { min: 0, max: 9_999 }) : value,
            }
          : member
      ),
    }));
  };

  const handleAddTeam = () => {
    isLocalChange.current = true; // 自分の変更であることをマーク
    setState(prev => ({
      ...prev,
      teams: [...prev.teams, createTeam()],
    }));
  };

  const handleRemoveTeam = (teamId: string) => {
    isLocalChange.current = true; // 自分の変更であることをマーク
    setState(prev => ({
      ...prev,
      teams: prev.teams.filter(team => team.id !== teamId),
    }));
  };

  const handleReset = () => {
    if (!window.confirm('全データをリセットしますか？')) return;
    isLocalChange.current = true; // 自分の変更であることをマーク
    clearState();
    setState(createInitialState());
  };

  const saveStatusLabel =
    saveStatus === 'saving' ? '自動保存中…' 
    : saveStatus === 'syncing' ? '同期中…'
    : saveStatus === 'saved' ? '保存済み' 
    : '待機中';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="eyebrow">レポチーム対抗生還レース 管理フォーム</p>
          <h1>レポチーム対抗生還レース 管理システム</h1>
          <p className="subtitle">
            1チームごとの詳細データを入力して、タイムアタック結果をまとめて管理
          </p>
        </div>
        <div className="header__status">
          {isFirebaseConnected && (
            <span className="status-pill status-pill--syncing" style={{ marginRight: '8px' }}>
              🔄 リアルタイム同期中
            </span>
          )}
          <span className={`status-pill status-pill--${saveStatus}`}>{saveStatusLabel}</span>
          {roomId !== 'default' && (
            <span className="status-pill" style={{ marginLeft: '8px' }}>
              ルーム: {roomId}
            </span>
          )}
          <button className="ghost-btn" onClick={handleReset}>
            全てリセット
          </button>
        </div>
      </header>

      <nav className="page-tabs">
        <button
          className={`tab-btn ${currentPage === 'input' ? 'tab-btn--active' : ''}`}
          onClick={() => setCurrentPage('input')}
        >
          データ入力
        </button>
        <button
          className={`tab-btn ${currentPage === 'ranking' ? 'tab-btn--active' : ''}`}
          onClick={() => setCurrentPage('ranking')}
        >
          ランキング表示
        </button>
        <button
          className={`tab-btn ${currentPage === 'announcement' ? 'tab-btn--active' : ''}`}
          onClick={() => setCurrentPage('announcement')}
        >
          結果発表
        </button>
      </nav>

      {currentPage === 'input' && (
        <section className="controls-panel">
          <div className="controls-panel__item controls-panel__actions">
            <button className="primary-btn" onClick={handleAddTeam}>
              + チームを追加
            </button>
          </div>
        </section>
      )}

      {currentPage === 'input' && (
        <section className="teams-section">
        {state.teams.map((team, index) => {
          const hpTotal = getHpTotal(team.members);
          const repomasterData = repomasterRankMap.get(team.id);
          const repomasterRank = repomasterData?.rank;
          // ランキングに含まれている場合はそのスコアを使用、そうでなければ直接計算
          const repomasterScore = repomasterData?.score ?? calculateRepomasterScore(team, hpTotal);
          const collectionRank = collectionRankMap.get(team.id);
          const timeAttackRank = timeAttackRankMap.get(team.id);
          
          return (
            <article key={team.id} className="team-card">
              <header className="team-card__header">
                <div>
                  <p className="team-card__eyebrow">チーム {index + 1}</p>
                  <h2>{team.name || '名称未設定'}</h2>
                </div>
                {state.teams.length > 1 && (
                  <div className="team-card__header-actions">
                    <button className="ghost-btn" onClick={() => handleRemoveTeam(team.id)}>
                      削除
                    </button>
                  </div>
                )}
              </header>

              <div className="team-card__rankings">
                <div className="ranking-item">
                  <span className="ranking-label">R.E.P.O.マスター賞</span>
                  <span className="ranking-value">
                    {repomasterRank ? `${repomasterRank}位` : '—'}
                  </span>
                  {repomasterScore !== null && (
                    <span className="ranking-score">
                      (スコア: {repomasterScore.toLocaleString('ja-JP', { maximumFractionDigits: 2 })})
                    </span>
                  )}
                </div>
                <div className="ranking-item">
                  <span className="ranking-label">資材回収王チーム</span>
                  <span className="ranking-value">
                    {collectionRank ? `${collectionRank}位` : '—'}
                  </span>
                </div>
                <div className="ranking-item">
                  <span className="ranking-label">タイムアタック賞</span>
                  <span className="ranking-value">
                    {timeAttackRank ? `${timeAttackRank}位` : '—'}
                  </span>
                </div>
              </div>

              <div className="team-card__grid">
                <label>
                  チーム名
                  <input
                    type="text"
                    value={team.name}
                    onChange={e => handleTeamFieldChange(team.id, 'name', e.target.value)}
                    placeholder="例：レポロゴα"
                  />
                </label>

                <label>
                  最終獲得金額
                  <div className="inline-input">
                    <input
                      type="number"
                      min={0}
                      value={team.finalAmount}
                      onChange={e =>
                        handleTeamFieldChange(team.id, 'finalAmount', toNumberOrEmpty(e.target.value))
                      }
                      placeholder="金額"
                    />
                    <span className="unit">$</span>
                  </div>
                </label>

                <label>
                  プレイ時間（分のみ）
                  <div className="inline-input">
                    <input
                      type="number"
                      min={0}
                      value={team.playTime.minutes}
                      onChange={e => handlePlayTimeChange(team.id, e.target.value)}
                      placeholder="プレイ時間"
                    />
                    <span className="unit">分</span>
                  </div>
                </label>

                <label>
                  最終到達レベル
                  <select
                    value={team.level}
                    onChange={e =>
                      handleTeamFieldChange(team.id, 'level', Number(e.target.value) as Team['level'])
                    }
                  >
                    {LEVELS.map(level => (
                      <option key={level} value={level}>
                        Lv.{level}
                      </option>
                    ))}
                  </select>
                </label>

              </div>

              <div className="members-panel">
                <div className="members-panel__header">
                  <h3>メンバーHP内訳（最大4名）</h3>
                  <p>合計HP：<strong>{hpTotal}</strong></p>
                </div>

                <div className="members-list">
                  {team.members.map(member => (
                    <div key={member.id} className="member-row">
                      <input
                        type="text"
                        value={member.name}
                        placeholder="メンバー名"
                        onChange={e =>
                          handleMemberChange(team.id, member.id, 'name', e.target.value)
                        }
                      />
                      <div className="inline-input">
                        <input
                          type="number"
                          min={0}
                          value={member.hp}
                          placeholder="HP"
                          onChange={e =>
                            handleMemberChange(team.id, member.id, 'hp', e.target.value)
                          }
                        />
                        <span className="unit">HP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
        </section>
      )}

      {currentPage === 'ranking' && (
        <RankingPage
          teams={state.teams}
          repomasterRevealedRanks={repomasterRevealedRanks}
          setRepomasterRevealedRanks={setRepomasterRevealedRanks}
          repomasterIsRevealing={repomasterIsRevealing}
          setRepomasterIsRevealing={setRepomasterIsRevealing}
          collectionRevealedRanks={collectionRevealedRanks}
          setCollectionRevealedRanks={setCollectionRevealedRanks}
          collectionIsRevealing={collectionIsRevealing}
          setCollectionIsRevealing={setCollectionIsRevealing}
          timeAttackRevealedRanks={timeAttackRevealedRanks}
          setTimeAttackRevealedRanks={setTimeAttackRevealedRanks}
          timeAttackIsRevealing={timeAttackIsRevealing}
          setTimeAttackIsRevealing={setTimeAttackIsRevealing}
        />
      )}

      {currentPage === 'announcement' && (
        <AnnouncementPage
          teams={state.teams}
          repomasterRevealedRanks={repomasterRevealedRanks}
          collectionRevealedRanks={collectionRevealedRanks}
          timeAttackRevealedRanks={timeAttackRevealedRanks}
        />
      )}
    </div>
  );
}

