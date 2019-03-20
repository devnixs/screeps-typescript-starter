import { findEmptySpotCloseTo } from "utils/finder";
import { O_NOFOLLOW } from "constants";

const isSimulation = "sim" in Game.rooms;
const delay = isSimulation ? 1 : 100;

class Architect {
  run() {
    // Do the architect logic once every 100 ticks
    if (Game.time % delay > 0) {
      return;
    }

    const roomNames = Object.keys(Game.rooms)
      .map(i => Game.rooms[i])
      .filter(i => i.controller && i.controller.my)
      .map(i => i.name);

    roomNames.forEach(roomName => {
      const room = Game.rooms[roomName];
      this.architectRoom(room);
    });
  }

  architectRoom(room: Room) {
    var constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    var creations = [
      this.createInitialSpawn,
      this.createSourcesRoads,
      this.createControllerRoads,
      this.createColonyRoads,
      this.createExtension,
      this.createContainers,
      this.createMineralRoads,
      this.createExtractor,
      this.createTowers,
      this.createStorage,
      this.createTerminal
    ];

    if (constructionSites.length === 0) {
      for (let i = 0; i < creations.length; i++) {
        let result = creations[i].bind(this)(room);
        if (result === OK) {
          break;
        }
      }
    }
  }

  createExtractor(room: Room) {
    var hasExtractor = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === "extractor" }).length > 0;
    var hasLevel = room.controller && room.controller.level >= 6;

    if (hasLevel && !hasExtractor) {
      var mineral = room.find(FIND_MINERALS)[0];
      if (mineral) {
        return room.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
      }
    }

    return -1;
  }

  createColonyRoads(room: Room) {
    if (!room.memory.areColonyRoadsSetup && room.controller && room.controller.level >= 2) {
      var firstSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++) {
          if (x !== 0 || y !== 0) {
            this.iterateInDirection(firstSpawn.pos, { x, y }, 5, pos => {
              this.createRoadAtPositionIfPossible(room, pos);
            });
          }
        }

      room.memory.areColonyRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createSourcesRoads(room: Room) {
    if (!room.memory.areSourcesRoadsSetup) {
      var firstSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      var sources = room.find(FIND_SOURCES);
      for (var sourceIndex in sources) {
        var source = sources[sourceIndex];

        this.createRoadFromAtoB(room, firstSpawn.pos, source.pos);
      }

      room.memory.areSourcesRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createControllerRoads(room: Room) {
    if (!room.memory.areControllerRoadsSetup && room.controller && room.controller.level >= 2) {
      var firstSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }
      var controller = room.controller;
      if (controller) {
        this.createRoadFromAtoB(room, firstSpawn.pos, controller.pos);
      }

      room.memory.areControllerRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createMineralRoads(room: Room) {
    if (!room.memory.areMineralRoadsSetup && room.controller && room.controller.level >= 6) {
      var firstSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      var mineral = room.find(FIND_MINERALS)[0];
      if (mineral) {
        this.createRoadFromAtoB(room, firstSpawn.pos, mineral.pos);
      }

      room.memory.areMineralRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createRoadFromAtoB(room: Room, pos1: Vector, pos2: Vector) {
    this.iterateFromAtoB(room, pos1, pos2, (pos, index, isLast) => {
      if (!isLast) {
        // TODO: check that there is no terrain or other objet at this pos
        this.createRoadAtPositionIfPossible(room, pos);
      }
    });
  }

  createRoadAtPositionIfPossible(room: Room, pos: Vector) {
    const structureHere = room
      .lookAt(pos.x, pos.y)
      .find(i => i.type === LOOK_STRUCTURES || (i.type === LOOK_TERRAIN && i.terrain === "wall"));

    if (!structureHere) {
      return room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
    } else {
      return -1;
    }
  }

  iterateFromAtoB(
    room: Room,
    pos1: Vector,
    pos2: Vector,
    callback: (pos: Vector, index: number, isLast: boolean) => void
  ) {
    var positions = room.findPath(
      new RoomPosition(pos1.x, pos1.y, room.name),
      new RoomPosition(pos2.x, pos2.y, room.name)
    );
    if (positions.length) {
      for (let stepIndex in positions) {
        let pos = positions[stepIndex];
        callback(pos, Number(stepIndex), Number(stepIndex) === positions.length - 1);
      }
    }
  }

  iterateInDirection(pos: Vector, direction: Vector, count: number, callback: (pos: Vector) => void) {
    for (let i = 1; i <= count; i++) {
      var x = pos.x + direction.x * i;
      var y = pos.y + direction.y * i;

      callback({ x, y });
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

  createTowers(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }
    const spot = findEmptySpotCloseTo(spawn.pos, room);
    if (spot) {
      return room.createConstructionSite(spot.x, spot.y, STRUCTURE_TOWER);
    } else {
      return -1;
    }
  }

  createStorage(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }
    const spot = findEmptySpotCloseTo(spawn.pos, room);
    if (spot) {
      return room.createConstructionSite(spot.x, spot.y, STRUCTURE_STORAGE);
    } else {
      return -1;
    }
  }

  createInitialSpawn(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const target = Game.flags["claimer_target"];
    if (!spawn && target && target.pos.roomName === room.name) {
      return room.createConstructionSite(target.pos.x, target.pos.y, STRUCTURE_SPAWN);
    } else {
      return -1;
    }
  }

  createTerminal(room: Room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }
    const spot = findEmptySpotCloseTo(spawn.pos, room);
    if (spot) {
      return room.createConstructionSite(spot.x, spot.y, STRUCTURE_TERMINAL);
    } else {
      return -1;
    }
  }

  createContainers(room: Room) {
    let sources = room.find(FIND_SOURCES);
    for (let sourceIndex in sources) {
      let source = sources[sourceIndex];

      let closeContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0];
      if (!closeContainer) {
        let closeRoad = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: i => i.structureType === "road" })[0];
        if (closeRoad) {
          return room.createConstructionSite(closeRoad.pos.x, closeRoad.pos.y, STRUCTURE_CONTAINER);
        }
      }
    }
    if (room.controller && room.controller.level >= 6) {
      let mineral = room.find(FIND_MINERALS)[0];

      let closeContainer = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0];
      if (!closeContainer) {
        let closeRoad = mineral.pos.findInRange(FIND_STRUCTURES, 1, { filter: i => i.structureType === "road" })[0];
        if (closeRoad) {
          return room.createConstructionSite(closeRoad.pos.x, closeRoad.pos.y, STRUCTURE_CONTAINER);
        }
      }
    }

    return -1;
  }
}

export const architect = new Architect();
