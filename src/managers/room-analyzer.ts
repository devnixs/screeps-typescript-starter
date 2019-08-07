import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";
import { Traveler } from "utils/Traveler";
import { findClosestRoom } from "utils/finder";
import { explorationConstants } from "constants/memory-constants";
import { buildRangeFromRoomLimit } from "constants/misc";
import { ExplorationCache } from "../utils/exploration-cache";

export class RoomAnalyzer {
  public static run() {
    RoomAnalyzer.exploreVisibleRooms();
  }

  static exploreVisibleRooms() {
    if (Game.time % 29 > 0) {
      return;
    }
    const myRooms = getMyRooms().map(i => i.name);
    const rooms = Object.keys(Game.rooms);
    const otherRooms = _.difference(rooms, myRooms);

    for (const roomName of otherRooms) {
      RoomAnalyzer.analyzeRoom(Game.rooms[roomName]);
    }
  }

  static analyzeRoom(room: Room, force = false) {
    let memory = ExplorationCache.getExploration(room.name);
    if (memory === null) {
      // segments are not loaded yet. aborting.
      return;
    }

    if (memory && memory.t >= Game.time - 500 && !force) {
      return;
    }

    if (getMyRooms().find(i => i.name === room.name)) {
      return;
    }
    // console.log("Analyzing room ", room.name);

    const closestRoomName = findClosestRoom(room.name);
    const closestRoom = closestRoomName && Game.rooms[closestRoomName];
    const closestSpawn = closestRoom && closestRoom.spawns[0];

    if (!closestRoomName || !closestRoom || !closestSpawn) {
      console.log("Warning, unable to find closest room to", room.name);
      return;
    }

    const isEnemyBase = room.controller
      ? room.controller.owner && room.controller.owner.username !== getUsername()
      : false;

    const enemySpawns: SimplePos[] = isEnemyBase
      ? room.find(FIND_HOSTILE_SPAWNS).map(i => ({ x: i.pos.x, y: i.pos.y }))
      : [];

    const isEnemyRemote =
      (!isEnemyBase &&
        (room.controller && room.controller.reservation && room.controller.reservation.username !== getUsername())) ||
      false;

    const enemyRemoteContainers = isEnemyRemote
      ? room
          .find(FIND_STRUCTURES, { filter: i => i.structureType === "container" })
          .map(i => ({ x: i.pos.x, y: i.pos.y }))
      : [];

    const enemyDroppedEnergy = isEnemyRemote
      ? room
          .find(FIND_DROPPED_RESOURCES, { filter: i => i.resourceType === "energy" && i.amount > 1000 })
          .map(i => ({ x: i.pos.x, y: i.pos.y }))
      : [];

    const distanceToClosestRoom = Cartographer.findRoomDistanceSum(closestRoom.name, room.name);
    if (distanceToClosestRoom > 12) {
      return;
    }

    if (!memory) {
      // This happens only once

      let report: ColonizationEvaluation | null = null;
      if (!isEnemyBase || (!isEnemyRemote && room.controller)) {
        report = this.analyzeFutureColony(room);
      }

      memory = {
        r: room.name,
        t: Game.time,
        eb: false,
        er: false,
        cr: closestRoomName,
        c: report,
        l: Game.time,
        es: enemySpawns,
        erc: enemyRemoteContainers.concat(enemyDroppedEnergy)
      };
      ExplorationCache.setExploration(memory);
    }

    memory.t = Game.time;
    memory.l = Game.time;

    memory.cr = closestRoomName;

    // register if enemy
    memory.eb = isEnemyBase;

    memory.el = memory.eb ? room && room.controller && room.controller.level : undefined;

    // register if enemy
    memory.er = isEnemyRemote;
    memory.erc = enemyRemoteContainers.concat(enemyDroppedEnergy);

    ExplorationCache.setExploration(memory);

    if (memory.eb || memory.er) {
      // delete existing remotes in this room
      closestRoom.memory.remotes = closestRoom.memory.remotes.filter(i => i.room !== room.name);
      return;
    }

    if (distanceToClosestRoom <= 3) {
      // no need to add remotes if it's too far
      RoomAnalyzer.analyzeRemotes(room, closestRoom, closestSpawn);
    }
  }

  static analyzeRemotes(room: Room, closestRoom: Room, closestSpawn: StructureSpawn) {
    const sources = room.find(FIND_SOURCES);
    sources.forEach(source => {
      const maxDistance = 150;
      const searchResult = Traveler.findTravelPath(closestSpawn.pos, source.pos, {
        restrictDistance: maxDistance
      });
      if (searchResult.incomplete) {
        return;
      }
      const existingRemote = closestRoom.memory.remotes.find(
        i => i.room === source.room.name && i.x === source.pos.x && i.y === source.pos.y
      );

      var roomType = Cartographer.roomType(source.room.name);

      if (existingRemote && !existingRemote.distance) {
        existingRemote.distance = searchResult.path.length;
      }
      const allowSourceKeepRooms = closestRoom.controller && closestRoom.controller.level >= 7;

      if ((roomType !== "SK" || allowSourceKeepRooms) && searchResult.path.length < maxDistance && !existingRemote) {
        console.log(
          "Creating remote at ",
          source.room.name,
          source.pos.x,
          source.pos.y,
          "distance=",
          searchResult.path.length
        );
        closestRoom.memory.remotes.push({
          distance: searchResult.path.length,
          room: source.room.name,
          x: source.pos.x,
          y: source.pos.y,
          energyGeneration: 0,
          energy: 0,
          needsReservation: undefined,
          container: undefined,
          disabled: true
        });
      }
    });
  }

