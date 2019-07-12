import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";
import { Traveler } from "utils/Traveler";
import { findClosestRoom } from "utils/finder";

const exploreTimeout = 10000;

export class ExplorationManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new ExplorationManager(room).run();
    });
  }

  run() {
    Memory.roomExplorations = Memory.roomExplorations || [];
    if (Game.time % 4 > 0) {
      return;
    }

    if (!this.room.controller || this.room.controller.level < 3) {
      return;
    }
    /*
    this.room.memory.explorations = this.room.memory.explorations || [];

    const roomsToExplore = Cartographer.findRoomsInRange(this.room.name, 2).filter(i => i !== this.room.name);

    roomsToExplore.forEach(room => {
      var memory = this.room.memory.explorations.find(i => i.roomName === room);

      if (memory) {
        memory.needsExploration = Game.time - memory.lastExplorationDate > exploreTimeout;
      } else {
        this.room.memory.explorations.push({
          isEnemyRoom: undefined,
          lastExplorationDate: 0,
          needsExploration: true,
          roomName: room
        });
      }
    });

    this.room.memory.explorations.forEach(roomMemory => {
      const roomObj = Game.rooms[roomMemory.roomName];
      if (
        !roomObj ||
        (roomObj.controller && roomObj.controller.owner && roomObj.controller.owner.username === getUsername())
      ) {
        // Not necessary for own rooms
        return;
      }

      if (roomObj && roomMemory.lastExplorationDate < Game.time - exploreTimeout) {
        roomMemory.lastExplorationDate = Game.time;
        ExplorationManager.analyzeRoom(roomObj, roomMemory);
      }
    }); */
  }

  static analyzeRoom(room: Room) {
    let memory = Memory.roomExplorations.find(i => i.name == room.name);

    if (memory && memory.tick >= Game.time - 1000) {
      return;
    }

    if (getMyRooms().find(i => i.name === room.name)) {
      return;
    }

    console.log("Analyzing room ", room.name);

    const closestRoomName = findClosestRoom(room.name);
    const closestRoom = closestRoomName && Game.rooms[closestRoomName];
    const closestSpawn = closestRoom && closestRoom.spawns[0];

    if (!closestRoomName || !closestRoom || !closestSpawn) {
      console.log("Warning, unable to find closest room to", room.name);
      return;
    }
    if (!memory) {
      // This happens only once
      memory = {
        name: room.name,
        tick: Game.time,
        enemyBase: false,
        enemyRemote: false,
        closestRoom: closestRoomName,
        colonizable: this.analyzeFutureColony(room)
      };
      Memory.roomExplorations.push(memory);
    }

    memory.closestRoom = closestRoomName;

    // register if enemy
    memory.enemyBase = room.controller
      ? room.controller.owner && room.controller.owner.username !== getUsername()
      : false;

    // register if enemy
    memory.enemyRemote =
      (!memory.enemyBase &&
        (room.controller && room.controller.reservation && room.controller.reservation.username !== getUsername())) ||
      false;

    const sources = room.find(FIND_SOURCES);
    if (memory.enemyBase || memory.enemyRemote) {
      // delete existing remotes in this room
      closestRoom.memory.remotes = closestRoom.memory.remotes.filter(i => i.room === room.name);
      return;
    }

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

      const remoteExistInAnotherRoom = !!getMyRooms().find(
        i => !!i.memory.remotes.find(r => r.room === source.room.name && source.pos.x === r.x && source.pos.y === r.y)
      );

      if (existingRemote && !existingRemote.distance) {
        existingRemote.distance = searchResult.path.length;
      }
      const allowSourceKeepRooms = closestRoom.controller && closestRoom.controller.level >= 7;

      if (
        (roomType !== "SK" || allowSourceKeepRooms) &&
        searchResult.path.length < maxDistance &&
        !existingRemote &&
        !remoteExistInAnotherRoom
      ) {
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

  static analyzeFutureColony(room: Room) {
    const ctrl = room.controller;
    if (!ctrl) {
      return null;
    }
    const closestRoom = findClosestRoom(room.name);
    if (!closestRoom) {
      return null;
    }

    console.log("Analyzing room ", room, "for future possible colonization...");

    const sources = room.find(FIND_SOURCES);
    const sourcesCount = sources.length;
    const distanceBetweenSources =
      sourcesCount >= 2 ? Traveler.findTravelPath(sources[0], sources[1]).path.length : 1000;
    const d1 = Traveler.findTravelPath(sources[0], ctrl).path.length;
    const d2 = sourcesCount >= 2 ? Traveler.findTravelPath(sources[1], ctrl).path.length : 10000;

    const topPlaces = this.findTopPlacesWithoutWalls(5, 7, room.name);
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

    const distanceWithClosestRoom = Traveler.findTravelPath(
      Game.rooms[closestRoom].spawns[0],
      new RoomPosition(topPlace.x, topPlace.y, room.name)
    ).path.length;

    const distanceScore = distanceWithClosestRoom < 300 ? 0 : Math.pow(distanceWithClosestRoom - 500, 2) / 100;

    const finalScore = distanceBetweenSources + d1 + d2 + topPlace.total + topPlace.wallsCount * 4 + distanceScore;

    return {
      c: sourcesCount, //sourceCount
      d: distanceBetweenSources, // distance between sources
      d1: d1, // distance between source1 and ctrl
      d2: d2, // distance between source2 and ctrl

      x: topPlace.x, // ideal spawn location
      y: topPlace.y, // ideal spawn location
      w: topPlace.wallsCount, // walls count at spawn location

      s1: topPlace.distanceWithSource1, // distance between source1 and spawn
      s2: topPlace.distanceWithSource2, // distance between source2 and spawn
      s3: topPlace.distanceWithController, // distance between ctrl and spawn

      dd: distanceWithClosestRoom, // distance to closest room
      dds: distanceScore, // distance to closest room score

      s: Math.round(finalScore) // score
    };
  }

  /* Generates a matrix which gives us the amount of walls around a position*/
  static getWallsAroundMatrix(range: number, room: string) {
    const terrain = Game.map.getRoomTerrain(room);
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
    const wallsMatrix = this.getWallsAroundMatrix(range, room);

    const tops: { x: number; y: number; walls: number }[] = [];

    for (let i = 1 + range; i < 48 - range; i++) {
      for (let j = 1 + range; j < 48 - range; j++) {
        if (i % 2 === 0 && j % 2 === 0) {
          const walls = wallsMatrix[i][j];
          tops.push({ x: i, y: j, walls });
        }
      }
    }

    return _.take(_.sortBy(_.shuffle(tops), i => i.walls), top);
  }
}

profiler.registerClass(ExplorationManager, "ExplorationManager");
