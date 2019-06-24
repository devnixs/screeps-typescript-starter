import { profiler } from "../utils/profiler";

interface LinkAndMemory {
  linkMemory: LinkMemory;
  linkObj: StructureLink;
}

const minTransferSize = 200;

export class LinkManager {
  constructor(private room: Room) {}

  run() {
    const debugMode = false;

    if (Game.time % 500 === 0 || debugMode || !this.room.memory.links) {
      this.assignLinks();
    }

    if (Game.time % 1 === 0 || debugMode) {
      this.doTransfers();
    }

    if (Game.time % 1 === 0 || debugMode) {
      this.setStates();
    }

    this.ensureLinkExists();
  }

  ensureLinkExists() {
    this.room.memory.links = this.room.memory.links || [];
    this.room.memory.links = this.room.memory.links.filter(i => !!Game.getObjectById(i.id));
  }

  static inputOutputLinkTargetEnergy() {
    return 800;
  }

  static totalEnergyInNetworkTarget() {
    return 800;
  }

  setStates() {
    const links = this.links;
    const totalEnergyInNetwork = _.sum(links.map(link => link.linkObj.energy));

    for (let index in links) {
      const link = links[index];
      if (link.linkMemory.type === "input-output") {
        if (
          link.linkObj.energy < LinkManager.inputOutputLinkTargetEnergy() &&
          totalEnergyInNetwork < LinkManager.totalEnergyInNetworkTarget()
        ) {
          link.linkMemory.needsAmount = LinkManager.inputOutputLinkTargetEnergy() - link.linkObj.energy;
          link.linkMemory.state = "needs-refill";
        } else if (link.linkObj.energy > LinkManager.inputOutputLinkTargetEnergy()) {
          link.linkMemory.needsAmount = link.linkObj.energy - LinkManager.inputOutputLinkTargetEnergy();
          link.linkMemory.state = "needs-emptying";
        } else if (link.linkObj.energy > 100 && totalEnergyInNetwork > LinkManager.totalEnergyInNetworkTarget()) {
          const excessEnergyInNetwork = totalEnergyInNetwork - LinkManager.totalEnergyInNetworkTarget();
          link.linkMemory.needsAmount = Math.max(link.linkObj.energy - excessEnergyInNetwork, 0);
          link.linkMemory.state = "needs-emptying";
        } else {
          link.linkMemory.state = "idle";
        }
      } else if (link.linkMemory.type === "input" && link.linkObj.energy < link.linkObj.energyCapacity) {
        link.linkMemory.state = "needs-refill";
        link.linkMemory.needsAmount = link.linkObj.energyCapacity - link.linkObj.energy;
      } else {
        link.linkMemory.state = "idle";
      }
    }
  }

  doTransfers() {
    const links = this.links.filter(i => i.linkObj && i.linkObj.cooldown === 0);
    for (let index in links) {
      const link = links[index];
      if (link.linkMemory.type === "input" && link.linkObj.energy > 0) {
        // needs to be emptied
        // find output link that is not full
        this.transferEnergyToAvailableLink(link, links, link.linkObj.energy);
      } else if (link.linkMemory.type === "input-output" && link.linkObj.energy > 0) {
        this.transferEnergyToAvailableLink(link, links, link.linkObj.energy);
      }
    }
  }

  static getLinksThatCanReceiveEnergy(pos: RoomPosition) {
    const linkMemories = Game.rooms[pos.roomName].memory.links || [];
    const inputLinks = linkMemories
      .filter(i => i.state === "needs-refill")
      .map(i => ({ link: Game.getObjectById(i.id) as StructureLink, amount: i.needsAmount, type: i.type }))
      .filter(i => i.link && i.link.energy < i.link.energyCapacity)
      .filter(i => i.link.pos.inRangeTo(pos.x, pos.y, 3) || i.type === "input-output");

    return inputLinks;
  }

