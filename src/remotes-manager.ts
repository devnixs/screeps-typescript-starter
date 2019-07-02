import { getMyRooms } from "utils/misc-utils";
import { findEmptySpotCloseTo } from "utils/finder";
import { ILongDistanceTruckMemory } from "roles/longdistancetruck";
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from "constants";

export class RemotesManager {
  constructor(private room: Room) {}

  static runForAllRooms() {
    const rooms = getMyRooms();
    rooms.forEach(room => {
      const manager = new RemotesManager(room);
      manager.run();
    });
  }

  run() {
    const memory = this.room.memory;
    if (!memory.remotes) {
      memory.remotes = [];
    }

    memory.remotes.forEach(remote => {
      this.runForOneRemote(remote);
    });

    this.assignTrucks();
    this.createRoads();
  }

  createRoads() {
    const remotes = this.room.memory.remotes;
    if (Game.time % 1000 === 0 && remotes.length) {
      console.log("Creating roads");
      const homeSpawn = this.room.find(FIND_MY_SPAWNS)[0];

      const rnd = Math.floor(Math.random() * remotes.length);
      const remote = remotes[rnd];

      this.iterateFromAtoB(homeSpawn.pos, new RoomPosition(remote.x, remote.y, remote.room), (pos, index, isLast) => {
        console.log("Found path", pos.x, pos.y, pos.roomName);
        const room = Game.rooms[pos.roomName];
        if (room) {
          console.log("Found room", pos.x, pos.y, pos.roomName);
          const structureExists = room.lookForAt("structure", pos.x, pos.y)[0];
          const constructionSiteExists = room.lookForAt("constructionSite", pos.x, pos.y)[0];
          if (!constructionSiteExists && !structureExists) {
            const constructionSiteResult = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
            if (constructionSiteResult !== OK) {
              console.log("Construction site result = ", constructionSiteResult);
            }
          }
        }
      });
    }
  }

  iterateFromAtoB(
    pos1: RoomPosition,
    pos2: RoomPosition,
    callback: (pos: RoomPosition, index: number, isLast: boolean) => void
  ) {
    const result = PathFinder.search(pos1, [{ pos: pos2, range: 1 }]);

    if (result && result.path) {
      for (let stepIndex in result.path) {
        let pos = result.path[stepIndex];
        callback(pos, Number(stepIndex), Number(stepIndex) === result.path.length - 1);
      }
    }
  }

  assignTrucks() {
    const remotes = _.sortBy(this.room.memory.remotes.filter(i => i.container), i => -1 * i.energy);
    const trucks = this.availableRemoteTrucks();
    for (var index = 0; index < Math.min(remotes.length, trucks.length); index++) {
      const remote = remotes[index];
      const truck = trucks[index];

      const memory = truck.memory as ILongDistanceTruckMemory;
      remote.assignedTruck = truck.id;
      memory.targetContainer = remote.container;
    }
  }

  availableRemoteTrucks() {
    const allCreeps = _.values(Game.creeps) as Creep[];
    return allCreeps.filter(i => i.memory.homeRoom === this.room.name && i.memory.role === "long-distance-truck");
  }

  runForOneRemote(remote: RemoteRoomDefinition) {
    const targetRoom = Game.rooms[remote.room];
    if (!targetRoom) {
      return;
    }
    const source = targetRoom.lookForAt("source", remote.x, remote.y)[0];

    if (!source) {
      // delete remote
      console.log("Deleting remote " + JSON.stringify(remote));
      this.room.memory.remotes = this.room.memory.remotes.filter(i => i != remote);
      return;
    }

    this.createContainer(remote, targetRoom, source);

    const container = Game.getObjectById(remote.container) as StructureContainer;
    if (!container) {
      remote.energy = 0;
      return;
    }

    remote.energy = container.store.energy;
  }

  createContainer(remote: RemoteRoomDefinition, targetRoom: Room, source: Source) {
    if (!remote.container) {
      // either assign it or create it

      const container = targetRoom.find(FIND_STRUCTURES, {
        filter: i => i.structureType === "container" && i.pos.isNearTo(source)
      })[0];

      const constructionSite = targetRoom.find(FIND_CONSTRUCTION_SITES, {
        filter: i => i.structureType === "container" && i.pos.isNearTo(source)
      })[0];
      if (constructionSite) {
        // do nothing
        return;
      }

      if (!container) {
        const emptySpot = findEmptySpotCloseTo({ x: source.pos.x, y: source.pos.y }, targetRoom);
        if (emptySpot) {
          targetRoom.createConstructionSite(emptySpot.x, emptySpot.y, STRUCTURE_CONTAINER);
        }
      } else {
        remote.container = container.id;
      }
    } else {
      const obj = Game.getObjectById(remote.container);
      if (!obj) {
        remote.container = undefined;
      }
    }
  }
}
