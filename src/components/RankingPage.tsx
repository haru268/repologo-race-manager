import React, { useMemo, useState } from 'react';
import { Team, RankedTeam } from '../types';
import { getHpTotal, getTotalSeconds } from '../utils/teamUtils';

type RankingPageProps = {
  teams: Team[];
  repomasterRevealedRanks: Set<number>;
  setRepomasterRevealedRanks: React.Dispatch<React.SetStateAction<Set<number>>>;
  repomasterIsRevealing: boolean;
  setRepomasterIsRevealing: React.Dispatch<React.SetStateAction<boolean>>;
  collectionRevealedRanks: Set<number>;
  setCollectionRevealedRanks: React.Dispatch<React.SetStateAction<Set<number>>>;
  collectionIsRevealing: boolean;
  setCollectionIsRevealing: React.Dispatch<React.SetStateAction<boolean>>;
  timeAttackRevealedRanks: Set<number>;
  setTimeAttackRevealedRanks: React.Dispatch<React.SetStateAction<Set<number>>>;
  timeAttackIsRevealing: boolean;
  setTimeAttackIsRevealing: React.Dispatch<React.SetStateAction<boolean>>;
};

const formatTime = (team: Team) => {
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : null;
  if (minutes === null) return '—';
  return `${minutes}分`;
};

const currencyFormat = (value: number | '') =>
  value === '' ? '—' : `$${value.toLocaleString('en-US')}`;

const scoreFormat = (value: number) => value.toLocaleString('ja-JP', { maximumFractionDigits: 2 });

// R.E.P.O.マスター賞のスコア計算
const calculateRepomasterScore = (team: Team, hpTotal: number): number | null => {
  const amount = typeof team.finalAmount === 'number' ? team.finalAmount : 0;
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : 0;
  
  if (minutes === 0 || amount === 0 || hpTotal === 0) {
    return null;
  }
  
  return (amount / minutes) * hpTotal * team.level;
};

// タイムアタック賞の計算（レベル5に到達したチームの中で、プレイ時間が短い順）
const calculateTimeAttackValue = (team: Team): number | null => {
  if (team.level !== 5) return null;
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : null;
  if (minutes === null || minutes === 0) return null;
  return minutes;
};

// R.E.P.O.マスター賞ランキング計算
const calculateRepomasterRanking = (teams: Team[]): RankedTeam[] => {
  const enriched = teams.map(team => {
    const hpTotal = getHpTotal(team.members);
    const score = calculateRepomasterScore(team, hpTotal);
    return { team, hpTotal, score };
  });

  const validTeams = enriched.filter(t => t.score !== null) as Array<{
    team: Team;
    hpTotal: number;
    score: number;
  }>;

  const sorted = [...validTeams].sort((a, b) => b.score - a.score);

  return sorted.reduce<RankedTeam[]>((acc, item, index) => {
    const prev = sorted[index - 1];
    const isTie = prev && prev.score === item.score;
    const rank = isTie && prev ? acc[acc.length - 1].rank : index + 1;
    acc.push({
      ...item.team,
      hpTotal: item.hpTotal,
      totalSeconds: getTotalSeconds(item.team),
      rank,
      isTie: Boolean(isTie),
    });
    return acc;
  }, []);
};

// 資材回収王チームランキング計算
const calculateCollectionRanking = (teams: Team[]): RankedTeam[] => {
  const enriched = teams.map(team => ({
    team,
    finalAmount: typeof team.finalAmount === 'number' ? team.finalAmount : 0,
    hpTotal: getHpTotal(team.members),
  }));

  const sorted = [...enriched].sort((a, b) => b.finalAmount - a.finalAmount);

  return sorted.reduce<RankedTeam[]>((acc, item, index) => {
    const prev = sorted[index - 1];
    const isTie = prev && prev.finalAmount === item.finalAmount;
    const rank = isTie && prev ? acc[acc.length - 1].rank : index + 1;
    acc.push({
      ...item.team,
      hpTotal: item.hpTotal,
      totalSeconds: getTotalSeconds(item.team),
      rank,
      isTie: Boolean(isTie),
    });
    return acc;
  }, []);
};

