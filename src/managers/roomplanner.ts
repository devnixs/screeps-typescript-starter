import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";
import { Traveler } from "utils/Traveler";
import { findClosestRoom, SimplePos, findEmptySpotCloseTo } from "utils/finder";
import { explorationConstants } from "constants/memory-constants";
import { buildRangeFromRoomLimit } from "constants/misc";
import { mincutHelper } from "utils/mincut-walls";

const structureColors: any = {
  [STRUCTURE_EXTENSION]: "white",
  [STRUCTURE_SPAWN]: "blue",
  [STRUCTURE_NUKER]: "red",
  [STRUCTURE_OBSERVER]: "red",
  [STRUCTURE_TOWER]: "black",
  [STRUCTURE_TERMINAL]: "yellow",
  [STRUCTURE_STORAGE]: "pink",
  [STRUCTURE_LINK]: "orange",
  [STRUCTURE_CONTAINER]: "pink",
  [STRUCTURE_OBSERVER]: "red",
  [STRUCTURE_POWER_SPAWN]: "red",
  [STRUCTURE_LAB]: "purple",
  [STRUCTURE_NUKER]: "red",
  [STRUCTURE_RAMPART]: "cyan",
  [STRUCTURE_ROAD]: "lawngreen"
};

export class RoomPlanner {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new RoomPlanner(room).run();
    });
  }

  run() {
    if (!this.room.memory.useNewRoomPlanner) {
      return;
    }

    const flag = this.room.find(FIND_FLAGS).find(i => i.name === "claimer_target");
    if (flag && !this.room.memory.roomPlanner) {
      this.init(flag);
    }

    if (Object.keys(Game.constructionSites).length > MAX_CONSTRUCTION_SITES * 0.9) {
      return;
    }
  }

  init(flag: Flag) {
    const planner = RoomPlanner.initPlanner(flag.pos.x, flag.pos.y, this.room);
    this.room.memory.roomPlanner = planner;
    flag.remove();
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

    // find the closest sector to the ctrl to build the storage between the first 14 sectors
    const storageSector = _(sectors)
      .take(14)
      .sortBy(s => new RoomPosition(s.x, s.y, room.name).getRangeTo(ctrl))
      .first();

    RoomPlanner.reserveSpot(storageSector.x, storageSector.y, STRUCTURE_STORAGE, planner);
    RoomPlanner.reserveSpot(storageSector.x - 1, storageSector.y, STRUCTURE_LINK, planner);
    RoomPlanner.reserveSpot(storageSector.x + 1, storageSector.y, STRUCTURE_TERMINAL, planner);
    RoomPlanner.reserveSpot(storageSector.x, storageSector.y + 1, STRUCTURE_ROAD, planner);
    RoomPlanner.reserveSpot(storageSector.x, storageSector.y - 1, STRUCTURE_ROAD, planner);

    for (let level = 1; level <= 8; level++) {
      const buildable = RoomPlanner.getNewlyAvailableStructuresAtLevel(level);

      buildable.forEach(build => {
        for (let counter = 0; counter < build.count; counter++) {
          const finalPos = RoomPlanner.getNextAvailableSpot(planner, sectors);
          RoomPlanner.reserveSpot(finalPos.x, finalPos.y, build.structure, planner);
          planner.spIndex = finalPos.finalIndex;
        }
      });
    }

    RoomPlanner.reserveLabs(planner, sectors);

    // do walls

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
        RoomPlanner.reserveSpot(wall.x, wall.y, STRUCTURE_RAMPART, planner);
      });
    }

    if (ctrl.pos.getRangeTo(new RoomPosition(storageSector.x, storageSector.y, room.name)) > 4) {
      const linkLocation = findEmptySpotCloseTo(ctrl.pos, room);
      if (linkLocation) {
        RoomPlanner.reserveSpot(linkLocation.x, linkLocation.y, STRUCTURE_LINK, planner);
      }
    }

    RoomPlanner.buildContainersAroundSources(planner, room);
    RoomPlanner.buildRoadsAroundStructures(planner, room);
    RoomPlanner.buildRoadsToPlaces(planner, room, sectors);

    planner.structures
      // .filter(i => (Game.time % 2 === 0 ? i.type === "road" : i.type !== "road"))
      .forEach(structure => {
        room.visual.circle(structure.x, structure.y, {
          radius: 0.5,
          fill: structureColors[structure.type] || "black",
          opacity: 0.7
        });
      });

    for (let i = 0; i < 200; i++) {
      const coords = RoomPlanner.getPositionFromTotalIndex(i, sectors);
      room.visual.text(i.toString(), coords.x, coords.y, {
        opacity: 1,
        color: "green"
      });
    }

    return planner;
  }

  static buildRoadsAroundStructures(planner: RoomPlannerData, room: Room) {
    const terrain = Game.map.getRoomTerrain(room.name);
    const buildings = planner.structures.filter(
      i => i.type !== STRUCTURE_ROAD && i.type !== STRUCTURE_WALL && i.type !== STRUCTURE_RAMPART
    );
    for (let index = 0; index < buildings.length; index++) {
      const building = buildings[index];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const position = { x: i + building.x, y: j + building.y };
          const spotType = RoomPlanner.isRoadOrSector(position, { x: planner.centerX, y: planner.centerY });
          const structureExistsHere = planner.structures.find(i => i.x === position.x && i.y === position.y);
          if (
            spotType === "road" &&
            terrain.get(position.x, position.y) !== TERRAIN_MASK_WALL &&
            !structureExistsHere
          ) {
            RoomPlanner.reserveSpot(position.x, position.y, STRUCTURE_ROAD, planner);
          }
        }
      }
    }
  }

  static buildContainersAroundSources(planner: RoomPlannerData, room: Room) {
    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;
    room.find(FIND_SOURCES).forEach(source => {
      const containerLocation = PathFinder.search(source.pos, new RoomPosition(storagePos.x, storagePos.y, room.name))
        .path[0];
      console.log("containerLocation", JSON.stringify(containerLocation));
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

  static buildRoadsToPlaces(planner: RoomPlannerData, room: Room, sectors: SimplePos[]) {
    const costMatrix = new PathFinder.CostMatrix();

    _.take(sectors, planner.spIndex / 5).forEach(sector => {
      costMatrix.set(sector.x, sector.y, 0xff);
      costMatrix.set(sector.x + 1, sector.y, 0xff);
      costMatrix.set(sector.x - 1, sector.y, 0xff);
      costMatrix.set(sector.x, sector.y + 1, 0xff);
      costMatrix.set(sector.x, sector.y - 1, 0xff);
    });

    const storagePos = planner.structures.find(i => i.type === "storage") as StructurePlanning;

    // road to sources
    room.find(FIND_SOURCES).forEach(source => {
      RoomPlanner.buildRoad(source.pos, storagePos, room, costMatrix, planner);
    });

    if (room.controller) {
      RoomPlanner.buildRoad(room.controller.pos, storagePos, room, costMatrix, planner);
    }

    const mineral = room.find(FIND_MINERALS)[0];
    if (mineral) {
      RoomPlanner.buildRoad(mineral.pos, storagePos, room, costMatrix, planner);
    }
  }

  static buildRoad(a: SimplePos, b: SimplePos, room: Room, matrix: CostMatrix, planner: RoomPlannerData) {
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
        RoomPlanner.reserveSpot(pos.x, pos.y, STRUCTURE_ROAD, planner);
      }
    });
  }

  static isRoadOrSector(pos: SimplePos, center: SimplePos): "road" | "sector" {
    const delta = { x: center.x - pos.x, y: center.y - pos.y };
    const sum = delta.x + delta.y;

    if (Math.abs(sum) % 2 !== 0) {
      return "sector";
    }

    const c = (Math.abs(delta.x / 2) + Math.abs(delta.y / 2)) * 2;
    if (c % 2 !== 0) {
      return "sector";
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

  static reserveSpot(x: number, y: number, type: BuildableStructureConstant, planner: RoomPlannerData) {
    planner.structures.push({
      type,
      x,
      y
    });
  }

  static reserveSpotAtIndex(
    index: number,
    sectors: SimplePos[],
    type: BuildableStructureConstant,
    planner: RoomPlannerData
  ) {
    const pos = RoomPlanner.getPositionFromTotalIndex(index, sectors);
    planner.structures.push({
      type,
      x: pos.x,
      y: pos.y
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

    room.spawns[0].pos.look();

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

      for (let i = sector.x - 2; i <= sector.x + 2; i++) {
        for (let j = sector.y - 2; j <= sector.y + 2; j++) {
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
