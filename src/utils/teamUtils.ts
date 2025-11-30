import { Team, Member } from '../types';

const MAX_MEMBER_COUNT = 4;
const HP_PER_MISSING_MEMBER = 80;

// 実際にプレイしたメンバー数をカウント（名前またはHPが入力されている）
const countActiveMembers = (members: Member[]): number => {
  return members.filter(member => {
    const hasName = member.name.trim() !== '';
    const hasHp = typeof member.hp === 'number' && member.hp > 0;
    return hasName || hasHp;
  }).length;
};

// HP合計を計算（人数不足補正付き）
export const getHpTotal = (members: Member[]): number => {
  // 実際のHP合計
  const actualHpTotal = members.reduce((sum, member) => 
    sum + (typeof member.hp === 'number' ? member.hp : 0), 0
  );
  
  // 実際にプレイしたメンバー数
  const activeMemberCount = countActiveMembers(members);
  
  // 不足している人数
  const missingMemberCount = MAX_MEMBER_COUNT - activeMemberCount;
  
  // 人数不足補正（1人不足につき+80）
  const compensation = Math.max(0, missingMemberCount) * HP_PER_MISSING_MEMBER;
  
  return actualHpTotal + compensation;
};

// HP合計の詳細情報を取得（実際のHPと補正分を分けて返す）
export const getHpTotalDetail = (members: Member[]) => {
  const actualHpTotal = members.reduce((sum, member) => 
    sum + (typeof member.hp === 'number' ? member.hp : 0), 0
  );
  
  const activeMemberCount = countActiveMembers(members);
  const missingMemberCount = MAX_MEMBER_COUNT - activeMemberCount;
  const compensation = Math.max(0, missingMemberCount) * HP_PER_MISSING_MEMBER;
  const totalHp = actualHpTotal + compensation;
  
  return {
    actual: actualHpTotal,
    compensation,
    total: totalHp,
    activeMemberCount,
    missingMemberCount,
  };
};

export const getTotalSeconds = (team: Team) => {
  if (team.playTime.minutes === '') return null;
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : 0;
  return minutes * 60;
};