  static getInputOutputLinkThatCanReceiveEnergy(pos: RoomPosition) {
    const linkMemories = Game.rooms[pos.roomName].memory.links || [];
    const inputLinks = linkMemories
      .filter(i => i.state === "needs-refill" && i.type === "input-output")
      .map(i => ({ link: Game.getObjectById(i.id) as StructureLink, amount: i.needsAmount, type: i.type }))
      .filter(i => i.link && i.link.energy < i.link.energyCapacity);

    return inputLinks[0];
  }

  static getInputLinkThatCanReceiveEnergy(pos: RoomPosition) {
    const linkMemories = Game.rooms[pos.roomName].memory.links || [];
    const inputLinks = linkMemories
      .filter(i => i.state === "needs-refill" && i.type === "input")
      .map(i => ({ link: Game.getObjectById(i.id) as StructureLink, amount: i.needsAmount, type: i.type }))
      .filter(i => i.link && i.link.energy < i.link.energyCapacity)
      .filter(i => i.link.pos.inRangeTo(pos.x, pos.y, 3));

    return inputLinks[0];
  }

  static getLinksToWithdrawEnergy(pos: RoomPosition) {
    const linkMemories = Game.rooms[pos.roomName].memory.links || [];
    const inputLinks = linkMemories
      .filter(i => i.type === "output")
      .map(i => ({ link: Game.getObjectById(i.id) as StructureLink, amount: i.needsAmount, type: i.type }))
      .filter(i => i.link)
      .filter(i => i.link.pos.inRangeTo(pos.x, pos.y, 5));

    return inputLinks;
  }

  transferEnergyToAvailableLink(link: LinkAndMemory, links: LinkAndMemory[], maxEnergyToTransfer: number) {
    console.log(link.linkMemory.id, link.linkMemory.type);
    let outputLinkNotFull = links.find(
      i =>
        i.linkMemory.type === "output" &&
        link.linkMemory.id !== i.linkMemory.id &&
        i.linkObj.energy < i.linkObj.energyCapacity - minTransferSize
    );
    console.log("Target : ", outputLinkNotFull && outputLinkNotFull.linkMemory.id);

    if (outputLinkNotFull) {
      link.linkObj.transferEnergy(outputLinkNotFull.linkObj);
    } else if (link.linkMemory.type === "input") {
      let inputOutputLinkNotFull = links.find(
        i =>
          i.linkMemory.type === "input-output" &&
          link.linkMemory.id !== i.linkMemory.id &&
          i.linkObj.energy < i.linkObj.energyCapacity - minTransferSize
      );
      console.log("Target : ", inputOutputLinkNotFull && inputOutputLinkNotFull.linkMemory.id);
      if (inputOutputLinkNotFull) {
        const energyCapacityAvailable =
          inputOutputLinkNotFull.linkObj.energyCapacity - inputOutputLinkNotFull.linkObj.energy;

        link.linkObj.transferEnergy(
          inputOutputLinkNotFull.linkObj,
          Math.min(energyCapacityAvailable, maxEnergyToTransfer)
        );
      }
    }
  }

  assignLinks() {
    var roomLinks: StructureLink[] = this.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === "link"
    }) as any;

    this.room.memory.links = roomLinks.map(link => this.createLink(link));
  }

  createLink(link: StructureLink): LinkMemory {
    const controller = this.room.controller;
    const storagesInRange = link.pos.findInRange(FIND_MY_STRUCTURES, 4, { filter: i => i.structureType === "storage" });
    if (storagesInRange.length > 0) {
      return {
        id: link.id,
        type: "input-output",
        state: "idle"
      };
    } else if (controller && link.pos.inRangeTo(controller.pos.x, controller.pos.y, 4)) {
      return {
        id: link.id,
        type: "output",
        state: "idle"
      };
    } else {
      return {
        id: link.id,
        type: "input",
        state: "idle"
      };
    }
  }

  get links(): LinkAndMemory[] {
    return this.room.memory.links
      .map(i => ({ linkMemory: i, linkObj: Game.getObjectById(i.id) as StructureLink }))
      .filter(i => i.linkObj);
  }

  static runForAllRooms() {
    for (let roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller && room.controller.my) {
        const manager = new LinkManager(room);
        manager.run();
      }
    }
  }
}

profiler.registerClass(LinkManager, "LinkManager");
