import { sing, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { PokingManager } from "managers/poking";
import { RoomAnalyzer } from "managers/room-analyzer";
import { getOffExit } from "utils/get-off-exits";

export interface IPokerMemory extends CreepMemory {
  targetRoom: string | null;
  lastRoomWithHostile?: string;
  fleeing: boolean;
}

class RolePoker implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive && creep.ticksToLive >= CREEP_LIFE_TIME - 5) {
      creep.notifyWhenAttacked(false);
    }

    if (getOffExit(creep) === OK) {
      return;
    }
    const memory = creep.memory as IPokerMemory;

    const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
    const dangerousEnemies = enemies.filter(i => i.getActiveBodyparts(ATTACK) || i.getActiveBodyparts(RANGED_ATTACK));
    const pacisfistEnemies = _.difference(enemies, dangerousEnemies).filter(
      i => i.pos.x > 3 && i.pos.x < 47 && i.pos.y > 3 && i.pos.y < 47
    );

    if (creep.pos.x === 1 || creep.pos.y === 1 || creep.pos.x === 48 || creep.pos.y === 48) {
      RoomAnalyzer.analyzeRoom(creep.room);
    }

    const dangerousClose = dangerousEnemies.find(i => i.pos.getRangeTo(creep) < 13);
    const roomOwner =
      creep.room.controller && creep.room.controller.reservation && creep.room.controller.reservation.username;

    /*     if (creep.pos.roomName !== memory.targetRoom && !dangerousClose) {
      if (memory.needsReassignment && creep.pos.x > 7 && creep.pos.y > 7 && creep.pos.x < 43 && creep.pos.y < 43) {
        memory.lastRoom = memory.targetRoom;
        memory.needsReassignment = false;
        PokingManager.reassign(creep);
      }
    } */

    if (dangerousClose) {
      memory.lastRoomWithHostile = creep.room.name;
      memory.fleeing = true;
      sing(creep, ["😱", "Leave me", "Alone! 😱", "I'm just", "doing my", "job 😱"]);
    } else {
      memory.fleeing = false;
    }

    if (dangerousClose && creep.room.name === memory.targetRoom) {
      PokingManager.reassign(creep);
      return;
    }

    if (!memory.targetRoom) {
      this.goHome(creep, dangerousEnemies);
      return;
    }

    if (creep.pos.roomName !== memory.targetRoom) {
      creep.goTo(new RoomPosition(25, 25, memory.targetRoom), {
        preferHighway: false,
        roomCallback: (room, matrix) => {
          if (memory.lastRoomWithHostile === room && room !== creep.room.name) {
            return false;
          }

          if (room === creep.room.name && dangerousEnemies.length) {
            const terrain = Game.map.getRoomTerrain(room);
            // avoid going around hostile.
            const range = 15; // Math.min(14, creep.pos.getRangeTo(dangerousEnemies[0]));
            const dangerMax = range * 2;
            for (const hostile of dangerousEnemies) {
              for (let i = -range; i <= range; i++)
                for (let j = -range; j <= range; j++) {
                  const x = hostile.pos.x + i;
                  const y = hostile.pos.y + j;

                  const danger = dangerMax - (Math.abs(i) + Math.abs(j));
                  const t = terrain.get(x, y);
                  const isWall = t === TERRAIN_MASK_WALL;
                  const isSwamp = t === TERRAIN_MASK_SWAMP;
                  /*                   creep.room.visual.circle(x, y, {
                    radius: 0.2,
                    opacity: danger / dangerMax,
                    fill: "transparent",
                    lineStyle: "solid",
                    stroke: "red",
                    strokeWidth: 0.1
                  }); */
                  if (isWall) {
                    matrix.set(x, y, 0xff);
                  } else {
                    matrix.set(x, y, danger + 10 + (isSwamp ? 5 : 0));
                  }
                }
            }
          }
          return matrix;
        }
      });
    } else {
      if (roomOwner === getUsername()) {
        // it's our own room.
        PokingManager.reassign(creep);
        return;
      }

      let target: Creep | AnyStructure | undefined = _.sortBy(pacisfistEnemies, i =>
        i.getActiveBodyparts(CLAIM) ? -1000 : i.pos.getRangeTo(creep)
      )[0];
      target = target || creep.room.find(FIND_STRUCTURES, { filter: i => i.structureType === "container" })[0];
      target = target || creep.room.find(FIND_STRUCTURES, { filter: i => i.structureType === "road" })[0];

      if (target) {
        sing(creep, ["Hello 😇", "😘"]);
        if (creep.pos.isNearTo(target.pos)) {
          creep.attack(target);
        } else {
          creep.goTo(target);
        }
        return;
      } else {
        // it may not be a remote anymore
        RoomAnalyzer.analyzeRoom(creep.room);
        this.goHome(creep, dangerousEnemies);
      }
    }
  }
  goHome(creep: Creep, hostiles: Creep[]) {
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""), {
        roomCallback: (room, matrix) => {
          // avoid going around hostile.
          const range = 7;
          for (const hostile of hostiles) {
            for (let i = -range; i <= range; i++)
              for (let j = -range; j <= range; j++) {
                const x = hostile.pos.x + i;
                const y = hostile.pos.y + j;

                matrix.set(x, y, 100);
              }
          }
          return matrix;
        }
      });
      return;
    }
  }
}

profiler.registerClass(RolePoker, "RolePoker");

export const rolePoker = new RolePoker();
