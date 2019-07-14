import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";
import { Traveler } from "utils/Traveler";
import { findClosestRoom, SimplePos } from "utils/finder";
import { explorationConstants } from "constants/memory-constants";
import { buildRangeFromRoomLimit } from "constants/misc";

const structureColors = {
  [STRUCTURE_EXTENSION]: "#1AC8ED",
  [STRUCTURE_SPAWN]: "#AED4E6",
  [STRUCTURE_NUKER]: "#AF7595",
  [STRUCTURE_OBSERVER]: "#004BA8",
  [STRUCTURE_TOWER]: "#20A39E",
  [STRUCTURE_TERMINAL]: "#FFBA49",
  [STRUCTURE_STORAGE]: "#24272B",
  [STRUCTURE_LINK]: "#FFBA49"
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
    const planner: RoomPlannerData = {
      centerX: flag.pos.x,
      centerY: flag.pos.y,
      spIndex: 0,
      structures: []
    };

    this.room.memory.roomPlanner = planner;

    const sectors = RoomPlanner.getPossibleSectors(flag.pos, this.room);

    for (let level = 1; level <= 8; level++) {
      const buildable = RoomPlanner.getNewlyAvailableStructuresAtLevel(level);

      // create storage at center of sector
      const storagePos = this.getNextAvailableSpot(planner, sectors, i => i % 5 === 0);
      const linkPos = this.getNextAvailableSpot(planner, sectors, i => i % 5 === 1);
      const terminalPos = this.getNextAvailableSpot(planner, sectors, i => i % 5 === 2);
      this.reserveSpot(storagePos.x, storagePos.y, STRUCTURE_STORAGE, planner);
      this.reserveSpot(linkPos.x, linkPos.y, STRUCTURE_LINK, planner);
      this.reserveSpot(terminalPos.x, terminalPos.y, STRUCTURE_TERMINAL, planner);

      buildable.forEach(build => {
        for (let counter = 0; counter < build.count; counter++) {
          const finalPos = this.getNextAvailableSpot(planner, sectors);
          this.reserveSpot(finalPos.x, finalPos.y, build.structure, planner);
          planner.spIndex = finalPos.finalIndex;
        }
      });
    }

    this.reserveLabs(planner, sectors);
  }

  reserveLabs(planner: RoomPlannerData, sectors: SimplePos[]) {
    // reserve sectors for labs
    const spot1 = this.getNextAvailableSpot(planner, sectors, i => {
      // must be consecutive, meaning next sector must be in range
      if (i % 5 === 0) {
        return false;
      }

      const thisCenter = this.getPositionFromTotalIndex(i, sectors);
      const nextCenter = this.getPositionFromTotalIndex(i + 5, sectors);

      return Math.abs(thisCenter.x - nextCenter.x) + Math.abs(thisCenter.y - nextCenter.y) === 4;
    });

    for (let i = 0; i < 9; i++) {
      this.reserveSpotAtIndex(spot1.finalIndex + i, sectors, STRUCTURE_LAB, planner);
    }

    const thisCenter = this.getPositionFromTotalIndex(spot1.finalIndex, sectors);
    const nextCenter = this.getPositionFromTotalIndex(spot1.finalIndex + 5, sectors);
    // create
    this.reserveSpot((thisCenter.x + nextCenter.x) / 2, (thisCenter.y + nextCenter.y) / 2, STRUCTURE_LAB, planner);
  }

  getNextAvailableSpot(
    planner: RoomPlannerData,
    sectors: SimplePos[],
    condition?: (indexInSector: number, sectorIndex: number, totalIndex: number) => boolean
  ) {
    for (let i = planner.spIndex; i < sectors.length * 5; i++) {
      const sectorIndex = Math.floor(i / 5);
      const sectorPositionIndex = i % 5;
      const pos = this.getPositionFromTotalIndex(i, sectors);
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

  getPositionFromTotalIndex(totalIndex: number, sectors: SimplePos[]) {
    const sectorIndex = Math.floor(totalIndex / 5);
    const sectorPositionIndex = totalIndex % 5;
    return RoomPlanner.getPositionsFromSector(sectors[sectorIndex])[sectorPositionIndex];
  }

  reserveSpot(x: number, y: number, type: BuildableStructureConstant, planner: RoomPlannerData) {
    planner.structures.push({
      type,
      x,
      y
    });
  }

  reserveSpotAtIndex(index: number, sectors: SimplePos[], type: BuildableStructureConstant, planner: RoomPlannerData) {
    const pos = this.getPositionFromTotalIndex(index, sectors);
    planner.structures.push({
      type,
      x: pos.x,
      y: pos.y
    });
  }

  static getNewlyAvailableStructuresAtLevel(level: number) {
    const structuresAutomaticallyBuilt = [
      STRUCTURE_EXTENSION,
      STRUCTURE_SPAWN,
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
    console.log("Loading sectors...");
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
        sector.x > 46 - buildRangeFromRoomLimit ||
        sector.x < 3 + buildRangeFromRoomLimit ||
        sector.y > 46 - buildRangeFromRoomLimit ||
        sector.y < 3 + buildRangeFromRoomLimit
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

    sectors.forEach(sector => {
      const positions = RoomPlanner.getPositionsFromSector(sector);
      positions.forEach(pos => {
        room.visual.circle(pos.x, pos.y, { radius: 0.5, fill: "#ff7722", opacity: 0.9 });
      });
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

    for (let i = 0; i < edges; i++) {
      sectors.push({
        x: center.x + radius - 2 * i,
        y: center.y - 2 * i
      });
      sectors.push({
        x: center.x - 2 * i,
        y: center.y - radius + 2 * i
      });
      sectors.push({
        x: center.x - radius + 2 * i,
        y: center.y + 2 * i
      });
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
