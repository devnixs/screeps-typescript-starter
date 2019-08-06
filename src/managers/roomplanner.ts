import { buildRangeFromRoomLimit } from "constants/misc";
import { findEmptySpotCloseTo } from "utils/finder";
import { mincutHelper } from "utils/mincut-walls";
import { getMyRooms, hasRoomBeenAttacked } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { setTimeout } from "utils/set-timeout";

const structureColors: any = {
  [STRUCTURE_EXTENSION]: "yellow",
  [STRUCTURE_SPAWN]: "blue",
  [STRUCTURE_NUKER]: "red",
  [STRUCTURE_OBSERVER]: "red",
  [STRUCTURE_TOWER]: "black",
  [STRUCTURE_TERMINAL]: "white",
  [STRUCTURE_STORAGE]: "pink",
  [STRUCTURE_LINK]: "orange",
  [STRUCTURE_CONTAINER]: "red",
  [STRUCTURE_OBSERVER]: "black",
  [STRUCTURE_POWER_SPAWN]: "black",
  [STRUCTURE_LAB]: "purple",
  [STRUCTURE_NUKER]: "black",
  [STRUCTURE_RAMPART]: "cyan",
  [STRUCTURE_ROAD]: "lawngreen",
  [STRUCTURE_EXTRACTOR]: "purple"
};

