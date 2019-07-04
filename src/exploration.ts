import { getMyRooms, getUsername } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";

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

    this.room.memory.explorations = this.room.memory.explorations || [];

    const roomsToExplore = Cartographer.findRoomsInRange(this.room.name, 3);

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
      if (roomObj) {
        roomMemory.lastExplorationDate = Game.time;
      }
    });
  }

  analyzeRoom(room: Room, roomMemory: ExplorationDefinition) {
    // register if enemy
    roomMemory.isEnemyRoom =
      room.controller &&
      ((room.controller.owner && room.controller.owner.username !== getUsername()) ||
        (room.controller.reservation && room.controller.reservation.username !== getUsername()));

    // TODO: check sources
    const sources = room.find(FIND_SOURCES);
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return;
    }
    if (roomMemory.isEnemyRoom) {
      return;
    }
    sources.forEach(source => {
      const searchResult = PathFinder.search(spawn.pos, source.pos);
      const existingRemote = this.room.memory.remotes.find(
        i => i.room === source.room.name && i.x === source.pos.x && i.y === source.pos.y
      );

      if (!searchResult.incomplete && searchResult.path.length < 100 && !existingRemote) {
        this.room.memory.remotes.push({
          room: source.room.name,
          x: source.pos.x,
          y: source.pos.y,
          energyGeneration: undefined,
          energy: 0,
          needsReservation: undefined,
          container: undefined
        });
      }
    });
  }
}