// タイムアタック賞ランキング計算
const calculateTimeAttackRanking = (teams: Team[]): RankedTeam[] => {
  const enriched = teams.map(team => {
    const timeValue = calculateTimeAttackValue(team);
    const hpTotal = getHpTotal(team.members);
    return { team, timeValue, hpTotal };
  });

  // レベル5到達チーム（時間が短い順）と未到達チームを分ける
  const validTeams = enriched.filter(t => t.timeValue !== null) as Array<{
    team: Team;
    timeValue: number;
    hpTotal: number;
  }>;

  const invalidTeams = enriched.filter(t => t.timeValue === null);

  // レベル5到達チームを時間順でソート
  const sorted = [...validTeams].sort((a, b) => a.timeValue - b.timeValue);

  // 全チームを統合（レベル5到達チーム + 未到達チーム）
  const allTeams: Array<{
    team: Team;
    timeValue: number;
    hpTotal: number;
    isReached: boolean;
  }> = [
    ...sorted.map(item => ({ ...item, isReached: true })),
    ...invalidTeams.map(item => ({ ...item, isReached: false, timeValue: Infinity })),
  ];

  // 順位を計算（同点処理を含む）
  const entries: RankedTeam[] = allTeams.reduce<RankedTeam[]>((acc, item, index) => {
    const prev = allTeams[index - 1];
    // レベル5到達チーム同士で時間が同じ場合は同点
    const isTie = prev && 
      item.isReached && 
      prev.isReached && 
      prev.timeValue === item.timeValue;
    
    const rank = isTie && prev ? acc[acc.length - 1].rank : index + 1;
    
    acc.push({
      ...item.team,
      hpTotal: item.hpTotal,
      totalSeconds: getTotalSeconds(item.team),
      rank,
      isTie: Boolean(isTie),
    });
    return acc;
  }, []);

  return entries;
};

type RankingSectionProps = {
  title: string;
  description: string;
  rankedTeams: RankedTeam[];
  getDisplayValue: (team: RankedTeam) => string;
  revealedRanks: Set<number>;
  setRevealedRanks: React.Dispatch<React.SetStateAction<Set<number>>>;
  isRevealing: boolean;
  setIsRevealing: React.Dispatch<React.SetStateAction<boolean>>;
};