export class RoomPlanner {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new RoomPlanner(room).run();
    });
  }

  run() {
    this.showVisuals();
    this.findRestSpot();

    if (Game.time % 17 > 0) {
      return;
    }

    const ctrl = this.room.controller as StructureController;
    if (ctrl.level <= 2) {
      this.room.memory.useNewRoomPlanner = true;
    }

    if (!this.room.memory.useNewRoomPlanner) {
      return;
    }

    const flag = this.room.find(FIND_FLAGS).find(i => i.name === "claimer_target");
    if (flag && !this.room.memory.roomPlanner) {
      this.initWithFlag(flag);
    }
    if (this.room.spawns[0] && !this.room.memory.roomPlanner) {
      this.initWithSpawn(this.room.spawns[0]);
    }

    if (Object.keys(Game.constructionSites).length > MAX_CONSTRUCTION_SITES * 0.9) {
      return;
    }

    if (this.room.find(FIND_CONSTRUCTION_SITES).length) {
      return;
    }

    for (let i = 0; i < this.room.memory.roomPlanner.structures.length; i++) {
      const structure = this.room.memory.roomPlanner.structures[i];
      if (structure.l && structure.l > ctrl.level) {
        continue;
      }
      if (structure.type === "rampart") {
        // let's not build walls before rcl 4 or safe mode activated

        if (this.room.controller && (this.room.controller.level < 6 && !hasRoomBeenAttacked(this.room))) {
          continue;
        }
      }

      const result = this.room.createConstructionSite(structure.x, structure.y, structure.type);
      if (result === OK) {
        break;
      } else if (result === ERR_INVALID_TARGET) {
        // check if there's a road underneath blocking
        if (structure.type !== "road") {
          const buildingsUnderneath = this.room.lookForAt(
            "structure",
            new RoomPosition(structure.x, structure.y, this.room.name)
          );

          const roadUnderneath = buildingsUnderneath.find(i => i.structureType === "road");
          if (roadUnderneath && buildingsUnderneath.length === 1) {
            roadUnderneath.destroy();
            setTimeout(() => {
              Game.rooms[this.room.name].createConstructionSite(structure.x, structure.y, structure.type);
            }, 1);
          }

          const containerUnderneath = buildingsUnderneath.find(i => i.structureType === "container");
          if (structure.type === "link" && containerUnderneath) {
            containerUnderneath.destroy();
            setTimeout(() => {
              Game.rooms[this.room.name].createConstructionSite(structure.x, structure.y, structure.type);
            }, 1);
          }
        }
      }
    }

    this.addRampartToCriticalStructures();
  }

  showVisuals() {
    const showVisuals = "show_visuals" in Game.flags;
    if (this.room.memory.roomPlanner && showVisuals) {
      this.room.memory.roomPlanner.structures
        // .filter(i => i.type !== "road")
        .forEach((structure, index) => {
          this.room.visual.circle(structure.x, structure.y, {
            radius: 0.2,
            opacity: 0.8,
            fill: "transparent",
            lineStyle: "solid",
            stroke: structureColors[structure.type] || "black",
            strokeWidth: 0.1
          });
          /*           this.room.visual.text(index.toString(), structure.x, structure.y, {
            opacity: 0.4,
            color: "white",
            font: 0.3
          }); */
        });
    }
  }

  addRampartToCriticalStructures() {
    // needs level 4 at lease
    if (this.room.controller && this.room.controller.level < 4) {
      return;
    }

    let criticalStructures: AnyOwnedStructure[] = this.room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType === "spawn" ||
        s.structureType === "tower" ||
        s.structureType === "storage" ||
        s.structureType === "terminal" ||
        s.structureType === "nuker"
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

  findRestSpot() {
    if (Game.time % 1000 > 0 && this.room.memory.restSpot) {
      return;
    }
    const spawn = this.room.spawns[0];
    if (!spawn) {
      return;
    }
    const restSpot = findEmptySpotCloseTo(
      spawn.pos,
      this.room,
      false,
      pos => pos.findInRange(FIND_STRUCTURES, 3).length === 0
    );
    if (restSpot) {
      this.room.memory.restSpot = restSpot;
    }
  }

  initWithFlag(flag: Flag) {
    console.log("Initializing room planner with flag");
    const planner = RoomPlanner.initPlanner(flag.pos.x, flag.pos.y, this.room);
    this.room.memory.roomPlanner = planner;
    flag.remove();
  }

  initWithSpawn(spawn: StructureSpawn) {
    console.log("Initializing room planner with spawn");
    const planner = RoomPlanner.initPlanner(spawn.pos.x - 1, spawn.pos.y, this.room);
    this.room.memory.roomPlanner = planner;
  }

  static initPlanner(x: number, y: number, room: Room) {
    const ctrl = room.controller as StructureController;
    const planner: RoomPlannerData = {
      centerX: x,
      centerY: y,
      spIndex: 0,
      structures: []
    };

    const sectors = RoomPlanner.getPossibleSectors({ x, y }, room);

    const spawn = room.spawns[0];
    if (!spawn) {
      RoomPlanner.reserveSpot(sectors[0].x, sectors[0].y, STRUCTURE_SPAWN, planner);
      planner.spIndex++;
    } else {
      RoomPlanner.reserveSpot(spawn.pos.x, spawn.pos.y, STRUCTURE_SPAWN, planner);
    }

    // find the closest sector to the ctrl to build the storage between the first 14 sectors
    const storageSector = _(sectors)
      .take(14)
      .filter(sector => {
        const hasStructure = this.getPositionsFromSector(sector).find(sectorPos => {
          return !!planner.structures.find(structure => structure.x === sectorPos.x && structure.y === sectorPos.y);
        });
        return !hasStructure;
      })
      .sortBy(s => new RoomPosition(s.x, s.y, room.name).getRangeTo(ctrl))
      .first();

    RoomPlanner.reserveSpot(storageSector.x, storageSector.y, STRUCTURE_STORAGE, planner, 4);
    RoomPlanner.reserveSpot(storageSector.x - 1, storageSector.y, STRUCTURE_LINK, planner, 5);
    RoomPlanner.reserveSpot(storageSector.x + 1, storageSector.y, STRUCTURE_TERMINAL, planner, 6);
    RoomPlanner.reserveSpot(storageSector.x, storageSector.y + 1, STRUCTURE_ROAD, planner, 4);
    RoomPlanner.reserveSpot(storageSector.x, storageSector.y - 1, STRUCTURE_ROAD, planner, 4);

    RoomPlanner.buildRoadsAroundStructures(planner, room, sectors, 2);

    for (let level = 2; level <= 8; level++) {
      const buildable = RoomPlanner.getNewlyAvailableStructuresAtLevel(level);

      buildable.forEach(build => {
        for (let counter = 0; counter < build.count; counter++) {
          const finalPos = RoomPlanner.getNextAvailableSpot(planner, sectors);
          RoomPlanner.reserveSpot(finalPos.x, finalPos.y, build.structure, planner);
          planner.spIndex = finalPos.finalIndex;
        }
      });

      RoomPlanner.buildRoadsAroundStructures(planner, room, sectors, level);
    }

    RoomPlanner.buildRoadsToSources(planner, room, sectors);

    RoomPlanner.buildContainersAroundSources(planner, room);

    RoomPlanner.buildControllerLink(planner, room);
    RoomPlanner.buildRoadsToMineral(planner, room, sectors);

    RoomPlanner.buildRoadsAroundStructures(planner, room, sectors);
    RoomPlanner.buildExtractor(planner, room);
    RoomPlanner.reserveLabs(planner, sectors);
    RoomPlanner.buildRoadsAroundStructures(planner, room, sectors, 6);
    RoomPlanner.buildWalls(planner, room, sectors);

    RoomPlanner.buildRoadsAroundStructures(planner, room, sectors, 6);

    for (let i = 0; i < sectors.length / 5; i++) {
      const coords = RoomPlanner.getPositionFromTotalIndex(i, sectors);
      room.visual.text(i.toString(), coords.x, coords.y, {
        opacity: 1,
        color: "green"
      });
    }

    return planner;
  }

  static buildWalls(planner: RoomPlannerData, room: Room, sectors: SimplePos[]) {
    const defenseLocations: { x1: number; y1: number; x2: number; y2: number }[] = [];
    _.take(sectors, planner.spIndex / 5).forEach(sector => {
      defenseLocations.push({
        x1: sector.x - 4,
        y1: sector.y - 4,
        x2: sector.x + 4,
        y2: sector.y + 4
      });
    });

    const walls = mincutHelper.GetCutTiles(room.name, defenseLocations);
    if (walls) {
      walls.forEach(wall => {
        RoomPlanner.reserveSpot(wall.x, wall.y, STRUCTURE_RAMPART, planner, 3);
      });
    }
  }

  static buildControllerLink(planner: RoomPlannerData, room: Room) {
    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;
    var ctrl = room.controller as StructureController;
    if (ctrl.pos.getRangeTo(new RoomPosition(storagePos.x, storagePos.y, room.name)) > 3) {
      const linkLocation = PathFinder.search(ctrl.pos, new RoomPosition(storagePos.x, storagePos.y, room.name)).path[1];
      if (linkLocation) {
        const positions = [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1]];
        for (let i in positions) {
          const dir = positions[i];
          const pos = { x: linkLocation.x + dir[0], y: linkLocation.y + dir[1] };
          const structureExistsHere = planner.structures.find(i => i.x === pos.x && i.y == pos.y);
          if (!structureExistsHere || structureExistsHere.type === "road") {
            RoomPlanner.reserveSpot(pos.x, pos.y, STRUCTURE_CONTAINER, planner, 2);
            RoomPlanner.reserveSpot(pos.x, pos.y, STRUCTURE_LINK, planner, 5);
            return;
          }
        }
      }
    }
  }

  static buildRoadsAroundStructures(
    planner: RoomPlannerData,
    room: Room,
    sectors: SimplePos[],
    level: number | null = null,
    debug: boolean = false
  ) {
    const terrain = Game.map.getRoomTerrain(room.name);
    const buildings = planner.structures.filter(
      i => i.type !== STRUCTURE_ROAD && i.type !== STRUCTURE_WALL && i.type !== STRUCTURE_RAMPART
    );
    for (let index = 0; index < buildings.length; index++) {
      const building = buildings[index];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (Math.abs(i) + Math.abs(j) > 1) {
            continue;
          }
          const position = { x: i + building.x, y: j + building.y };
          const spotType = RoomPlanner.isRoadOrSector(position, planner, sectors);
          const structureExistsHere = planner.structures.find(i => i.x === position.x && i.y === position.y);

          if (
            spotType === "road" &&
            terrain.get(position.x, position.y) !== TERRAIN_MASK_WALL &&
            !structureExistsHere
          ) {
            /*             if (position.x === 35 && position.y === 15) {
              console.log("building = ", JSON.stringify(building));
              console.log("level = ", level);
              console.log("position = ", position.x, position.y);
              console.log("spotType = ", spotType);
              console.log("structureExistsHere = ", JSON.stringify(structureExistsHere));
            }
 */
            RoomPlanner.reserveSpot(position.x, position.y, STRUCTURE_ROAD, planner, level);
          }
        }
      }
    }
  }

  static buildExtractor(planner: RoomPlannerData, room: Room) {
    const mineral = room.find(FIND_MINERALS)[0];
    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;
    if (mineral && storagePos) {
      RoomPlanner.reserveSpot(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR, planner, 6);
      const containerLocation = PathFinder.search(mineral.pos, new RoomPosition(storagePos.x, storagePos.y, room.name))
        .path[0];
      RoomPlanner.reserveSpot(containerLocation.x, containerLocation.y, STRUCTURE_CONTAINER, planner, 6);
    }
  }

  static buildContainersAroundSources(planner: RoomPlannerData, room: Room) {
    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;
    room.find(FIND_SOURCES).forEach(source => {
      const containerLocation = PathFinder.search(source.pos, new RoomPosition(storagePos.x, storagePos.y, room.name))
        .path[0];
      if (containerLocation) {
        RoomPlanner.reserveSpot(containerLocation.x, containerLocation.y, STRUCTURE_CONTAINER, planner);
        if (source.pos.getRangeTo(new RoomPosition(storagePos.x, storagePos.y, room.name)) > 14) {
          const linkLocation = findEmptySpotCloseTo(containerLocation, room, true);
          if (linkLocation) {
            RoomPlanner.reserveSpot(linkLocation.x, linkLocation.y, STRUCTURE_LINK, planner);
          }
        }
      }
    });
  }

  static buildRoadsToMineral(planner: RoomPlannerData, room: Room, sectors: SimplePos[]) {
    const costMatrix = new PathFinder.CostMatrix();

    sectors.forEach(sector => {
      costMatrix.set(sector.x, sector.y, 0xff);
      costMatrix.set(sector.x + 1, sector.y, 0xff);
      costMatrix.set(sector.x - 1, sector.y, 0xff);
      costMatrix.set(sector.x, sector.y + 1, 0xff);
      costMatrix.set(sector.x, sector.y - 1, 0xff);
    });

    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;

    const mineral = room.find(FIND_MINERALS)[0];
    if (mineral) {
      RoomPlanner.buildRoad(mineral.pos, storagePos, room, costMatrix, planner, 6);
    }
  }
  static buildRoadsToSources(planner: RoomPlannerData, room: Room, sectors: SimplePos[]) {
    const costMatrix = new PathFinder.CostMatrix();

    sectors.forEach(sector => {
      costMatrix.set(sector.x, sector.y, 0xff);
      costMatrix.set(sector.x + 1, sector.y, 0xff);
      costMatrix.set(sector.x - 1, sector.y, 0xff);
      costMatrix.set(sector.x, sector.y + 1, 0xff);
      costMatrix.set(sector.x, sector.y - 1, 0xff);
    });

    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;

    // road to sources
    room.find(FIND_SOURCES).forEach(source => {
      RoomPlanner.buildRoad(source.pos, storagePos, room, costMatrix, planner, 2);
    });

    if (room.controller) {
      RoomPlanner.buildRoad(room.controller.pos, storagePos, room, costMatrix, planner, 2);
    }
  }

  static buildRoad(
    a: SimplePos,
    b: SimplePos,
    room: Room,
    matrix: CostMatrix,
    planner: RoomPlannerData,
    level: number | null = null
  ) {
    const result = PathFinder.search(new RoomPosition(a.x, a.y, room.name), new RoomPosition(b.x, b.y, room.name), {
      roomCallback: roomName => {
        if (roomName === room.name) {
          return matrix;
        } else {
          return false;
        }
      }
    });
    result.path.forEach(pos => {
      const structureExistsHere = planner.structures.find(i => i.x === pos.x && i.y === pos.y);
      if (!structureExistsHere) {
        RoomPlanner.reserveSpot(pos.x, pos.y, STRUCTURE_ROAD, planner, level);
      }
    });
  }

  static isRoadOrSector(pos: SimplePos, planner: RoomPlannerData, sectors: SimplePos[]): "road" | "sector" {
    for (let index = 0; index < sectors.length; index++) {
      const sector = sectors[index];
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          if (Math.abs(i) + Math.abs(j) <= 1) {
            const targetPos = { x: sector.x + i, y: sector.y + j };
            if (targetPos.x === pos.x && targetPos.y === pos.y) {
              return "sector";
            }
          }
        }
    }
    return "road";
  }

  static reserveLabs(planner: RoomPlannerData, sectors: SimplePos[]) {
    // reserve sectors for labs
    const spot1 = RoomPlanner.getNextAvailableSpot(planner, sectors, (indexInSector, sectorIndex, totalIndex) => {
      // must be consecutive, meaning next sector must be in range
      if (indexInSector !== 0) {
        return false;
      }

      const thisCenter = RoomPlanner.getPositionFromTotalIndex(totalIndex, sectors);
      const nextCenter = RoomPlanner.getPositionFromTotalIndex(totalIndex + 5, sectors);

      return Math.abs(thisCenter.x - nextCenter.x) === 2 && Math.abs(thisCenter.y - nextCenter.y) === 2;
    });

    for (let i = 0; i < 6; i++) {
      RoomPlanner.reserveSpotAtIndex(spot1.finalIndex + i, sectors, STRUCTURE_LAB, planner);
    }

    const thisCenter = RoomPlanner.getPositionFromTotalIndex(spot1.finalIndex, sectors);
    const nextCenter = RoomPlanner.getPositionFromTotalIndex(spot1.finalIndex + 5, sectors);

    const directionToPreviousSector: SimplePos = {
      x: (thisCenter.x - nextCenter.x) / 2,
      y: (thisCenter.y - nextCenter.y) / 2
    };
    // little trick, for the next 3 labs, they have to be to the side of the previous sector
    RoomPlanner.reserveSpot(nextCenter.x, nextCenter.y + directionToPreviousSector.y, STRUCTURE_LAB, planner);
    RoomPlanner.reserveSpot(nextCenter.x + directionToPreviousSector.x, nextCenter.y, STRUCTURE_LAB, planner);
    RoomPlanner.reserveSpot(nextCenter.x - directionToPreviousSector.x, nextCenter.y, STRUCTURE_LAB, planner);

    // create one on the road
    RoomPlanner.reserveSpot(
      (thisCenter.x + nextCenter.x) / 2,
      (thisCenter.y + nextCenter.y) / 2,
      STRUCTURE_LAB,
      planner
    );

    // we just filled 2 sectors.
    planner.spIndex = spot1.finalIndex + 10;
  }

  static getNextAvailableSpot(
    planner: RoomPlannerData,
    sectors: SimplePos[],
    condition?: (indexInSector: number, sectorIndex: number, totalIndex: number) => boolean
  ) {
    for (let i = planner.spIndex; i < sectors.length * 5; i++) {
      const sectorIndex = Math.floor(i / 5);
      const sectorPositionIndex = i % 5;
      const pos = RoomPlanner.getPositionFromTotalIndex(i, sectors);
      const existingStructure = planner.structures.find(i => i.x === pos.x && i.y === pos.y);
      if (existingStructure) {
        continue;
      }

      if (!condition || condition(sectorPositionIndex, sectorIndex, i)) {
        return { x: pos.x, y: pos.y, finalIndex: i };
      }
    }
    throw new Error(
      "Could not find available spot. " + (condition ? "Condition was supplied." : "Condition was not supplied.")
    );
  }

  static getPositionFromTotalIndex(totalIndex: number, sectors: SimplePos[]) {
    const sectorIndex = Math.floor(totalIndex / 5);
    const sectorPositionIndex = totalIndex % 5;
    return RoomPlanner.getPositionsFromSector(sectors[sectorIndex])[sectorPositionIndex];
  }

  static reserveSpot(
    x: number,
    y: number,
    type: BuildableStructureConstant,
    planner: RoomPlannerData,
    level: number | null = null
  ) {
    planner.structures.push({
      type,
      x,
      y,
      l: level
    });
  }

  static reserveSpotAtIndex(
    index: number,
    sectors: SimplePos[],
    type: BuildableStructureConstant,
    planner: RoomPlannerData,
    level: number | null = null
  ) {
    const pos = RoomPlanner.getPositionFromTotalIndex(index, sectors);
    planner.structures.push({
      type,
      x: pos.x,
      y: pos.y,
      l: level
    });
  }

  static getNewlyAvailableStructuresAtLevel(level: number) {
    const structuresAutomaticallyBuilt = [
      STRUCTURE_SPAWN,
      STRUCTURE_EXTENSION,
      STRUCTURE_NUKER,
      STRUCTURE_OBSERVER,
      STRUCTURE_TOWER
    ];
    const structureInfo = _.pick(CONTROLLER_STRUCTURES, structuresAutomaticallyBuilt) as Record<
      BuildableStructureConstant,
      { [level: number]: number }
    >;
    const previousLevel = _.mapValues(structureInfo, i => i[level]);
    const currentLevel = _.mapValues(structureInfo, i => i[level - 1]);

    const result = _.merge(
      currentLevel,
      previousLevel,
      (previousCount, currentCount) => currentCount - (previousCount || 0)
    );
    return _.pairs(result)
      .map(pair => ({ structure: pair[0], count: pair[1] }))
      .filter(i => i.count > 0);
  }

  static getPossibleSectors(center: SimplePos, room: Room): SimplePos[] {
    const terrain = Game.map.getRoomTerrain(room.name);
    // we're gonna spiral around the starting position

    // 10 loop of sectors

    let sectors: SimplePos[] = [];
    for (let i = 1; i <= 6; i++) {
      sectors = sectors.concat(RoomPlanner.getSectorsFromRadiusPosition(center, i));
    }

    // remove non viable sectors
    sectors = sectors.filter(sector => {
      if (
        sector.x > 48 - buildRangeFromRoomLimit ||
        sector.x < 1 + buildRangeFromRoomLimit ||
        sector.y > 48 - buildRangeFromRoomLimit ||
        sector.y < 1 + buildRangeFromRoomLimit
      ) {
        return false;
      }

      for (let i = sector.x - 1; i <= sector.x + 1; i++) {
        for (let j = sector.y - 1; j <= sector.y + 1; j++) {
          if (terrain.get(i, j) === TERRAIN_MASK_WALL) {
            return false;
          }
        }
      }

      return true;
    });

    return sectors;
  }

  static getPositionsFromSector(sector: SimplePos): SimplePos[] {
    const positions: SimplePos[] = [];
    positions.push({ x: sector.x, y: sector.y });
    positions.push({ x: sector.x - 1, y: sector.y });
    positions.push({ x: sector.x + 1, y: sector.y });
    positions.push({ x: sector.x, y: sector.y - 1 });
    positions.push({ x: sector.x, y: sector.y + 1 });
    return positions;
  }

  static getSectorsFromRadiusPosition(center: SimplePos, loopIndex: number): SimplePos[] {
    const sectors: SimplePos[] = [];

    const radius = loopIndex * 4 - 2;

    const edges = loopIndex * 2;

    for (let i = 0; i < edges - 1; i++) {
      sectors.push({
        x: center.x + radius - 2 * i,
        y: center.y - 2 * i
      });
    }

    for (let i = 0; i < edges - 1; i++) {
      sectors.push({
        x: center.x - 2 * i,
        y: center.y - radius + 2 * i
      });
    }

    for (let i = 0; i < edges - 1; i++) {
      sectors.push({
        x: center.x - radius + 2 * i,
        y: center.y + 2 * i
      });
    }

    for (let i = 0; i < edges - 1; i++) {
      sectors.push({
        x: center.x + 2 * i,
        y: center.y + radius - 2 * i
      });
    }

    return sectors;
  }
}

(global as any).RoomPlanner = RoomPlanner;

profiler.registerClass(RoomPlanner, "RoomPlanner");
