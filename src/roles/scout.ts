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
  targetExit?: { x: number; y: number };
  alreadyExploredRooms: string[];
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

    memory.alreadyExploredRooms = memory.alreadyExploredRooms || [];

    if (memory.alreadyExploredRooms.indexOf(creep.room.name) === -1) {
      memory.alreadyExploredRooms.push(creep.room.name);
    }

    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (!homeRoom) {
      return;
    }

    if (creep.room.name === memory.targetRoom || !memory.targetRoom || !memory.targetExitDir) {
      const myRooms = getMyRooms();
      if (!myRooms.find(i => i === creep.room)) {
        ExplorationManager.analyzeRoom(creep.room);
      }
      // console.log("Looking for new room", creep.room.name);
      const neighboorRooms = _.shuffle(_.pairs(Game.map.describeExits(creep.room.name)) as [[FindConstant, string]]);

      // console.log(JSON.stringify(neighboorRooms));
      const newTarget = _.sortBy(neighboorRooms, pair => {
        // avoid enemies
        const room = pair[1];
        let score = 0;

        const roomMemory = Memory.roomExplorations.find(i => i.name === room);
        const isOneOfMyRooms = myRooms.find(i => i.name === room);
        const alreadyExplored = memory.alreadyExploredRooms.indexOf(room) >= 0;

        if (roomMemory && (roomMemory.enemyBase || roomMemory.enemyRemote)) {
          score = Infinity;
        }

        const type = Cartographer.roomType(room);

        if (isOneOfMyRooms || alreadyExplored || type == "SK") {
          // avoid my rooms
          score = 200000;
        } else {
          score = Game.map.getRoomLinearDistance(homeRoom.name, room);
        }

        // console.log("Room", room, "has score", score);
        return score;
      });
      console.log(JSON.stringify(newTarget[0]));

      memory.targetExitDir = Number(newTarget[0][0]) as FindConstant;
      memory.targetRoom = newTarget[0][1];
      const closest = creep.pos.findClosestByRange(memory.targetExitDir) as RoomPosition;
      if (closest) {
        memory.targetExit = { x: closest.x, y: closest.y };
      } else {
        delete memory.targetExit;
      }
    }

    if (
      creep.room.controller &&
      (!creep.room.controller.sign || creep.room.controller.sign.username != getUsername())
    ) {
      creep.goTo(creep.room.controller);
      const hasExplorationMemory = Memory.roomExplorations.find(i => i.name === creep.room.name);
      if (hasExplorationMemory && hasExplorationMemory.colonizable) {
        creep.signController(creep.room.controller, hasExplorationMemory.colonizable.s + " " + signature);
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

    const moveOptions: MoveToOpts = { ignoreRoads: true, swampCost: 1, plainCost: 1 };

    if (memory.targetExit) {
      creep.goTo(new RoomPosition(memory.targetExit.x, memory.targetExit.y, creep.room.name), moveOptions);
    } else {
      creep.goTo(new RoomPosition(25, 25, memory.targetRoom), moveOptions);
    }
  }
}

profiler.registerClass(RoleScout, "RoleScout");

export const roleScout = new RoleScout();
