import { sing, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { PokingManager } from "managers/poking";
import { RoomAnalyzer } from "managers/room-analyzer";

export interface IPokerMemory extends CreepMemory {
  targetRoom: string;
  needsReassignment: boolean;
  lastRoom?: string;
}

class RolePoker implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive && creep.ticksToLive >= CREEP_LIFE_TIME - 5) {
      creep.notifyWhenAttacked(false);
    }
    const memory = creep.memory as IPokerMemory;

    const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
    const dangerousEnemies = enemies.filter(i => i.getActiveBodyparts(ATTACK) || i.getActiveBodyparts(RANGED_ATTACK));
    const pacisfistEnemies = _.difference(enemies, dangerousEnemies);

    const dangerousClose = dangerousEnemies.find(i => i.pos.getRangeTo(creep) < 12);
    const roomOwner =
      creep.room.controller && creep.room.controller.reservation && creep.room.controller.reservation.username;

    if (creep.pos.roomName !== memory.targetRoom && !dangerousClose) {
      if (memory.needsReassignment && creep.pos.x > 7 && creep.pos.y > 7 && creep.pos.x < 43 && creep.pos.y < 43) {
        memory.lastRoom = memory.targetRoom;
        memory.needsReassignment = false;
        PokingManager.reassign(creep);
      }
    }

    if (dangerousClose || memory.needsReassignment) {
      sing(creep, ["😱", "Leave me", "Alone! 😱", "I'm just", "doing my", "job 😨"]);
      memory.needsReassignment = true;
      this.goHome(creep, dangerousEnemies);
      return;
    }

    if (creep.pos.roomName !== memory.targetRoom) {
      creep.goTo(new RoomPosition(25, 25, memory.targetRoom), {
        preferHighway: false,
        roomCallback: (room, matrix) => {
          if (room === memory.lastRoom) {
            // avoid last room because we were chased out of it.
            return false;
          } else {
            return matrix;
          }
        }
        /* routeCallback: i => {
          console.log("Poker ", creep.name, " find route callback", i, memory.lastRoom);
        } */
      });
    } else {
      if (roomOwner === getUsername()) {
        // it's our own room.

        memory.needsReassignment = true;
        this.goHome(creep, dangerousEnemies);
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
        memory.needsReassignment = true;
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
