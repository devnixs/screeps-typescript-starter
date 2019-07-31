interface GenerateAttackCreepsInfos {
  targetRcl: number;
}

interface PartyDefinition {
  requiresRcl: number;
  canCounterRcl: number;
  requiresBoostsTier: number;
  creeps: BodyDefinition[];
  creepsCount: number;
}
interface BodyDefinition {
  [bodyPart: string]: number;
}

const t1Rcl7: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 9,
      [TOUGH]: 13,
      [HEAL]: 28
    },
    {
      [MOVE]: 9,
      [TOUGH]: 6,
      [WORK]: 12,
      [RANGED_ATTACK]: 9
    }
  ],
  creepsCount: 4,
  canCounterRcl: 7,
  requiresBoostsTier: 1,
  requiresRcl: 7
};

const t2rcl8: PartyDefinition = {
  canCounterRcl: 8,
  creeps: [
    {
      [MOVE]: 9,
      [TOUGH]: 13,
      [HEAL]: 28
    },
    {
      [MOVE]: 9,
      [TOUGH]: 16,
      [WORK]: 16,
      [RANGED_ATTACK]: 9
    }
  ],
  creepsCount: 4,
  requiresBoostsTier: 2,
  requiresRcl: 8
};

const t3rcl8: PartyDefinition = {
  canCounterRcl: 8,
  creeps: [
    {
      [MOVE]: 7,
      [TOUGH]: 13,
      [HEAL]: 30
    },
    {
      [MOVE]: 7,
      [TOUGH]: 18,
      [WORK]: 16,
      [RANGED_ATTACK]: 9
    }
  ],
  creepsCount: 4,
  requiresBoostsTier: 3,
  requiresRcl: 8
};

export function generateAttackCreeps() {}
