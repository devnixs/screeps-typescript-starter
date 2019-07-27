import { requiredHealersForAnAttack, signature } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { hasMinerals, getMyRooms, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { ExplorationManager } from "managers/exploration";
import { Cartographer } from "utils/cartographer";

export interface IScoutMemory extends CreepMemory {
  targetRoom: string | undefined;
  targetExitDir: FindConstant | undefined;
  targetExit?: { x: number; y: number; roomName: string };
  lastPos: { x: number; y: number };
}

class RoleScout implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive && creep.ticksToLive >= CREEP_LIFE_TIME - 5) {
      creep.notifyWhenAttacked(false);
    }
    const memory = creep.memory as IScoutMemory;

    if (Game.time % 7 === 0) {
      if (memory.lastPos && creep.pos.x === memory.lastPos.x && creep.pos.y === memory.lastPos.y) {
        delete memory.targetRoom;
        delete memory.targetExit;
        delete memory.targetExitDir;
        creep.say("Reset");
      }

      memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
    }

    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (!homeRoom) {
      return;
    }

    if (creep.room.name === memory.targetRoom || !memory.targetRoom || !memory.targetExitDir) {
      const myRooms = getMyRooms();
      if (!myRooms.find(i => i === creep.room)) {
        ExplorationManager.analyzeRoom(creep.room);
        const roomMemory = ExplorationManager.getExploration(creep.room.name);
        if (roomMemory) {
          roomMemory.l = Game.time;
        }
      }
      // console.log("Looking for new room", creep.room.name);
      const neighboorRooms = _.shuffle(_.pairs(Game.map.describeExits(creep.room.name)) as [[FindConstant, string]]);

      const removedEnemyRooms = neighboorRooms.filter(pair => {
        const room = pair[1];
        const roomMemory = ExplorationManager.getExploration(room);

        const isEnemy = roomMemory && roomMemory.eb;

        const canGo = Game.map.isRoomAvailable(room);
        return !isEnemy && canGo;
      });

      // some time we want to ignore trying to find closer rooms. This helps scouting further.
      const closestFirst =
        Game.time % 4 === 0
          ? _.sortBy(removedEnemyRooms, pair => {
              return Cartographer.findRoomDistanceSum(homeRoom.name, pair[1]);
            })
          : removedEnemyRooms;

      const avoidMyRooms = _.sortBy(closestFirst, pair => {
        const room = pair[1];
        return myRooms.find(i => i.name === room) ? 1 : 0;
      });

      const lastCheckedFirst = _.sortBy(avoidMyRooms, pair => {
        const room = pair[1];

        const roomMemory = ExplorationManager.getExploration(room);

        if (myRooms.find(i => i.name === room)) {
          return Infinity;
        }

        if (!roomMemory) {
          return 0;
        } else {
          return roomMemory.l;
        }
      });

      const bestExit = lastCheckedFirst[0];
      if (!bestExit) {
        this.goHome(creep);
        return;
      }

      memory.targetExitDir = Number(bestExit[0]) as FindConstant;
      memory.targetRoom = bestExit[1];
      const closest = creep.pos.findClosestByRange(memory.targetExitDir) as RoomPosition;
      if (closest) {
        memory.targetExit = { x: closest.x, y: closest.y, roomName: creep.pos.roomName };
      } else {
        delete memory.targetExit;
      }
    }

    const currentSign = creep.room.controller && creep.room.controller.sign && creep.room.controller.sign.text;
    const currentSignUser = creep.room.controller && creep.room.controller.sign && creep.room.controller.sign.username;

    if (
      creep.room.controller &&
      (currentSignUser !== getUsername() || (currentSign && !currentSign.endsWith(signature)))
    ) {
      creep.goTo(creep.room.controller);
      const hasExplorationMemory = ExplorationManager.getExploration(creep.room.name);
      if (hasExplorationMemory && hasExplorationMemory.c) {
        creep.signController(creep.room.controller, hasExplorationMemory.c.s + " " + signature);
      } else {
        creep.signController(creep.room.controller, signature);
      }
      return;
    }

    if (Game.time % 2 === 0) {
      creep.say(memory.targetRoom);
    } else {
      if (memory.targetExitDir === FIND_EXIT_TOP) {
        creep.say("⬆️");
      } else if (memory.targetExitDir === FIND_EXIT_BOTTOM) {
        creep.say("⬇️");
      } else if (memory.targetExitDir === FIND_EXIT_RIGHT) {
        creep.say("➡️ ");
      } else if (memory.targetExitDir === FIND_EXIT_LEFT) {
        creep.say("⬅️");
      }
    }

    const moveOptions: TravelToOptions = {
      ignoreRoads: true,
      disableCaching: true,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        // avoid enemies if possible
        const room = Game.rooms[roomName];
        if (room) {
          const enemies = room.find(FIND_HOSTILE_CREEPS);
          enemies.forEach(enemy => {
            for (let i = -3; i <= 3; i++)
              for (let j = -3; j <= 3; j++) {
                const x = enemy.pos.x + i;
                const y = enemy.pos.y + j;
                if (x >= 0 || x <= 49 || y >= 0 || y <= 49) {
                  matrix.set(x, y, 200);
                }
              }
          });
        }

        return matrix;
      }
    };

    if (memory.targetExit) {
      creep.goTo(
        new RoomPosition(memory.targetExit.x, memory.targetExit.y, memory.targetExit.roomName || creep.room.name),
        moveOptions
      );
    } else {
      creep.goTo(new RoomPosition(25, 25, memory.targetRoom), moveOptions);
    }
  }
  goHome(creep: Creep) {
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
      return;
    }
  }
}

profiler.registerClass(RoleScout, "RoleScout");

export const roleScout = new RoleScout();
