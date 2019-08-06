import { boostResources } from "constants/resources";
import { repeatArray } from "utils/misc-utils";
import { ExplorationCache } from "utils/exploration-cache";

interface GenerateAttackCreepsInfos {
  fromRoom: string;
  targetRoom: string;
  force: boolean;
}

interface PartyDefinition {
  requiresRcl: number;
  canCounterRcl: number;
  requiresBoostsTier: number;
  creeps: BodyDefinition[];
  repeat: number;
}
interface BodyDefinition {
  [bodyPart: string]: number;
}

const t0Rcl5: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 6,
      [RANGED_ATTACK]: 2,
      [HEAL]: 4
    }
  ],
  repeat: 4,
  canCounterRcl: 2,
  requiresBoostsTier: 0,
  requiresRcl: 6
};

const t0Rcl6: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 10,
      [RANGED_ATTACK]: 3,
      [HEAL]: 5
    }
  ],
  repeat: 4,
  canCounterRcl: 2,
  requiresBoostsTier: 0,
  requiresRcl: 6
};

const t1Rcl6: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 5,
      [RANGED_ATTACK]: 6,
      [HEAL]: 4
    }
  ],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 1,
  requiresRcl: 6
};

const t1Rcl7: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 15,
      [TOUGH]: 10,
      [HEAL]: 19
    },
    {
      [MOVE]: 14,
      [TOUGH]: 5,
      [WORK]: 12,
      [RANGED_ATTACK]: 11
    }
  ],
  repeat: 2,
  canCounterRcl: 4,
  requiresBoostsTier: 1,
  requiresRcl: 7
};

const t2Rcl7: PartyDefinition = {
  creeps: [
    {
      [MOVE]: 11,
      [TOUGH]: 14,
      [HEAL]: 19
    },
    {
      [MOVE]: 11,
      [TOUGH]: 10,
      [WORK]: 11,
      [RANGED_ATTACK]: 12
    }
  ],
  repeat: 2,
  canCounterRcl: 7,
  requiresBoostsTier: 2,
  requiresRcl: 7
};

const t2rcl8: PartyDefinition = {
  canCounterRcl: 7,
  creeps: [
    {
      [MOVE]: 13,
      [TOUGH]: 11,
      [HEAL]: 26
    },
    {
      [MOVE]: 13,
      [TOUGH]: 15,
      [WORK]: 14,
      [RANGED_ATTACK]: 8
    }
  ],
  repeat: 2,
  requiresBoostsTier: 2,
  requiresRcl: 8
};

const t3rcl8: PartyDefinition = {
  canCounterRcl: 8,
  creeps: [
    {
      [MOVE]: 11,
      [TOUGH]: 11,
      [HEAL]: 28
    },
    {
      [MOVE]: 10,
      [TOUGH]: 18,
      [WORK]: 14,
      [RANGED_ATTACK]: 8
    }
  ],
  repeat: 2,
  requiresBoostsTier: 3,
  requiresRcl: 8
};

const definitions = [t3rcl8, t2rcl8, t2Rcl7, t1Rcl7, t1Rcl6, t0Rcl6, t0Rcl5];

export function generateAttackCreeps(infos: GenerateAttackCreepsInfos) {
  const fromRoom = Game.rooms[infos.fromRoom];
  if (!fromRoom) {
    console.log("Cannot find home room");
    return null;
  }
  if (!fromRoom) {
    console.log("Cannot find home room");
    return null;
  }

  const targetRoomInfos = ExplorationCache.getExploration(infos.targetRoom);
  const targetRcl = targetRoomInfos ? targetRoomInfos.el : undefined;

  const resourcesAvailable: any = fromRoom.terminal ? fromRoom.terminal.store : {};

  for (const def of definitions) {
    const parts = def.creeps.reduce((acc, creep) => _.merge(acc, creep, (i, j) => (i || 0) + (j || 0)), {});

    let needsBoostResources: MineralNeed[] = [];
    if (def.requiresBoostsTier > 0) {
      needsBoostResources = Object.keys(parts).map(part => {
        return {
          mineral: boostResources[part][def.requiresBoostsTier],
          requiredAmount: parts[part] * LAB_BOOST_MINERAL
        };
      });
    }

    let hasEnoughBoosts = false;
    let hasEnoughRcl = false;
    if (def.requiresBoostsTier === 0) {
      hasEnoughBoosts = true;
    } else {
      const resourceUnavailable = needsBoostResources.find(
        need => need.requiredAmount > (resourcesAvailable[need.mineral as any] || 0)
      );
      hasEnoughBoosts = !resourceUnavailable;
    }

    hasEnoughRcl = fromRoom.controller ? fromRoom.controller.level >= def.requiresRcl : false;

    if (hasEnoughBoosts && hasEnoughRcl && (targetRcl === undefined || infos.force || targetRcl <= def.canCounterRcl)) {
      return {
        creeps: repeatArray(def.creeps, def.repeat),
        minerals: needsBoostResources
      };
    }
  }

  return null;
}

(global as any).generateAttackCreeps = generateAttackCreeps;
