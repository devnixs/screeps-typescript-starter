import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";

const exploreTimeout = 10000;

export class ExplorationManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new ExplorationManager(room).run();
    });
  }

  run() {
    if (Game.time % 4 > 0) {
      return;
    }

    if (!this.room.controller || this.room.controller.level < 3) {
      return;
    }

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
        this.analyzeRoom(roomObj, roomMemory);
      }
    });
  }

  analyzeRoom(room: Room, roomMemory: ExplorationDefinition) {
    // register if enemy
    roomMemory.isEnemyRoom =
      room.controller &&
      ((room.controller.owner && room.controller.owner.username !== getUsername()) ||
        (room.controller.reservation && room.controller.reservation.username !== getUsername()));

    const sources = room.find(FIND_SOURCES);
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return;
    }
    if (roomMemory.isEnemyRoom) {
      // delete existing remotes in this room
      this.room.memory.remotes = this.room.memory.remotes.filter(i => i.room === room.name);
      return;
    }
    sources.forEach(source => {
      const searchResult = PathFinder.search(spawn.pos, source.pos);
      const existingRemote = this.room.memory.remotes.find(
        i => i.room === source.room.name && i.x === source.pos.x && i.y === source.pos.y
      );
      /*       var isComplete =
        searchResult.path && searchResult.path[searchResult.path.length - 1].isNearTo(source.pos.x, source.pos.y); */

      var roomType = Cartographer.roomType(source.room.name);

      const maxDistance = this.room.memory.remotes.length < 6 ? 100 : 80;
      const maxRemotes = this.room.find(FIND_MY_SPAWNS).length * 4 + 2;

      if (existingRemote && !existingRemote.distance) {
        existingRemote.distance = searchResult.path.length;
      }

      /*       console.log(
        "Found potential remote at ",
        source.room.name,
        source.pos.x,
        source.pos.y,
        "distance=",
        searchResult.path.length
      ); */

      const allowSourceKeepRooms = this.room.controller && this.room.controller.level >= 8;

      if (
        (roomType !== "SK" || allowSourceKeepRooms) &&
        searchResult.path.length < maxDistance &&
        this.room.memory.remotes.length < maxRemotes &&
        !existingRemote
      ) {
        console.log(
          "Creating remote at ",
          source.room.name,
          source.pos.x,
          source.pos.y,
          "distance=",
          searchResult.path.length
        );
        this.room.memory.remotes.push({
          distance: searchResult.path.length,
          room: source.room.name,
          x: source.pos.x,
          y: source.pos.y,
          energyGeneration: 0,
          energy: 0,
          needsReservation: undefined,
          container: undefined,
          disabled: false
        });
      }
    });
  }
}

profiler.registerClass(ExplorationManager, "ExplorationManager");
