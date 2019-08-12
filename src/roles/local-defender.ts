import { requiredHealersForAnAttack, whitelist } from "../constants/misc";
import { findRestSpot, findHostile, findEmptyRempart } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";
import { getSafeAreaBoundaries, isInUnSafeArea } from "utils/safe-area";

export interface ILocalDefenderMemory extends CreepMemory {}

let safeAreaBoundaries: { [roomName: string]: { pos: RoomPosition }[] } = {};

class RoleLocalDefender implements IRole {
  run(creep: Creep) {
    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: ILocalDefenderMemory = creep.memory as any;

    let hostile = findHostile(creep);

    let moveOptions: TravelToOptions = { stuckValue: 1 };

    if (hostile && !isInUnSafeArea({ x: creep.pos.x, y: creep.pos.y }, creep.room)) {
      if (!safeAreaBoundaries[creep.room.name]) {
        const boundaries = getSafeAreaBoundaries(creep.room);
        if (boundaries) {
          safeAreaBoundaries[creep.room.name] = boundaries.map(i => ({
            pos: new RoomPosition(i.x, i.y, creep.room.name)
          }));
        }
      }
      const enemies = creep.room.find(FIND_HOSTILE_CREEPS, { filter: i => whitelist.indexOf(i.owner.username) === -1 });

      moveOptions = {
        obstacles: safeAreaBoundaries[creep.room.name],
        repath: enemies.length > 0 ? 1 : 0,
        roomCallback: (room, matrix) => {
          // avoid walking on areas that are in range of enemies
          // if there's a rampart, it's safe to walk on
          if ((room = creep.room.name)) {
            var ramparts = Game.rooms[room] ? Game.rooms[room].ramparts : [];

            for (const enemy of enemies) {
              const isRanged = enemy.getActiveBodyparts(RANGED_ATTACK) > 0;
              const isCac = enemy.getActiveBodyparts(ATTACK) > 0;
              const range = isRanged ? 3 : isCac ? 1 : 0;
              for (let i = -range; i <= range; i++) {
                for (let j = -range; j <= range; j++) {
                  const x = enemy.pos.x + i;
                  const y = enemy.pos.y + j;
                  const rampartHere = ramparts.find(i => i.pos.x === x && i.pos.y === y);
                  if (!rampartHere) {
                    creep.room.visual.circle(x, y, {
                      radius: 0.2,
                      opacity: 0.8,
                      fill: "transparent",
                      lineStyle: "solid",
                      stroke: "blue",
                      strokeWidth: 0.1
                    });
                    matrix.set(x, y, 200);
                  }
                }
              }
            }
          }

          return matrix;
        },
        stuckValue: 1
      };
    }

    if (boostCreep(creep) === OK) {
      return;
    }

    if (creep.hits < creep.hitsMax) {
      creep.heal(creep);
    } else {
      const damagedCreepInRange = creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: i => i.hits < i.hitsMax })[0];
      if (damagedCreepInRange) {
        if (damagedCreepInRange.pos.isNearTo(creep)) {
          creep.heal(damagedCreepInRange);
        } else {
          creep.rangedHeal(damagedCreepInRange);
        }
      }
    }

    // ATTACK MODE
    if (hostile) {
      creep.say("Yarr!", true);
      if (hostile.pos.isNearTo(creep)) {
        if (creep.getActiveBodyparts(RANGED_ATTACK)) {
          creep.rangedMassAttack();
        }
        if (creep.getActiveBodyparts(ATTACK)) {
          creep.attack(hostile);
        }
      } else {
        if (creep.getActiveBodyparts(RANGED_ATTACK)) {
          creep.rangedAttack(hostile);
        }
      }
    }

    let doNotMove = false;
    if (creep.hits < creep.hitsMax * 0.75) {
      // don't move if we're safe but damaged
      const rempartOnTopOfUs = creep.pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "rampart");
      if (rempartOnTopOfUs) {
        doNotMove = true;
      }
    }

    const rampartTarget = hostile || creep;

    const closestEmptyRempart = findEmptyRempart(rampartTarget, creep);
    if (closestEmptyRempart && !doNotMove) {
      if (closestEmptyRempart.pos.x !== creep.pos.x || closestEmptyRempart.pos.y !== creep.pos.y) {
        creep.goTo(closestEmptyRempart, moveOptions);
      }
    } else {
      const rest = findRestSpot(creep, { x: 25, y: 25 });
      if (hostile) {
        const range = creep.pos.getRangeTo(hostile);
        if (range < 3) {
          if (rest && !doNotMove) {
            creep.goTo(rest, moveOptions);
          }
        } else if (range === 3) {
          // do nothing
        } else {
          creep.goTo(hostile);
        }
      } else {
        if (rest && !doNotMove) {
          creep.say("Zzz");
          creep.goTo(rest, moveOptions);
        }
      }
    }
  }
}

profiler.registerClass(RoleLocalDefender, "RoleLocalDefender");
export const roleLocalDefender = new RoleLocalDefender();
