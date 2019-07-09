import { getMyRooms } from "utils/misc-utils";

export class UpgradeManager {
  constructor(private room: Room) {}

  static runForAllRooms() {
    const rooms = getMyRooms();
    rooms.forEach(room => {
      const manager = new UpgradeManager(room);
      manager.run();
    });
  }

  run() {
    if (Game.time % 10 > 0) {
      return;
    }

    if (!this.room.controller) {
      return;
    }

    if ("sim" in Game.rooms) {
      this.room.memory.upgraderType = "static";
      this.room.memory.upgraderRatio = 0;
      return;
    }

    const storage = this.room.storage;

    if (storage) {
      const closestLink = storage.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "link"
      });
      const controller = this.room.controller;

      const linkDistance = closestLink ? closestLink.pos.getRangeTo(controller) : 10000;
      const storageDistance = storage.pos.getRangeTo(controller);

      const distance = Math.min(linkDistance, storageDistance);

      if (distance >= 6) {
        this.room.memory.upgraderType = "mobile";
      } else {
        this.room.memory.upgraderType = "static";
      }

      this.room.memory.upgraderRatio = Math.ceil(Math.pow(storage.store.energy / 100000, 2) * 2);
    } else {
      const containers = this.room.containers;
      if (containers.length === 0) {
        this.room.memory.upgraderRatio = 1;
        this.room.memory.upgraderType = "mobile";
      } else {
        const totalStorage = _.sum(containers.map(i => i.storeCapacity));
        const totalEnergy = _.sum(containers.map(i => i.store.energy));

        const ratio = totalEnergy / totalStorage;
        if (ratio >= 0.7) {
          this.room.memory.upgraderRatio = 20;
        } else if (ratio >= 0.5) {
          this.room.memory.upgraderRatio = 10;
        } else if (ratio >= 0.25) {
          this.room.memory.upgraderRatio = 3;
        } else if (ratio >= 0.1) {
          this.room.memory.upgraderRatio = 2;
        } else {
          this.room.memory.upgraderRatio = 0;
        }
      }

      this.room.memory.upgraderType = "mobile";
    }
  }
}