function RankingSection({ 
  title, 
  description, 
  rankedTeams, 
  getDisplayValue,
  revealedRanks,
  setRevealedRanks,
  isRevealing,
  setIsRevealing,
}: RankingSectionProps) {
  // 賞の名前は常に表示する
  const isTitleRevealed = true;

  // このランキングに存在する全ての順位を取得
  const allRanksInRanking = useMemo(() => {
    const ranks = new Set(rankedTeams.map(t => t.rank));
    return Array.from(ranks).sort((a, b) => b - a); // 最下位から順に発表するため降順
  }, [rankedTeams]);

  const maxRank = allRanksInRanking.length > 0 ? Math.max(...allRanksInRanking) : 0;
  const allRevealed = revealedRanks.size > 0 && revealedRanks.size === allRanksInRanking.length;

  const handleRevealNext = () => {
    if (allRevealed) {
      setRevealedRanks(new Set());
      return;
    }

    setIsRevealing(true);
    // まだ発表されていない順位の中で、最も下位（最大の順位）を取得
    const unrevealedRanks = allRanksInRanking.filter(rank => !revealedRanks.has(rank));
    const nextRank = unrevealedRanks.length > 0 ? unrevealedRanks[0] : null;
    
    if (nextRank === null) return;

    setTimeout(() => {
      setRevealedRanks(prev => {
        const newSet = new Set(prev);
        newSet.add(nextRank);
        return newSet;
      });
      setIsRevealing(false);
    }, 300);
  };

  const handleRevealThree = () => {
    if (allRevealed) {
      setRevealedRanks(new Set());
      return;
    }

    setIsRevealing(true);
    // まだ発表されていない順位の中で、最下位から3つを取得
    const unrevealedRanks = allRanksInRanking.filter(rank => !revealedRanks.has(rank));
    const nextThreeRanks = unrevealedRanks.slice(0, 3); // 最下位から3つ
    
    if (nextThreeRanks.length === 0) return;

    setTimeout(() => {
      setRevealedRanks(prev => {
        const newSet = new Set(prev);
        nextThreeRanks.forEach(rank => newSet.add(rank));
        return newSet;
      });
      setIsRevealing(false);
    }, 300);
  };

  const handleRevealAll = () => {
    if (allRevealed) {
      setRevealedRanks(new Set());
      return;
    }

    const allRanks = new Set(rankedTeams.map(t => t.rank));
    setRevealedRanks(allRanks);
  };

  const isRankRevealed = (rank: number) => revealedRanks.has(rank);

  return (
    <section className="leaderboard">
      <div className="leaderboard__header">
        <div>
          <h2>{title}</h2>
          <p className="hint">{description}</p>
        </div>
        <div className="leaderboard__controls">
          <button
            className="reveal-btn reveal-btn--next"
            onClick={handleRevealNext}
            disabled={isRevealing}
          >
            {allRevealed ? 'リセット' : '次の順位を発表'}
          </button>
          <button
            className="reveal-btn reveal-btn--three"
            onClick={handleRevealThree}
            disabled={isRevealing || allRevealed}
          >
            {allRevealed ? 'リセット' : '3チームずつ発表'}
          </button>
          <button
            className="reveal-btn reveal-btn--all"
            onClick={handleRevealAll}
          >
            {allRevealed ? '全て隠す' : '全て表示'}
          </button>
        </div>
        <span className="leaderboard__count">
          表示中 {rankedTeams.length} / 全 {rankedTeams.length} チーム
        </span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>順位</th>
              <th>チーム名</th>
              <th>スコア/値</th>
              <th>最終金額</th>
              <th>プレイ時間</th>
              <th>生存HP合計</th>
              <th>Lv.</th>
            </tr>
          </thead>
          <tbody>
            {rankedTeams.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  表示できるチームがまだありません。
                </td>
              </tr>
            )}
            {rankedTeams.map(team => {
              const revealed = isRankRevealed(team.rank);
              return (
                <tr key={team.id} className={team.isTie ? 'is-tie' : undefined}>
                  <td>
                    {revealed ? (
                      <>
                        <span className="rank-badge">{team.rank}</span>
                        {team.isTie && <span className="tie-flag">同率</span>}
                      </>
                    ) : (
                      <span className="rank-badge rank-badge--hidden">?</span>
                    )}
                  </td>
                  <td>
                    <span className="team-name">
                      {revealed ? (team.name || '名称未設定') : '???'}
                    </span>
                  </td>
                  <td>{revealed ? getDisplayValue(team) : '???'}</td>
                  <td>{revealed ? currencyFormat(team.finalAmount) : '???'}</td>
                  <td>{revealed ? formatTime(team) : '???'}</td>
                  <td>{revealed ? team.hpTotal : '???'}</td>
                  <td>{revealed ? `Lv.${team.level}` : '???'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type RankingType = 'repomaster' | 'collection' | 'timeattack';

export default function RankingPage({
  teams,
  repomasterRevealedRanks,
  setRepomasterRevealedRanks,
  repomasterIsRevealing,
  setRepomasterIsRevealing,
  collectionRevealedRanks,
  setCollectionRevealedRanks,
  collectionIsRevealing,
  setCollectionIsRevealing,
  timeAttackRevealedRanks,
  setTimeAttackRevealedRanks,
  timeAttackIsRevealing,
  setTimeAttackIsRevealing,
}: RankingPageProps) {
  const [activeTab, setActiveTab] = useState<RankingType>('repomaster');
  
  const repomasterRanking = useMemo(() => calculateRepomasterRanking(teams), [teams]);
  const collectionRanking = useMemo(() => calculateCollectionRanking(teams), [teams]);
  const timeAttackRanking = useMemo(() => calculateTimeAttackRanking(teams), [teams]);

  const getActiveRanking = () => {
    switch (activeTab) {
      case 'repomaster':
        return repomasterRanking;
      case 'collection':
        return collectionRanking;
      case 'timeattack':
        return timeAttackRanking;
    }
  };

  const getActiveTitle = () => {
    switch (activeTab) {
      case 'repomaster':
        return '🏆 R.E.P.O.マスター賞';
      case 'collection':
        return '💰 資材回収王チーム';
      case 'timeattack':
        return '⚡ タイムアタック賞';
    }
  };

  const getActiveDescription = () => {
    switch (activeTab) {
      case 'repomaster':
        return 'スコアが一番高いチームが優勝（最終獲得金額 ÷ プレイ時間 × 生存HP合計 × 最終到達Lv）';
      case 'collection':
        return '一番$を稼いだチームが優勝';
      case 'timeattack':
        return '一番早くレベル5まで進んだチームが優勝';
    }
  };

  const getActiveDisplayValue = (team: RankedTeam) => {
    switch (activeTab) {
      case 'repomaster': {
        const hpTotal = getHpTotal(team.members);
        const score = calculateRepomasterScore(team, hpTotal);
        return score !== null ? scoreFormat(score) : '—';
      }
      case 'collection':
        return currencyFormat(team.finalAmount);
      case 'timeattack': {
        const timeValue = calculateTimeAttackValue(team);
        return timeValue !== null ? formatTime(team) : '未到達';
      }
    }
  };

  return (
    <div className="rankings-page">
      <div className="rankings-tabs">
        <button
          className={`ranking-tab ${activeTab === 'repomaster' ? 'ranking-tab--active' : ''}`}
          onClick={() => setActiveTab('repomaster')}
        >
          🏆 R.E.P.O.マスター賞
        </button>
        <button
          className={`ranking-tab ${activeTab === 'collection' ? 'ranking-tab--active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          💰 資材回収王チーム
        </button>
        <button
          className={`ranking-tab ${activeTab === 'timeattack' ? 'ranking-tab--active' : ''}`}
          onClick={() => setActiveTab('timeattack')}
        >
          ⚡ タイムアタック賞
        </button>
      </div>

      {activeTab === 'repomaster' && (
        <RankingSection
          title={getActiveTitle()}
          description={getActiveDescription()}
          rankedTeams={getActiveRanking()}
          getDisplayValue={getActiveDisplayValue}
          revealedRanks={repomasterRevealedRanks}
          setRevealedRanks={setRepomasterRevealedRanks}
          isRevealing={repomasterIsRevealing}
          setIsRevealing={setRepomasterIsRevealing}
        />
      )}
      {activeTab === 'collection' && (
        <RankingSection
          title={getActiveTitle()}
          description={getActiveDescription()}
          rankedTeams={getActiveRanking()}
          getDisplayValue={getActiveDisplayValue}
          revealedRanks={collectionRevealedRanks}
          setRevealedRanks={setCollectionRevealedRanks}
          isRevealing={collectionIsRevealing}
          setIsRevealing={setCollectionIsRevealing}
        />
      )}
      {activeTab === 'timeattack' && (
        <RankingSection
          title={getActiveTitle()}
          description={getActiveDescription()}
          rankedTeams={getActiveRanking()}
          getDisplayValue={getActiveDisplayValue}
          revealedRanks={timeAttackRevealedRanks}
          setRevealedRanks={setTimeAttackRevealedRanks}
          isRevealing={timeAttackIsRevealing}
          setIsRevealing={setTimeAttackIsRevealing}
        />
      )}
    </div>
  );
}
