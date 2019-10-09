import { boostResources } from "constants/resources";
import { repeatArray, mergeObjects, getMyRooms } from "utils/misc-utils";
import { ExplorationCache } from "utils/exploration-cache";
import { profiler } from "utils/profiler";
import { S_IFSOCK } from "constants";

interface GenerateAttackCreepsInfos {
  fromRoom: string;
  targetRoom: string;
  force: boolean;
  priority?: number;
  name?: string;
}

interface PartyDefinition {
  requiresRcl: number;
  canCounterRcl: number;
  requiresBoostsTier: number;
  creeps: BodyDefinition[];
  repeat: number;
  boostedParts?: string[];
  name: string;
}
interface BodyDefinition {
  [bodyPart: string]: number;
}

const t0Rcl5: PartyDefinition = {
  name: "t0Rcl5",
  creeps: [
    {
      [MOVE]: 13,
      [ATTACK]: 13
    },
    {
      [MOVE]: 6,
      [RANGED_ATTACK]: 0,
      [HEAL]: 5
    }
  ],
  repeat: 2,
  canCounterRcl: 2,
  requiresBoostsTier: 0,
  requiresRcl: 5
};

const t0Rcl6: PartyDefinition = {
  name: "t0Rcl6",
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

const t0Rcl7: PartyDefinition = {
  name: "t0Rcl7",
  creeps: [
    {
      [MOVE]: 23,
      [RANGED_ATTACK]: 13,
      [HEAL]: 10
    }
  ],
  repeat: 4,
  canCounterRcl: 4,
  requiresBoostsTier: 0,
  requiresRcl: 6
};

const t1Rcl6: PartyDefinition = {
  name: "t1Rcl6",
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

const t2Rcl6: PartyDefinition = {
  name: "t2Rcl6",
  creeps: [
    {
      [MOVE]: 4,
      [RANGED_ATTACK]: 7,
      [HEAL]: 4
    }
  ],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 2,
  requiresRcl: 6
};

const t1Rcl6NoMoveBoosts: PartyDefinition = {
  name: "t1Rcl6NoMoveBoosts",
  creeps: [
    {
      [MOVE]: 9,
      [RANGED_ATTACK]: 5,
      [HEAL]: 4
    }
  ],
  boostedParts: [RANGED_ATTACK, HEAL],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 1,
  requiresRcl: 6
};

const t2Rcl6NoMoveBoosts: PartyDefinition = {
  name: "t2Rcl6NoMoveBoosts",
  creeps: [
    {
      [MOVE]: 9,
      [RANGED_ATTACK]: 5,
      [HEAL]: 4
    }
  ],
  boostedParts: [RANGED_ATTACK, HEAL],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 2,
  requiresRcl: 6
};

const t1Rcl7: PartyDefinition = {
  name: "t1Rcl7",
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
  name: "t2Rcl7",
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

const t3Rcl7: PartyDefinition = {
  name: "t3Rcl7",
  creeps: [
    {
      [MOVE]: 9,
      [TOUGH]: 14,
      [HEAL]: 20
    },
    {
      [TOUGH]: 10,
      [MOVE]: 10,
      [WORK]: 15,
      [RANGED_ATTACK]: 15
    }
  ],
  repeat: 2,
  canCounterRcl: 7,
  requiresBoostsTier: 3,
  requiresRcl: 7
};

const t3Rcl7RangedAttack: PartyDefinition = {
  name: "t3Rcl7RangedAttack",
  creeps: [
    {
      [TOUGH]: 6,
      [MOVE]: 8,
      [RANGED_ATTACK]: 15,
      [HEAL]: 11
    }
  ],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 3,
  requiresRcl: 7
};

const t3Rcl7NoRangedAttackBoosts: PartyDefinition = {
  name: "t3Rcl7NoRangedAttackBoosts",
  creeps: [
    {
      [MOVE]: 9,
      [TOUGH]: 14,
      [HEAL]: 20
    },
    {
      [TOUGH]: 10,
      [MOVE]: 10,
      [WORK]: 15,
      [RANGED_ATTACK]: 15
    }
  ],
  boostedParts: [MOVE, WORK, TOUGH, HEAL],
  repeat: 2,
  canCounterRcl: 7,
  requiresBoostsTier: 3,
  requiresRcl: 7
};

const t3Rcl7OnlyHealBoosts: PartyDefinition = {
  name: "t3Rcl7OnlyHealBoosts",
  creeps: [
    {
      [MOVE]: 22,
      [RANGED_ATTACK]: 10,
      [HEAL]: 12
    }
  ],
  boostedParts: [HEAL],
  repeat: 4,
  canCounterRcl: 7,
  requiresBoostsTier: 3,
  requiresRcl: 7
};

const t3Rcl7NoMoveParts: PartyDefinition = {
  name: "t3Rcl7NoMoveParts",
  creeps: [
    {
      [TOUGH]: 6,
      [MOVE]: 25,
      [RANGED_ATTACK]: 9,
      [HEAL]: 10
    }
  ],
  repeat: 4,
  canCounterRcl: 6,
  requiresBoostsTier: 3,
  boostedParts: [TOUGH, RANGED_ATTACK, HEAL],
  requiresRcl: 7
};

const t0rcl8: PartyDefinition = {
  name: "t0rcl8",
  canCounterRcl: 5,
  creeps: [
    {
      [MOVE]: 25,
      [RANGED_ATTACK]: 12,
      [HEAL]: 13
    }
  ],
  repeat: 4,
  requiresBoostsTier: 0,
  requiresRcl: 8
};

const t0rcl8Attack: PartyDefinition = {
  name: "t0rcl8Attack",
  canCounterRcl: 5,
  creeps: [
    {
      [MOVE]: 25,
      [ATTACK]: 12,
      [HEAL]: 13
    }
  ],
  repeat: 4,
  requiresBoostsTier: 0,
  requiresRcl: 8
};

const t2rcl8: PartyDefinition = {
  name: "t2rcl8",
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

const t3rcl8Ranged: PartyDefinition = {
  name: "t3rcl8Ranged",
  canCounterRcl: 8,
  creeps: [
    {
      [MOVE]: 10,
      [TOUGH]: 10,
      [HEAL]: 15,
      [RANGED_ATTACK]: 15
    }
  ],
  repeat: 4,
  requiresBoostsTier: 3,
  requiresRcl: 8
};

const t3rcl8: PartyDefinition = {
  name: "t3rcl8",
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

const definitions = [
  t3rcl8,
  t3rcl8Ranged,
  t2rcl8,
  t3Rcl7,
  t3Rcl7RangedAttack,
  t3Rcl7NoRangedAttackBoosts,
  t3Rcl7NoMoveParts,
  t2Rcl7,
  t3Rcl7OnlyHealBoosts,
  t1Rcl7,
  t0rcl8,
  t0rcl8Attack,
  t2Rcl6,
  t2Rcl6NoMoveBoosts,
  t1Rcl6NoMoveBoosts,
  t0Rcl7,
  t1Rcl6,
  t0Rcl6,
  t0Rcl5
];

function generateAttackCreepsFn(infos: GenerateAttackCreepsInfos) {
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
  let targetRcl = targetRoomInfos ? targetRoomInfos.el : undefined;

  const allTerminals = getMyRooms()
    .map(i => {
      let store = (i.terminal && i.terminal.store) as any;
      // if it's in another room, only 100 of that resource can be transfered.
      if (i.name !== fromRoom.name) {
        store = _.clone(store);
        for (const mineral in store) {
          if (store[mineral] && store[mineral] < 100) {
            store[mineral] = 0;
          }
        }
      }
      return store;
    })
    .filter(i => i);
  const resourcesAvailable: any = mergeObjects(allTerminals);

  let forcedAttackRcl = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !!Game.flags["force_attack_rcl_" + i]);

  if (infos.priority) {
    forcedAttackRcl = Math.floor(infos.priority * 8);
  }

  for (const def of definitions) {
    const parts = mergeObjects(def.creeps);

    let needsBoostResources: MineralNeed[] = [];
    if (def.requiresBoostsTier > 0) {
      needsBoostResources = Object.keys(parts)
        .filter(i => !def.boostedParts || def.boostedParts.indexOf(i) >= 0)
        .map(part => {
          return {
            mineral: boostResources[part][def.requiresBoostsTier],
            requiredAmount: parts[part] * LAB_BOOST_MINERAL * def.repeat
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

    const canDefeat = targetRcl === undefined || infos.force || targetRcl <= def.canCounterRcl;
    const forcedRclMatches = !forcedAttackRcl || forcedAttackRcl === def.requiresRcl;
    const noBoosts = !("no_boosts" in Game.flags) || def.requiresBoostsTier === 0;
    const hasCorrectName = !Memory.forceAttackKind || Memory.forceAttackKind === def.name;

    if (hasCorrectName && hasEnoughBoosts && hasEnoughRcl && canDefeat && forcedRclMatches && noBoosts) {
      return {
        creeps: repeatArray(def.creeps, def.repeat),
        minerals: needsBoostResources,
        name: def.name
      };
    }
  }

  return null;
}

(global as any).generateAttackCreeps = generateAttackCreepsFn;

const generateAttackCreeps = profiler.registerFN(
  generateAttackCreepsFn,
  "generateAttackCreeps"
) as (typeof generateAttackCreepsFn);

export { generateAttackCreeps };