  static analyzeFutureColony(room: Room): ColonizationEvaluation | null {
    const ctrl = room.controller;
    if (!ctrl) {
      return null;
    }
    const closestRoom = findClosestRoom(room.name);
    if (!closestRoom) {
      return null;
    }

    console.log("Analyzing room ", room.name, "for future possible colonization...");

    const sources = room.find(FIND_SOURCES);
    const sourcesCount = sources.length;
    const topPlaces = this.findTopPlacesWithoutWalls(20, buildRangeFromRoomLimit, room.name);
    const topPlacesMapped = topPlaces.map(i => {
      const distanceWithSource1 = Traveler.findTravelPath(sources[0], new RoomPosition(i.x, i.y, room.name)).path
        .length;
      const distanceWithSource2 = sources[1]
        ? Traveler.findTravelPath(sources[1], new RoomPosition(i.x, i.y, room.name)).path.length
        : 10000;
      const distanceWithController = Traveler.findTravelPath(ctrl, new RoomPosition(i.x, i.y, room.name)).path.length;

      return {
        x: i.x,
        y: i.y,
        wallsCount: i.walls,
        distanceWithSource1,
        distanceWithSource2,
        distanceWithController,
        total: distanceWithSource1 + distanceWithSource2 + distanceWithController
      };
    });

    const topPlacesOrdered = _.sortBy(topPlacesMapped, i => i.total);

    const topPlace = topPlacesOrdered[0];

    const travelPath = Traveler.findTravelPath(
      Game.rooms[closestRoom].spawns[0],
      new RoomPosition(topPlace.x, topPlace.y, room.name)
    );
    if (travelPath.incomplete) {
      return null;
    }
    const distanceWithClosestRoom = travelPath.path.length;

    const distanceScore = distanceWithClosestRoom < 400 ? 0 : Math.pow(distanceWithClosestRoom - 400, 2) / 100;

    const finalScore = topPlace.total + topPlace.wallsCount * 4 + distanceScore;

    const mineral = room.find(FIND_MINERALS)[0];

    return {
      x: topPlace.x, // ideal spawn location
      y: topPlace.y, // ideal spawn location
      s: Math.round(finalScore), // score
      m: mineral ? mineral.mineralType : undefined
      /*
      w: topPlace.wallsCount, // walls count at spawn location
      c: sourcesCount, //sourceCount
      s1: topPlace.distanceWithSource1, // distance between source1 and spawn
      s2: topPlace.distanceWithSource2, // distance between source2 and spawn
      s3: topPlace.distanceWithController, // distance between ctrl and spawn

      dd: distanceWithClosestRoom, // distance to closest room
      dds: distanceScore, // distance to closest room score
      */
    };
  }

  /* Generates a matrix which gives us the amount of walls around a position*/
  static getWallsAroundMatrix(range: number, room: string, terrain: RoomTerrain) {
    const matrix: number[][] = [];

    for (let i = 1; i < 48; i++) {
      matrix[i] = [];
      for (let j = 1; j < 48; j++) {
        matrix[i][j] = 0;
      }
    }

    for (let i = 1; i < 48; i++) {
      for (let j = 1; j < 48; j++) {
        const terrainHere = terrain.get(i, j);
        if (terrainHere === TERRAIN_MASK_WALL) {
          for (let k = i - range; k <= i + range; k++) {
            for (let l = j - range; l <= j + range; l++) {
              if (k >= 1 + range && k <= 48 - range && j > 1 + range && j < 48 - range) {
                matrix[k][l]++;
              }
            }
          }
        }
      }
    }
    return matrix;
  }

  static findTopPlacesWithoutWalls(top: number, range: number, room: string) {
    const terrain = Game.map.getRoomTerrain(room);
    const wallsMatrix = this.getWallsAroundMatrix(range, room, terrain);

    const tops: { x: number; y: number; walls: number }[] = [];

    for (let i = 1 + range; i < 48 - range; i++) {
      for (let j = 1 + range; j < 48 - range; j++) {
        if (i % 2 === 0 && j % 2 === 0 && terrain.get(i, j) !== TERRAIN_MASK_WALL) {
          const walls = wallsMatrix[i][j];
          tops.push({ x: i, y: j, walls });
        }
      }
    }

    return _.take(_.sortBy(_.shuffle(tops), i => i.walls), top);
  }
}

profiler.registerClass(RoomAnalyzer, "RoomAnalyzer");

(global as any).RoomAnalyzer = RoomAnalyzer;
