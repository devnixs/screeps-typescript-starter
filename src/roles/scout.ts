import { requiredHealersForAnAttack, signature, whitelist } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { hasMinerals, getMyRooms, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { ExplorationCache } from "../utils/exploration-cache";
import { Cartographer } from "utils/cartographer";
import { RoomAnalyzer } from "managers/room-analyzer";

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

    this.findNextRoom(creep);

    if (this.signIfNecessary(creep) === OK) {
      return;
    }

    this.showStatus(creep);

    const moveOptions: TravelToOptions = this.getMoveOptions();
    if (memory.targetExit) {
      creep.goTo(
        new RoomPosition(memory.targetExit.x, memory.targetExit.y, memory.targetExit.roomName || creep.room.name),
        moveOptions
      );
    } else {
      creep.goTo(new RoomPosition(25, 25, memory.targetRoom as string), moveOptions);
    }
  }

  findNextRoom(creep: Creep) {
    const homeRoom = Game.rooms[creep.memory.homeRoom];
    const memory = creep.memory as IScoutMemory;
    let cpu = Game.cpu.getUsed();

    if (creep.room.name === memory.targetRoom || !memory.targetRoom || !memory.targetExitDir) {
      const myRooms = getMyRooms();
      if (!myRooms.find(i => i === creep.room)) {
        RoomAnalyzer.analyzeRoom(creep.room);
        const roomMemory = ExplorationCache.getExploration(creep.room.name);
        if (roomMemory) {
          roomMemory.l = Game.time;
        }
      }

      // console.log("Looking for new room", creep.room.name);
      const neighboorRooms = _.shuffle(_.pairs(Game.map.describeExits(creep.room.name)) as [[FindConstant, string]]);

      const removedEnemyRooms = neighboorRooms.filter(pair => {
        const room = pair[1];
        const roomMemory = ExplorationCache.getExploration(room);

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

        const roomMemory = ExplorationCache.getExploration(room);

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
  }

  signIfNecessary(creep: Creep) {
    const currentSign = creep.room.controller && creep.room.controller.sign && creep.room.controller.sign.text;
    const currentSignUser = creep.room.controller && creep.room.controller.sign && creep.room.controller.sign.username;
    const roomIsOwned = creep.room.controller && creep.room.controller.owner && !creep.room.controller.my;

    if (
      !roomIsOwned &&
      creep.room.controller &&
      (currentSignUser !== getUsername() || (currentSign && !currentSign.endsWith(signature)))
    ) {
      this.signController(creep, creep.room.controller);
      return OK;
    } else {
      return -1;
    }
  }

  signController(creep: Creep, controller: StructureController) {
    creep.goTo(controller, {
      roomCallback: (roomName, matrix) => (roomName === creep.room.name ? matrix : false)
    });
    const hasExplorationMemory = ExplorationCache.getExploration(creep.room.name);
    if (hasExplorationMemory && hasExplorationMemory.c) {
      creep.signController(controller, hasExplorationMemory.c.s + " " + signature);
    } else {
      creep.signController(controller, signature);
    }
  }

  showStatus(creep: Creep) {
    const memory = creep.memory as IScoutMemory;
    if (Game.time % 2 === 0) {
      creep.say(memory.targetRoom || "");
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
  }

  getMoveOptions() {
    const moveOptions: TravelToOptions = {
      ignoreRoads: true,
      disableCaching: true,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        // avoid enemies if possible
        const room = Game.rooms[roomName];
        const cpu = Game.cpu.getUsed();
        if (room) {
          const enemies = room.find(FIND_HOSTILE_CREEPS, { filter: i => whitelist.indexOf(i.owner.username) === -1 });
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
    return moveOptions;
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
