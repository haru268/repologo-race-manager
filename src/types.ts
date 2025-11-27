export type Member = {
  id: string;
  name: string;
  hp: number | '';
};

export type PlayTime = {
  minutes: number | '';
};

export type Team = {
  id: string;
  name: string;
  finalAmount: number | '';
  playTime: PlayTime;
  members: Member[];
  level: 1 | 2 | 3 | 4 | 5;
};

export type AppState = {
  teams: Team[];
};

export type RankedTeam = Team & {
  hpTotal: number;
  totalSeconds: number | null;
  rank: number;
  isTie: boolean;
};


