import { getMyRooms, paddingLeft } from "utils/misc-utils";
import { findEmptySpotCloseTo } from "utils/finder";
import { ILongDistanceTruckMemory } from "roles/longdistancetruck";
import { profiler } from "utils/profiler";
import { Cartographer } from "utils/cartographer";
import { Traveler } from "utils/Traveler";
import { getReduceUsageRatio } from "utils/cpu";

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

    if (this.room.spawns.length === 0) {
      // this room has been wiped.
      return;
    }

    if (Game.time % 4 === 0) {
      memory.remotes.forEach(remote => {
        this.runForOneRemote(remote);
      });
    }

    this.assignTrucks();
    this.createRoads();
    this.checkReservation();
    // this.checkHasTooMuchEnergy();
    this.checkEnergyGeneration();
    this.disableNotRentableRooms();
    this.checkRoomLevel();
    this.ensureRemotesAreValid();
  }

  checkRoomLevel() {
    if (Game.time % 1001 > 0) {
      return;
    }
    if (!this.room.memory.lastRemoteCheckCtrlLevel) {
      this.room.memory.lastRemoteCheckCtrlLevel = this.room.controller && this.room.controller.level;
    }

    if (
      this.room.controller &&
      this.room.memory.lastRemoteCheckCtrlLevel &&
      this.room.controller.level > this.room.memory.lastRemoteCheckCtrlLevel
    ) {
      this.room.memory.lastRemoteCheckCtrlLevel = this.room.controller.level;
      this.levelUp(this.room.controller.level);
    }
  }

  levelUp(newLevel: number) {
    if (newLevel === 8 || newLevel === 7) {
      this.resetRemoteStats();
    }
  }

  ensureRemotesAreValid() {
    if (Game.time % 100 > 0) {
      return;
    }
    this.room.memory.remotes = _.uniq(this.room.memory.remotes, i => i.x + "-" + i.y + "-" + i.room);

    const countsByRoom = _.countBy(this.room.memory.remotes, i => i.room);

    _.forEach(countsByRoom, (value, key) => {
      if (value > 3) {
        console.log("Removing all remotes in room " + key);
        this.room.memory.remotes = this.room.memory.remotes.filter(i => i.room !== key);
      }
    });

    // make sure sources exists
    this.room.memory.remotes = this.room.memory.remotes.filter(remote => {
      const targetRoom = Game.rooms[remote.room];
      if (!targetRoom) {
        return true;
      } else {
        if (targetRoom.controller && targetRoom.controller.owner) {
          return false;
        }

        const source = targetRoom.lookForAt("source", remote.x, remote.y)[0];

        if (!source) {
          // delete remote
          console.log("Deleting remote " + JSON.stringify(remote));
          return false;
        } else {
          return true;
        }
      }
    });
  }

  resetRemoteStats() {
    this.room.memory.remotes
      .filter(i => i)
      .forEach(i => {
        delete i.retrievedEnergy;
        delete i.spentEnergy;
      });
  }

  static outputStats() {
    getMyRooms().forEach(room => {
      if (!room.memory || !room.memory.remotes || !room.memory.remotes.length) {
        return;
      }
      console.log("### " + room.name + " ###");
      const text = _.sortBy(room.memory.remotes.filter(i => i.spentEnergy && i.spentEnergy > 0), i =>
        i.retrievedEnergy && i.spentEnergy ? i.retrievedEnergy / i.spentEnergy : 0
      )
        .map(
          i =>
            paddingLeft("      ", i.room) +
            paddingLeft("       ", ":" + i.x + "," + i.y) +
            paddingLeft("         ", Math.round((i.retrievedEnergy || 0) / 1000)) +
            "K" +
            paddingLeft("         ", Math.round((i.spentEnergy || 0) / 1000)) +
            "K" +
            paddingLeft("         ", Math.round(((i.retrievedEnergy || 0) / (i.spentEnergy || 0)) * 100) / 100) +
            (i.disabled ? " Disabled" : " Enabled")
        )
        .join("\n");
      console.log(text);
    });
  }

  disableNotRentableRooms() {
    if (Game.time % 104 > 0) {
      return;
    }

    const spawns = this.room.find(FIND_MY_SPAWNS).length;
    let maxTravelAllowed = Math.min(spawns, 2) * 400 + 100;
    let maxRemotesAllowed = Math.min(spawns, 2) * 4 + 2;

    maxTravelAllowed = getReduceUsageRatio() * maxTravelAllowed;
    maxRemotesAllowed = getReduceUsageRatio() * maxRemotesAllowed;

    // enable all
    this.room.memory.remotes.forEach(i => (i.disabled = false));

    // disable non possible rooms
    this.room.memory.remotes
      .filter(i => !this.canEnableRemote(i) || !this.canEnableRoom(i.room))
      .forEach(i => (i.disabled = true));

    let remotes = this.getEnabledRemotes();
    let currentTravel = _.sum(remotes.map(i => i.distance));

    while (currentTravel > maxTravelAllowed || remotes.length > maxRemotesAllowed) {
      // disable worst room
      remotes = this.getEnabledRemotes();
      const rooms = _.uniq(remotes.map(i => i.room));
      const roomsSorted = _.sortBy(rooms, room => {
        const remotesInThisRoom = this.getEnabledRemotes().filter(i => i.room === room);
        const points = remotesInThisRoom.map(i => i.distance);
        let average = _.sum(points) / points.length;

        if (points.length >= 2) {
          // bonus when there are multiple sources in the same room
          average = average / (1 + points.length / 20);
        }

        // console.log("Room ", room, "has average", average);
        return -1 * average;
      });

      const worstRoom = roomsSorted[0];
      if ("debug_mode" in Game.flags) {
        console.log(
          "Disabling room ",
          worstRoom,
          "because currentTravel > maxTravelAllowed =",
          currentTravel > maxTravelAllowed,
          currentTravel,
          maxTravelAllowed,
          "and remotes.length > maxRemotesAllowed=",
          remotes.length > maxRemotesAllowed,
          remotes.length,
          maxRemotesAllowed
        );
      }

      remotes
        .filter(i => i.room === worstRoom)
        .forEach(remote => {
          remote.disabled = true;
        });

      remotes = this.getEnabledRemotes();
      currentTravel = _.sum(remotes.map(i => i.distance));
    }
  }

  canEnableRemote(remote: RemoteRoomDefinition) {
    // prevent enabling if it's already enabled in someone else' room
    const otherRemotes = _.flatten(
      getMyRooms()
        .filter(i => i.name !== this.room.name)
        .map(i => i.memory.remotes)
    );
    const foundInOtherRemote = otherRemotes.find(
      i => i.room === remote.room && i.x === remote.x && i.y === remote.y && !i.disabled
    );
    return !foundInOtherRemote;
  }

  canEnableRoom(room: string) {
    const ctrlLevel = this.room.controller ? this.room.controller.level : 0;
    if (ctrlLevel < 3) {
      return false;
    }

    const remotesInThisRoom = this.room.memory.remotes.filter(i => i.room === room);
    if (remotesInThisRoom.length === 0) {
      return false;
    }
    if (Cartographer.roomType(room) === "SK" && ctrlLevel < 8) {
      return false;
    }
    if (Cartographer.roomType(room) === "CORE" && ctrlLevel < 8) {
      return false;
    }

    const totalSpent = _.sum(remotesInThisRoom.map(i => i.spentEnergy)) / remotesInThisRoom.length;
    const totalRetrieved = _.sum(remotesInThisRoom.map(i => i.retrievedEnergy)) / remotesInThisRoom.length;

    if (totalSpent > 0) {
      const ratio = totalRetrieved / totalSpent;
      if (totalSpent > 50000 && ratio < 1.4) {
        // disable this room;
        return false;
      }
      if (totalSpent > 25000 && ratio < 1) {
        // disable this room;
        return false;
      }
    }
    return true;
  }

  getEnabledRemotes() {
    return this.room.memory.remotes.filter(i => !i.disabled);
  }

  createRoads() {
    const remotes = this.getEnabledRemotes();
    if (Game.time % 300 === 0 && remotes.length) {
      const homeSpawn = this.room.find(FIND_MY_SPAWNS)[0];

      const rnd = Math.floor(Math.random() * remotes.length);
      const remote = remotes[rnd];
      // console.log("Creating remote roads", JSON.stringify(remote));

      this.iterateFromAtoB(homeSpawn.pos, new RoomPosition(remote.x, remote.y, remote.room), (pos, index, isLast) => {
        const room = Game.rooms[pos.roomName];
        if (room) {
          const structureExists = room.lookForAt("structure", pos.x, pos.y).find(i => i.structureType !== "rampart");
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
    const result = Traveler.findTravelPath(pos1, pos2, {
      range: 1,
      obstacles: this.room.memory.roomPlanner
        ? this.room.memory.roomPlanner.structures
            .filter(i => i.type !== "rampart" && i.type !== "road")
            .map(i => ({ pos: new RoomPosition(i.x, i.y, this.room.name) }))
        : []
    });

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
      this.getEnabledRemotes().filter(i => {
        const maxTrucks = i.energy > 3000 ? 4 : 3;

        return (
          i.container &&
          trucks.filter(
            t =>
              (t.memory as ILongDistanceTruckMemory).targetContainer === i.container &&
              !(t.memory as ILongDistanceTruckMemory).depositing
          ).length < maxTrucks
        );
      }),
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
    this.getEnabledRemotes().forEach(remote => {
      const targetRoom = Game.rooms[remote.room];
      if (!targetRoom || !targetRoom.controller) {
        remote.needsReservation = false;
      } else {
        const isUnderThreshold =
          !targetRoom.controller.reservation || targetRoom.controller.reservation.ticksToEnd < 3000;

        const hasLotsOfWastedEnergy =
          _.sum(
            targetRoom.find(FIND_DROPPED_RESOURCES, { filter: i => i.resourceType === "energy" }).map(i => i.amount)
          ) > 3000;

        // const hasStorage = this.room.storage;

        remote.needsReservation = !!isUnderThreshold && !hasLotsOfWastedEnergy;
      }
    });
  }

  checkEnergyGeneration() {
    if (Game.time % 10 > 0) {
      return;
    }
    this.getEnabledRemotes().forEach(remote => {
      const targetRoom = Game.rooms[remote.room];
      if (!targetRoom) {
        remote.energyGeneration = 0;
        remote.wastedEnergy = false;
        remote.ratio = 1;
      } else {
        const source = targetRoom.lookForAt("source", remote.x, remote.y)[0];

        if (Cartographer.roomType(targetRoom.name) === "SK") {
          remote.ratio = 1.5;
        } else {
          remote.ratio = 1;
        }

        if (!source) {
          remote.energyGeneration = 0;
          remote.wastedEnergy = false;
        } else {
          const generation = Math.ceil(source.energyCapacity / 300);
          remote.energyGeneration = generation;

          const hasLotsOfWastedEnergy =
            _.sum(
              source.pos
                .findInRange(FIND_DROPPED_RESOURCES, 2, { filter: i => i.resourceType === "energy" })
                .map(i => i.amount)
            ) > 1500;
          remote.wastedEnergy = hasLotsOfWastedEnergy;
        }
      }
    });
  }

  runForOneRemote(remote: RemoteRoomDefinition) {
    const targetRoom = Game.rooms[remote.room];
    if (!targetRoom) {
      return;
    }

    if (remote.disabled) {
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

    const droppedEnergy = targetRoom.lookForAt(LOOK_RESOURCES, container).find(i => i.resourceType === "energy");

    remote.energy = container.store.energy + (droppedEnergy ? droppedEnergy.amount : 0);
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

profiler.registerClass(RemotesManager, "RemotesManager");

(global as any).resetRemoteStats = function(roomName?: string) {
  _.flatten(
    Object.keys(Game.rooms)
      .map(i => Game.rooms[i])
      .map(room => room.memory.remotes)
  )
    .filter(i => i && (!roomName || i.room === roomName))
    .forEach(i => {
      delete i.retrievedEnergy;
      delete i.spentEnergy;
    });

  console.log("Resetted Stats");
};

(global as any).outputRemoteStats = RemotesManager.outputStats;
