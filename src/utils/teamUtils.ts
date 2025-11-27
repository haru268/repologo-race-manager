import { Team, Member } from '../types';

export const getHpTotal = (members: Member[]) =>
  members.reduce((sum, member) => sum + (typeof member.hp === 'number' ? member.hp : 0), 0);

export const getTotalSeconds = (team: Team) => {
  if (team.playTime.minutes === '') return null;
  const minutes = typeof team.playTime.minutes === 'number' ? team.playTime.minutes : 0;
  return minutes * 60;
};

