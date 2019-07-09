import { findEmptySpotCloseTo } from "utils/finder";
import { profiler } from "../utils/profiler";
import "../utils/mincut-walls";
import { mincutHelper } from "../utils/mincut-walls";

const isSimulation = "sim" in Game.rooms;
const delay = isSimulation ? 1 : 20;

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

  cleanupNonVisibleConstructionSites() {
    if (Game.time % 1000 > 0) {
      return;
    }
    Object.keys(Game.constructionSites)
      .map(i => Game.constructionSites[i])
      .filter(i => !i.room)
      .forEach(ConstructionSite => ConstructionSite.remove());
  }

  run() {
    this.cleanupNonVisibleConstructionSites();

    if (Object.keys(Game.constructionSites).length > MAX_CONSTRUCTION_SITES * 0.9) {
      return;
    }
    this.room.memory.rnd = this.room.memory.rnd || Math.floor(Math.random() * 10) + 5;

    if (Game.time % (delay * this.room.memory.rnd * 10) === 0) {
      console.log("Redoing constructions for room", this.room.name);
      // sometimes, redo constructions. They might have broke.
      this.room.memory.constructionsAreSetupAtLevel = 0;
    }

    if (this.room.memory.isUnderSiege) {
      return;
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
      this.createRoadsAroundStorage,
      this.createStorage,
      this.createTerminal,
      this.createCloseToSpawn(STRUCTURE_EXTENSION),
      this.createContainers,
      this.createMineralRoads,
      this.createExtractor,
      this.setupSourcesLinks,
      this.addRampartToCriticalStructures,
      this.createCloseToSpawn(STRUCTURE_NUKER),
      this.createCloseToSpawn(STRUCTURE_TOWER),
      this.createCloseToSpawn(STRUCTURE_SPAWN),
      this.createCloseToSpawn(STRUCTURE_OBSERVER),
      this.setupSquareRoads,
      this.buildWalls,
      this.createLinks
      //  this.createCloseToSpawn(STRUCTURE_POWER_SPAWN),
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

    this.findRestSpot();
  }

  findRestSpot() {
    if (Game.time % 1000 > 0 && this.room.memory.restSpot) {
      return;
    }
    const spawn = this.room.spawns[0];
    const restSpot = findEmptySpotCloseTo(spawn.pos, this.room);
    if (restSpot) {
      this.room.memory.restSpot = restSpot;
    }
  }

  buildWalls() {
    if (!this.room.memory.walls && this.room.controller && this.room.controller.level <= 3) {
      // We don't want to do this for existing room that already have wall
      const defenseLocations = [];
      const homeSpawn = this.room.spawns[0];
      defenseLocations.push({
        x1: homeSpawn.pos.x - 8,
        y1: homeSpawn.pos.y - 8,
        x2: homeSpawn.pos.x + 8,
        y2: homeSpawn.pos.y + 8
      });
      const walls = mincutHelper.GetCutTiles(this.room.name, defenseLocations);
      this.room.memory.walls = _.flatten(walls.map(i => [i.x, i.y]));
    }

    if (this.room.memory.walls && this.room.controller && this.room.controller.level >= 3) {
      const walls = _.chunk(this.room.memory.walls, 2);
      for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        const rampartExists = this.room
          .lookForAt(LOOK_STRUCTURES, new RoomPosition(wall[0], wall[1], this.room.name))
          .find(i => i.structureType === "rampart");
        if (!rampartExists) {
          return this.room.createConstructionSite(wall[0], wall[1], STRUCTURE_RAMPART);
        }
      }
    }

    return -1;
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
      const targetStructureFlag = Game.flags["target_" + STRUCTURE_STORAGE];
      if (targetStructureFlag && targetStructureFlag.room && targetStructureFlag.room.name === this.room.name) {
        const creationResult = this.room.createConstructionSite(
          targetStructureFlag.pos.x,
          targetStructureFlag.pos.y,
          structure
        );

        if (creationResult === OK) {
          targetStructureFlag.remove();
        }

        return creationResult;
      }

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
    if (this.room.controller && this.room.controller.level >= 5) {
      const storage = this.room.storage;
      if (!storage) {
        return -1;
      }

      const existingStorageLink = storage.pos.findInRange(FIND_MY_STRUCTURES, 4, {
        filter: i => i.structureType === "link"
      });
      if (!existingStorageLink) {
        const spot1 = findEmptySpotCloseTo(storage.pos, this.room);
        if (spot1) {
          return this.room.createConstructionSite(spot1.x, spot1.y, STRUCTURE_LINK);
        }
      }

      const isControllerFar = this.room.controller.pos.getRangeTo(storage) > 6;

      if (isControllerFar) {
        const existingControllerLink = this.room.controller.pos.findInRange(FIND_MY_STRUCTURES, 4, {
          filter: i => i.structureType === "link"
        });
        if (!existingControllerLink) {
          const spot1 = findEmptySpotCloseTo(storage.pos, this.room);
          if (spot1) {
            return this.room.createConstructionSite(spot1.x, spot1.y, STRUCTURE_LINK);
          }
        }
      }
    }

    return -1;
  }

  addRampartToCriticalStructures() {
    let criticalStructures: AnyOwnedStructure[] = this.room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType === "spawn" ||
        s.structureType === "tower" ||
        s.structureType === "storage" ||
        s.structureType === "terminal"
    });

    for (let index in criticalStructures) {
      const structure = criticalStructures[index];

      const rampartExists = this.room.lookForAt(LOOK_STRUCTURES, structure).find(i => i.structureType === "rampart");
      if (!rampartExists) {
        return this.room.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
      }
    }
    return -1;
  }

  createRoadsAroundStorage() {
    if (!this.room.storage) {
      return;
    }

    const positions = [
      new RoomPosition(this.room.storage.pos.x - 1, this.room.storage.pos.y, this.room.name),
      new RoomPosition(this.room.storage.pos.x + 1, this.room.storage.pos.y, this.room.name),
      new RoomPosition(this.room.storage.pos.x, this.room.storage.pos.y - 1, this.room.name),
      new RoomPosition(this.room.storage.pos.x, this.room.storage.pos.y + 1, this.room.name)
    ];

    for (let index = 0; index < positions.length; index++) {
      const pos = positions[index];
      const what = this.room.lookForAt(LOOK_STRUCTURES, pos);
      const nonRoad = what.find(i => i.structureType !== "road");
      const road = what.find(i => i.structureType === "road");

      if (nonRoad) {
        nonRoad.destroy();
      }

      if (!road) {
        return this.room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
      }
    }
    return -1;
  }

  createStorage() {
    if (!this.room.controller || this.room.controller.level < 4 || this.room.storage) {
      return -1;
    }

    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return -1;
    }

    let position: RoomPosition | undefined;

    if (
      this.room.memory.storagePlannedLocation &&
      this.room.memory.storagePlannedLocation.setupTime > Game.time - 1000
    ) {
      position = new RoomPosition(
        this.room.memory.storagePlannedLocation.x,
        this.room.memory.storagePlannedLocation.y,
        this.room.name
      );
      delete this.room.memory.storagePlannedLocation;
    } else {
      position = PathFinder.search(spawn.pos, this.room.controller.pos).path.find(i =>
        this.room.controller ? i.getRangeTo(spawn.pos) === 6 || i.getRangeTo(this.room.controller) <= 4 : false
      );
      if (!position) {
        return -1;
      }
      const destroyedSomethingAroundPosition = this.destroyAroundPosition(position);
      if (destroyedSomethingAroundPosition === OK) {
        // wait for next tick
        this.room.memory.storagePlannedLocation = { x: position.x, y: position.y, setupTime: Game.time };
        return OK;
      }
    }

    let constructionResult = this.room.createConstructionSite(position.x, position.y, STRUCTURE_STORAGE);
    if (constructionResult === OK) {
      this.buildRoadsAroundPosition(position);
      return OK;
    } else {
      const emptySpot = findEmptySpotCloseTo(position, this.room);
      if (emptySpot) {
        constructionResult = this.room.createConstructionSite(position.x, position.y, STRUCTURE_STORAGE);
        if (constructionResult === OK) {
          this.buildRoadsAroundPosition(position);
          return OK;
        } else {
          return -1;
        }
      } else {
        return -1;
      }
    }
  }

  destroyAroundPosition(pos: RoomPosition) {
    let destroyedOne = false;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const targetX = pos.x + i;
        const targetY = pos.y + i;
        if (Math.abs(i) + Math.abs(j) <= 1 && targetX >= 1 && targetX < 49 && targetY >= 1 && targetY < 49) {
          const target = new RoomPosition(targetX, targetY, pos.roomName);
          const objsAtThisLocation = this.room.lookForAt(LOOK_STRUCTURES, target);
          objsAtThisLocation.forEach(obj => {
            console.log("Destroying ", obj.structureType, "at", obj.pos.x, obj.pos.y, obj.pos.roomName);
            destroyedOne = destroyedOne || obj.destroy() === OK;
          });
        }
      }
    }
    return destroyedOne ? OK : -1;
  }

  buildRoadsAroundPosition(pos: RoomPosition) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const targetX = pos.x + i;
        const targetY = pos.y + i;
        if (Math.abs(i) + Math.abs(j) === 1 && targetX >= 1 && targetX < 49 && targetY >= 1 && targetY < 49) {
          this.room.createConstructionSite(pos.x + i, pos.y + j, STRUCTURE_ROAD);
        }
      }
    }
  }

  createTerminal() {
    if (this.room.terminal || !this.room.storage || (this.room.controller && this.room.controller.level < 6)) {
      return -1;
    }
    console.log("Creating Terminal");

    if (
      this.room.memory.terminalPlannedLocation &&
      this.room.memory.terminalPlannedLocation.setupTime > Game.time - 1000
    ) {
      return this.room.createConstructionSite(
        this.room.memory.terminalPlannedLocation.x,
        this.room.memory.terminalPlannedLocation.y,
        STRUCTURE_TERMINAL
      );
    } else {
      const closestExtension = this.room.storage.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "extension"
      });
      console.log("Closest extension", JSON.stringify(closestExtension));

      if (closestExtension) {
        const result = closestExtension.destroy();
        if (result === OK) {
          this.room.memory.terminalPlannedLocation = {
            x: closestExtension.pos.x,
            y: closestExtension.pos.y,
            setupTime: Game.time
          };
          return OK;
        } else {
          return -1;
        }
      } else {
        return -1;
      }
    }
  }

  setupSourcesLinks() {
    const sources = this.room.find(FIND_SOURCES);
    if (!this.room.storage) {
      return -1;
    }

    for (let index in sources) {
      const source = sources[index];

      const existingLink = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
        filter: i => i.structureType === "link"
      })[0];
      const closeContainer: StructureContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0] as any;

      if (source.pos.getRangeTo(this.room.storage) > 18 && !existingLink && closeContainer) {
        // create link

        const location = findEmptySpotCloseTo(closeContainer.pos, this.room);
        const isNear = location && new RoomPosition(location.x, location.y, this.room.name).isNearTo(closeContainer);
        if (location && !isNear) {
          console.log("Found link location, but it is not near :(", location.x, location.y, this.room.name);
        }
        if (location && isNear) {
          console.log("Creating", location.x, location.y);
          return this.room.createConstructionSite(location.x, location.y, STRUCTURE_LINK);
        }
      }
    }
    return -1;
  }

  setupSquareRoads() {
    if (this.room.memory.squareRoadsAreSetup || (this.room.controller && this.room.controller.level < 6)) {
      return -1;
    }
    const v = [-6, +6];
    const w = _.range(-6, 7);
    const homeSpawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (!homeSpawn) {
      return -1;
    }

    let hasReachedLimit = false;

    v.forEach(i => {
      w.forEach(j => {
        const result1 = this.buildRoadIfSpaceAvailable(homeSpawn.pos.x + i, homeSpawn.pos.y + j);
        const result2 = this.buildRoadIfSpaceAvailable(homeSpawn.pos.x + j, homeSpawn.pos.y + i);
        hasReachedLimit = hasReachedLimit || result1 === ERR_FULL || result2 === ERR_FULL;
      });
    });

    if (!hasReachedLimit) {
      this.room.memory.squareRoadsAreSetup = true;
    }

    return OK;
  }

  buildRoadIfSpaceAvailable(x: number, y: number) {
    const structureHere = this.room
      .lookAt(x, y)
      .find(i => i.type === LOOK_STRUCTURES || (i.type === LOOK_TERRAIN && i.terrain === "wall"));
    if (structureHere) {
      return -1;
    } else {
      return this.room.createConstructionSite(x, y, STRUCTURE_ROAD);
    }
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
