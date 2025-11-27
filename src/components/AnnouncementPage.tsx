import React, { useMemo, useState } from 'react';
import { Team, RankedTeam } from '../types';
import { getHpTotal } from '../utils/teamUtils';

type AnnouncementPageProps = {
  teams: Team[];
  repomasterRevealedRanks: Set<number>;
  collectionRevealedRanks: Set<number>;
  timeAttackRevealedRanks: Set<number>;
};

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
      totalSeconds: null,
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
      totalSeconds: null,
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

  const validTeams = enriched.filter(t => t.timeValue !== null) as Array<{
    team: Team;
    timeValue: number;
    hpTotal: number;
  }>;

  const invalidTeams = enriched.filter(t => t.timeValue === null);

  const sorted = [...validTeams].sort((a, b) => a.timeValue - b.timeValue);

  const allTeams: Array<{
    team: Team;
    timeValue: number;
    hpTotal: number;
    isReached: boolean;
  }> = [
    ...sorted.map(item => ({ ...item, isReached: true })),
    ...invalidTeams.map(item => ({ ...item, isReached: false, timeValue: Infinity })),
  ];

  const entries: RankedTeam[] = allTeams.reduce<RankedTeam[]>((acc, item, index) => {
    const prev = allTeams[index - 1];
    const isTie = prev && 
      item.isReached && 
      prev.isReached && 
      prev.timeValue === item.timeValue;
    
    const rank = isTie && prev ? acc[acc.length - 1].rank : index + 1;
    
    acc.push({
      ...item.team,
      hpTotal: item.hpTotal,
      totalSeconds: null,
      rank,
      isTie: Boolean(isTie),
    });
    return acc;
  }, []);

  return entries;
};

type TopThreeAnnouncementProps = {
  title: string;
  topThree: RankedTeam[];
};

function TopThreeAnnouncement({ title, topThree }: TopThreeAnnouncementProps) {
  const firstPlace = topThree.find(team => team.rank === 1);
  const secondPlace = topThree.find(team => team.rank === 2);
  const thirdPlace = topThree.find(team => team.rank === 3);

  return (
    <div className="award-stage">
      <video
        className="award-stage__video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      >
        <source src="/148051_1280x720.mp4" type="video/mp4" />
        {/* 動画が読み込めない場合のフォールバック画像 */}
        <img src="/Snapshot(32).jpg" alt="Award Stage" />
      </video>
      
      <div className="award-stage__frame">
        <h2 className="award-stage__title">{title}</h2>
      </div>
      
      <div className="award-stage__podium">
        <div className="podium podium--first">
          <div className="podium__content">
            <div className="podium__number">1</div>
            <div className="podium__name">
              {firstPlace ? (firstPlace.name || '名称未設定') : '???'}
            </div>
          </div>
          {firstPlace && (
            <div className="podium__crown">👑</div>
          )}
        </div>
        
        <div className="podium podium--second">
          <div className="podium__content">
            <div className="podium__number">2</div>
            <div className="podium__name">
              {secondPlace ? (secondPlace.name || '名称未設定') : '???'}
            </div>
          </div>
        </div>
        
        <div className="podium podium--third">
          <div className="podium__content">
            <div className="podium__number">3</div>
            <div className="podium__name">
              {thirdPlace ? (thirdPlace.name || '名称未設定') : '???'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type AnnouncementType = 'repomaster' | 'collection' | 'timeattack';

export default function AnnouncementPage({
  teams,
  repomasterRevealedRanks,
  collectionRevealedRanks,
  timeAttackRevealedRanks,
}: AnnouncementPageProps) {
  const [activeTab, setActiveTab] = useState<AnnouncementType>('repomaster');
  
  const repomasterRanking = useMemo(() => calculateRepomasterRanking(teams), [teams]);
  const collectionRanking = useMemo(() => calculateCollectionRanking(teams), [teams]);
  const timeAttackRanking = useMemo(() => calculateTimeAttackRanking(teams), [teams]);

  // 各ランキングの1～3位を取得
  const getTopThree = (ranking: RankedTeam[], revealedRanks: Set<number>) => {
    const topThree = ranking
      .filter(team => team.rank <= 3 && revealedRanks.has(team.rank))
      .sort((a, b) => a.rank - b.rank);
    return topThree;
  };

  const repomasterTopThree = getTopThree(repomasterRanking, repomasterRevealedRanks);
  const collectionTopThree = getTopThree(collectionRanking, collectionRevealedRanks);
  const timeAttackTopThree = getTopThree(timeAttackRanking, timeAttackRevealedRanks);

  const getActiveTopThree = () => {
    switch (activeTab) {
      case 'repomaster':
        return repomasterTopThree;
      case 'collection':
        return collectionTopThree;
      case 'timeattack':
        return timeAttackTopThree;
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

  return (
    <div className="announcement-page">
      <div className="announcement-tabs">
        <button
          className={`announcement-tab ${activeTab === 'repomaster' ? 'announcement-tab--active' : ''}`}
          onClick={() => setActiveTab('repomaster')}
        >
          🏆 R.E.P.O.マスター賞
        </button>
        <button
          className={`announcement-tab ${activeTab === 'collection' ? 'announcement-tab--active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          💰 資材回収王チーム
        </button>
        <button
          className={`announcement-tab ${activeTab === 'timeattack' ? 'announcement-tab--active' : ''}`}
          onClick={() => setActiveTab('timeattack')}
        >
          ⚡ タイムアタック賞
        </button>
      </div>

      <TopThreeAnnouncement
        title={getActiveTitle()}
        topThree={getActiveTopThree()}
      />
    </div>
  );
}

