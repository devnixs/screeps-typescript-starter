import { findEmptySpotCloseTo } from "utils/finder";

class Architect {
  run() {
    // Do the architect logic once every 100 ticks
    if (Game.time % 100 > 0) {
      return;
    }

    var spawns: StructureSpawn[] = _.values(Game.spawns) as any;
    const roomNames = _.uniq(spawns.map((i: StructureSpawn) => i.room.name));

    roomNames.forEach(roomName => {
      const room = Game.rooms[roomName];
      this.architectRoom(room);
    });
  }

  architectRoom(room: Room) {
    var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length === 0) {
      if (this.createExtension(room) != OK) {
        if (this.createContainers(room) != OK) {
          this.createRoad(room);
        }
      }
    }
  }

  createExtension(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }
    const spot = findEmptySpotCloseTo(spawn.pos, room);
    if (spot) {
      return room.createConstructionSite(spot.x, spot.y, STRUCTURE_EXTENSION);
    } else {
      return -1;
    }
  }

  createContainers(room: Room) {
    console.log("Creating container");
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }

    const existingContainers = room.find(FIND_MY_STRUCTURES, {
      filter: structure => (structure.structureType as any) === STRUCTURE_CONTAINER
    });
    console.log("Found " + existingContainers.length + "container(s)");

    const gcl = room.controller ? room.controller.level : 1;

    if (existingContainers.length >= 1) {
      return -1;
    }

    const spot = findEmptySpotCloseTo(spawn.pos, room);
    console.log("Found an empty spot");
    if (spot) {
      return room.createConstructionSite(spot.x, spot.y, STRUCTURE_CONTAINER);
    } else {
      return -1;
    }
  }

  createRoad(room: Room) {
    const creeps = room.find(FIND_MY_CREEPS);
    if (creeps.length === 0) {
      return -1;
    }

    const shuffledCreeps = _.shuffle(creeps);

    for (var i = 0; i < shuffledCreeps.length; i++) {
      const creep = shuffledCreeps[i];
      const result = room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_ROAD);
      if (result === OK) {
        return result;
      }
    }

    return -1;
  }
}

export const architect = new Architect();
