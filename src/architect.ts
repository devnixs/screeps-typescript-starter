import { findEmptySpotCloseTo } from "utils/finder";
import { profiler } from "./utils/profiler";

const isSimulation = "sim" in Game.rooms;
const delay = isSimulation ? 1 : 100;

export class Architect {
  emptySpot: Vector | undefined;
  constructor(private room: Room) {}

  static runForAllRooms() {
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
      var architect = new Architect(room);
      architect.run();
    });
  }

  run() {
    this.room.memory.rnd = this.room.memory.rnd || Math.floor(Math.random() * 10) + 5;

    if (Game.time % (delay * this.room.memory.rnd) === 0) {
      console.log("Redoing constructions for room", this.room.name);
      // sometimes, redo constructions. They might have broken.
      this.room.memory.constructionsAreSetupAtLevel = 0;
    }

    if (this.room.controller && this.room.memory.constructionsAreSetupAtLevel === this.room.controller.level) {
      return;
    }

    var constructionSites = this.room.find(FIND_CONSTRUCTION_SITES);

    var creations = [
      this.createInitialSpawn,
      this.createSourcesRoads,
      this.createControllerRoads,
      this.createColonyRoads,
      this.createCloseToSpawn(STRUCTURE_EXTENSION),
      this.createContainers,
      this.createMineralRoads,
      this.createExtractor,
      this.createCloseToSpawn(STRUCTURE_NUKER),
      this.createCloseToSpawn(STRUCTURE_TOWER),
      this.createCloseToSpawn(STRUCTURE_STORAGE),
      this.createCloseTo(this.room.storage, STRUCTURE_TERMINAL),
      this.createCloseToSpawn(STRUCTURE_SPAWN),
      this.createCloseToSpawn(STRUCTURE_OBSERVER),
      this.createCloseToSpawn(STRUCTURE_POWER_SPAWN),
      this.createLinks
    ];

    if (constructionSites.length === 0) {
      let somethingIsBeingBuilt = false;
      for (let i = 0; i < creations.length; i++) {
        let result = creations[i].bind(this)();
        if (result === OK) {
          somethingIsBeingBuilt = true;
          break;
        }
      }

      if (!somethingIsBeingBuilt) {
        this.room.memory.constructionsAreSetupAtLevel = this.room.controller && this.room.controller.level;
      }
    }
  }

  createExtractor() {
    var hasExtractor = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === "extractor" }).length > 0;
    var hasLevel = this.room.controller && this.room.controller.level >= 6;

    if (hasLevel && !hasExtractor) {
      var mineral = this.room.find(FIND_MINERALS)[0];
      if (mineral) {
        return this.room.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
      }
    }

    return -1;
  }

  createColonyRoads() {
    if (!this.room.memory.areColonyRoadsSetup && this.room.controller && this.room.controller.level >= 2) {
      var firstSpawn = this.room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++) {
          if (x !== 0 || y !== 0) {
            this.iterateInDirection(firstSpawn.pos, { x, y }, 5, pos => {
              this.createRoadAtPositionIfPossible(pos);
            });
          }
        }

      this.room.memory.areColonyRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createSourcesRoads() {
    if (!this.room.memory.areSourcesRoadsSetup) {
      var firstSpawn = this.room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      var sources = this.room.find(FIND_SOURCES);
      for (var sourceIndex in sources) {
        var source = sources[sourceIndex];

        this.createRoadFromAtoB(firstSpawn.pos, source.pos);
      }

      this.room.memory.areSourcesRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createControllerRoads() {
    if (!this.room.memory.areControllerRoadsSetup && this.room.controller && this.room.controller.level >= 2) {
      var firstSpawn = this.room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }
      var controller = this.room.controller;
      if (controller) {
        this.createRoadFromAtoB(firstSpawn.pos, controller.pos);
      }

      this.room.memory.areControllerRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createMineralRoads() {
    if (!this.room.memory.areMineralRoadsSetup && this.room.controller && this.room.controller.level >= 6) {
      var firstSpawn = this.room.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "spawn"
      })[0] as StructureSpawn | null;

      if (!firstSpawn) {
        return;
      }

      var mineral = this.room.find(FIND_MINERALS)[0];
      if (mineral) {
        this.createRoadFromAtoB(firstSpawn.pos, mineral.pos);
      }

      this.room.memory.areMineralRoadsSetup = true;
      return OK;
    }
    return -1;
  }

  createRoadFromAtoB(pos1: Vector, pos2: Vector) {
    this.iterateFromAtoB(pos1, pos2, (pos, index, isLast) => {
      if (!isLast) {
        // TODO: check that there is no terrain or other objet at this pos
        this.createRoadAtPositionIfPossible(pos);
      }
    });
  }

  createRoadAtPositionIfPossible(pos: Vector) {
    const structureHere = this.room
      .lookAt(pos.x, pos.y)
      .find(i => i.type === LOOK_STRUCTURES || (i.type === LOOK_TERRAIN && i.terrain === "wall"));

    if (!structureHere) {
      return this.room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
    } else {
      return -1;
    }
  }

  iterateFromAtoB(pos1: Vector, pos2: Vector, callback: (pos: Vector, index: number, isLast: boolean) => void) {
    var positions = this.room.findPath(
      new RoomPosition(pos1.x, pos1.y, this.room.name),
      new RoomPosition(pos2.x, pos2.y, this.room.name),
      { ignoreCreeps: true }
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

  createInitialSpawn() {
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    const target = Game.flags["claimer_target"];
    if (!spawn && target && target.pos.roomName === this.room.name) {
      const result = this.room.createConstructionSite(target.pos.x, target.pos.y, STRUCTURE_SPAWN);
      if (result === OK) {
        target.remove();
      }
      return result;
    } else {
      return -1;
    }
  }

  getEmptySpotCloseToSpawn() {
    if (this.emptySpot) {
      return this.emptySpot;
    } else {
      const spawn = this.room.find(FIND_MY_SPAWNS)[0];
      if (!spawn) {
        return null;
      }

      var emptySpot = findEmptySpotCloseTo(spawn.pos, this.room);
      if (emptySpot) {
        this.emptySpot = emptySpot;
        return emptySpot;
      } else {
        return null;
      }
    }
  }

  createCloseToSpawn(structure: BuildableStructureConstant) {
    return () => {
      const spot = this.getEmptySpotCloseToSpawn();
      if (spot) {
        return this.room.createConstructionSite(spot.x, spot.y, structure);
      } else {
        return -1;
      }
    };
  }

  createCloseTo(existingStructure: AnyStructure | undefined, structure: BuildableStructureConstant) {
    return () => {
      if (!existingStructure) {
        return undefined;
      }
      const spot = findEmptySpotCloseTo(existingStructure.pos, existingStructure.room);
      if (spot) {
        return this.room.createConstructionSite(spot.x, spot.y, structure);
      } else {
        return -1;
      }
    };
  }

  createLinks() {
    if (!this.room.memory.areControllerLinksSetup && this.room.controller && this.room.controller.level >= 5) {
      const storage = this.room.storage;
      if (!storage) {
        return -1;
      }
      const spot1 = findEmptySpotCloseTo(storage.pos, this.room);
      const spot2 = findEmptySpotCloseTo(this.room.controller.pos, this.room);

      if (spot1 && spot2) {
        this.room.createConstructionSite(spot1.x, spot1.y, STRUCTURE_LINK);
        this.room.createConstructionSite(spot2.x, spot2.y, STRUCTURE_LINK);
        this.room.memory.areControllerLinksSetup = true;
        return OK;
      } else {
        return -1;
      }
    }

    return -1;
  }

  createContainers() {
    let sources = this.room.find(FIND_SOURCES);
    for (let sourceIndex in sources) {
      let source = sources[sourceIndex];

      let closeContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0];
      if (!closeContainer) {
        let closeRoad = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: i => i.structureType === "road" })[0];
        if (closeRoad) {
          return this.room.createConstructionSite(closeRoad.pos.x, closeRoad.pos.y, STRUCTURE_CONTAINER);
        }
      }
    }
    if (this.room.controller && this.room.controller.level >= 6) {
      let mineral = this.room.find(FIND_MINERALS)[0];

      let closeContainer = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0];
      if (!closeContainer) {
        let closeRoad = mineral.pos.findInRange(FIND_STRUCTURES, 1, { filter: i => i.structureType === "road" })[0];
        if (closeRoad) {
          return this.room.createConstructionSite(closeRoad.pos.x, closeRoad.pos.y, STRUCTURE_CONTAINER);
        }
      }
    }

    return -1;
  }
}

profiler.registerClass(Architect, "Architect");
