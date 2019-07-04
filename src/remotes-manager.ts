import { getMyRooms } from "utils/misc-utils";
import { findEmptySpotCloseTo } from "utils/finder";
import { ILongDistanceTruckMemory } from "roles/longdistancetruck";

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
    this.checkReservation();
    // this.checkHasTooMuchEnergy();
    this.checkEnergyGeneration();
  }

  createRoads() {
    const remotes = this.room.memory.remotes;
    if (Game.time % 1000 === 0 && remotes.length) {
      const homeSpawn = this.room.find(FIND_MY_SPAWNS)[0];

      const rnd = Math.floor(Math.random() * remotes.length);
      const remote = remotes[rnd];

      this.iterateFromAtoB(homeSpawn.pos, new RoomPosition(remote.x, remote.y, remote.room), (pos, index, isLast) => {
        const room = Game.rooms[pos.roomName];
        if (room) {
          const structureExists = room.lookForAt("structure", pos.x, pos.y)[0];
          const constructionSiteExists = room.lookForAt("constructionSite", pos.x, pos.y)[0];
          if (!constructionSiteExists && !structureExists && pos.x > 0 && pos.x < 49 && pos.y > 0 && pos.y < 49) {
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
    const trucks = this.remoteTrucks();
    const availableTrucks = trucks.filter(
      i =>
        (i.memory as ILongDistanceTruckMemory).targetContainer === undefined &&
        !(i.memory as ILongDistanceTruckMemory).depositing
    );

    const remotes = _.sortBy(
      this.room.memory.remotes.filter(
        i =>
          i.container &&
          trucks.filter(t => (t.memory as ILongDistanceTruckMemory).targetContainer === i.container).length < 3
      ),
      i => -1 * i.energy
    );

    if (!remotes.length) {
      return;
    }

    for (var index = 0; index < availableTrucks.length; index++) {
      const remote = remotes[index % remotes.length];
      const truck = availableTrucks[index];

      const memory = truck.memory as ILongDistanceTruckMemory;
      memory.targetContainer = remote.container;
      truck.say("G" + remote.energy);
    }
  }

  availableRemoteTrucks() {
    const allCreeps = _.values(Game.creeps) as Creep[];
    return allCreeps.filter(
      i =>
        i.memory.homeRoom === this.room.name &&
        i.memory.role === "long-distance-truck" &&
        (i.memory as ILongDistanceTruckMemory).targetContainer === undefined &&
        !(i.memory as ILongDistanceTruckMemory).depositing
    );
  }

  remoteTrucks() {
    const allCreeps = _.values(Game.creeps) as Creep[];
    return allCreeps.filter(i => i.memory.homeRoom === this.room.name && i.memory.role === "long-distance-truck");
  }

  checkReservation() {
    if (Game.time % 10 > 0) {
      return;
    }
    this.room.memory.remotes.forEach(remote => {
      const targetRoom = Game.rooms[remote.room];
      if (!targetRoom || !targetRoom.controller) {
        remote.needsReservation = false;
      } else {
        const isUnderThreshold =
          !targetRoom.controller.reservation || targetRoom.controller.reservation.ticksToEnd < 3000;

        // const hasStorage = this.room.storage;

        remote.needsReservation = !!isUnderThreshold; // && !hasStorage;
      }
    });
  }

  checkEnergyGeneration() {
    if (Game.time % 10 > 0) {
      return;
    }
    this.room.memory.remotes.forEach(remote => {
      const targetRoom = Game.rooms[remote.room];
      if (!targetRoom) {
        remote.energyGeneration = 0;
      } else {
        const source = targetRoom.lookForAt("source", remote.x, remote.y)[0];
        if (!source) {
          remote.energyGeneration = 0;
        } else {
          const generation = Math.ceil(source.energyCapacity / 300);
          remote.energyGeneration = generation;
        }
      }
    });
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
        const homeSpawn = this.room.find(FIND_MY_SPAWNS)[0];

        this.iterateFromAtoB(homeSpawn.pos, new RoomPosition(remote.x, remote.y, remote.room), (pos, index, isLast) => {
          const room = Game.rooms[pos.roomName];
          if (room && isLast) {
            targetRoom.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
          }
        });
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
