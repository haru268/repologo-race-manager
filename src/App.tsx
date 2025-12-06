import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AppState, Member, Team } from './types';
import { clearState, loadState, saveState } from './utils/storage';
import { getHpTotal, getHpTotalDetail } from './utils/teamUtils';
import {
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  createTemplateFromTeam,
  createTeamFromTemplate,
  exportTeamsAsJSON,
  importTeamsFromJSON,
  TeamTemplate,
} from './utils/templates';
import { initFirebase, subscribeToRealtimeUpdates, saveStateToFirebase, isFirebaseAvailable, loadInitialState, isFirebaseConfigValid } from './utils/firebase';
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

  // テンプレート管理
  const [templates, setTemplates] = useState<TeamTemplate[]>(() => loadTemplates());
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Firebase初期化とリアルタイム同期の設定
  useEffect(() => {
    initFirebase();
    const configValid = isFirebaseConfigValid();
    const available = isFirebaseAvailable();
    setIsFirebaseConnected(available);

    if (!configValid) {
      console.warn('Firebase設定が未設定です。環境変数を確認してください。');
    }

    if (available) {
      // 初期データを読み込む
      loadInitialState(roomId).then((initialState) => {
        if (initialState) {
          console.log('初期データを読み込みました:', initialState);
          isLocalChange.current = false; // 初期データはリモートから
          setState(initialState);
          saveState(initialState);
        }
      });

      // リアルタイム更新を購読
      const unsubscribe = subscribeToRealtimeUpdates((remoteState) => {
        // リモートからの変更のみ反映（自分の変更は除外）
        if (!isLocalChange.current) {
          console.log('リモートからの変更を反映します');
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

  // 手動でFirebaseから最新データを読み込む
  const handleManualSync = async () => {
    if (!isFirebaseAvailable()) {
      alert('Firebaseが設定されていません。環境変数を確認してください。');
      return;
    }

    setSaveStatus('syncing');
    try {
      const remoteState = await loadInitialState(roomId);
      if (remoteState) {
        isLocalChange.current = false; // リモートからの読み込み
        setState(remoteState);
        saveState(remoteState);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
        console.log('手動同期成功: Firebaseから最新データを取得しました');
      } else {
        setSaveStatus('idle');
        alert('Firebaseにデータがありません。');
      }
    } catch (error) {
      console.error('手動同期エラー:', error);
      setSaveStatus('idle');
      alert('同期に失敗しました。コンソールを確認してください。');
    }
  };

  // テンプレートを保存
  const handleSaveAsTemplate = (team: Team) => {
    const templateName = window.prompt('テンプレート名を入力してください:', team.name || '無題のテンプレート');
    if (!templateName) return;
    
    try {
      createTemplateFromTeam(team, templateName);
      setTemplates(loadTemplates());
      alert(`テンプレート「${templateName}」を保存しました。`);
    } catch (error) {
      console.error('テンプレート保存エラー:', error);
      alert('テンプレートの保存に失敗しました。');
    }
  };

  // テンプレートからチームを読み込む
  const handleLoadTemplate = (template: TeamTemplate) => {
    if (!window.confirm(`テンプレート「${template.name}」を読み込みますか？`)) return;
    
    const newTeam = createTeamFromTemplate(template);
    isLocalChange.current = true;
    setState(prev => ({
      ...prev,
      teams: [...prev.teams, newTeam],
    }));
    setShowTemplateModal(false);
  };

  // テンプレートを削除
  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    if (!window.confirm(`テンプレート「${templateName}」を削除しますか？`)) return;
    
    deleteTemplate(templateId);
    setTemplates(loadTemplates());
  };

  // データをJSONファイルとしてエクスポート
  const handleExportJSON = () => {
    try {
      const jsonString = exportTeamsAsJSON(state.teams);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teams_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('データをエクスポートしました。');
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('エクスポートに失敗しました。');
    }
  };

  // JSONファイルからデータをインポート
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          const importedTeams = importTeamsFromJSON(jsonString);
          
          if (!window.confirm(`${importedTeams.length}個のチームをインポートしますか？現在のチームに追加されます。`)) return;

          const createId = () =>
            (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID()) ||
            Math.random().toString(36).slice(2, 10);

          const newTeams: Team[] = importedTeams.map(importedTeam => {
            const members: Member[] = importedTeam.members.map(m => ({
              id: createId(),
              name: m.name,
              hp: m.hp,
            }));

            while (members.length < 4) {
              members.push({
                id: createId(),
                name: '',
                hp: '',
              });
            }

            return {
              id: createId(),
              name: importedTeam.name,
              finalAmount: '',
              playTime: { minutes: '' },
              members: members.slice(0, 4),
              level: 1,
            };
          });

          isLocalChange.current = true;
          setState(prev => ({
            ...prev,
            teams: [...prev.teams, ...newTeams],
          }));
          alert(`${newTeams.length}個のチームをインポートしました。`);
        } catch (error) {
          console.error('インポートエラー:', error);
          alert(`インポートに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
          {isFirebaseConnected ? (
            <span className="status-pill status-pill--syncing" style={{ marginRight: '8px' }}>
              🔄 リアルタイム同期中
            </span>
          ) : isFirebaseConfigValid() ? (
            <span className="status-pill" style={{ marginRight: '8px', backgroundColor: '#ff9800', color: 'white' }}>
              ⚠️ Firebase接続エラー
            </span>
          ) : (
            <span className="status-pill" style={{ marginRight: '8px', backgroundColor: '#9e9e9e', color: 'white' }}>
              📦 ローカルのみ
            </span>
          )}
          <span className={`status-pill status-pill--${saveStatus}`}>{saveStatusLabel}</span>
          {roomId !== 'default' && (
            <span className="status-pill" style={{ marginLeft: '8px' }}>
              ルーム: {roomId}
            </span>
          )}
          {isFirebaseAvailable() && (
            <button 
              className="ghost-btn" 
              onClick={handleManualSync}
              disabled={saveStatus === 'syncing'}
              style={{ marginLeft: '8px' }}
              title="Firebaseから最新データを取得"
            >
              🔄 同期更新
            </button>
          )}
          <button className="ghost-btn" onClick={handleReset} style={{ marginLeft: '8px' }}>
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
            <button className="ghost-btn" onClick={() => setShowTemplateModal(true)}>
              📋 テンプレート
            </button>
            <button className="ghost-btn" onClick={handleExportJSON}>
              💾 エクスポート
            </button>
            <button className="ghost-btn" onClick={handleImportJSON}>
              📥 インポート
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
                <div className="team-card__header-actions">
                  <button 
                    className="ghost-btn ghost-btn--small" 
                    onClick={() => handleSaveAsTemplate(team)}
                    title="テンプレートとして保存"
                  >
                    💾 保存
                  </button>
                  {state.teams.length > 1 && (
                    <button className="ghost-btn ghost-btn--small" onClick={() => handleRemoveTeam(team.id)}>
                      削除
                    </button>
                  )}
                </div>
              </header>

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
                  {(() => {
                    const hpDetail = getHpTotalDetail(team.members);
                    return (
                      <p>
                        合計HP：<strong>{hpDetail.total}</strong>
                        {hpDetail.compensation > 0 && (
                          <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--muted)' }}>
                            （実HP：{hpDetail.actual} + 補正：+{hpDetail.compensation}）
                          </span>
                        )}
                      </p>
                    );
                  })()}
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

      {/* テンプレート管理モーダル */}
      {showTemplateModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowTemplateModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--panel)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>テンプレート管理</h2>
              <button 
                className="ghost-btn"
                onClick={() => setShowTemplateModal(false)}
                style={{ padding: '8px 16px' }}
              >
                ✕ 閉じる
              </button>
            </div>

            {templates.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px' }}>
                保存されたテンプレートがありません。<br />
                チームカードの「💾 保存」ボタンからテンプレートを保存できます。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      padding: '16px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--panel-alt)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{template.name}</h3>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
                          チーム名: {template.teamName || '名称未設定'}
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '12px' }}>
                          メンバー数: {template.members.length}人
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="ghost-btn ghost-btn--small"
                          onClick={() => handleLoadTemplate(template)}
                          style={{ padding: '6px 12px' }}
                        >
                          読み込む
                        </button>
                        <button
                          className="ghost-btn ghost-btn--small"
                          onClick={() => handleDeleteTemplate(template.id, template.name)}
                          style={{ padding: '6px 12px', color: 'var(--error)' }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    {template.members.length > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--muted)' }}>メンバー:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {template.members.map((member, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                backgroundColor: 'var(--bg)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {member.name || '名称未設定'} ({member.hp !== '' ? member.hp : '—'} HP)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

