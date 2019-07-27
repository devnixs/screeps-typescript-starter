import { findClosestRoom } from "utils/finder";
import { ExplorationManager } from "./exploration";
import { getMyRooms } from "utils/misc-utils";

let lastFlagStatus: Flag | undefined;

// This makes a quad
const attackPartyPositions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

export class AttackManager {
  static run() {
    AttackManager.setNeeds();
    AttackManager.checkAttackStatus();
  }

  static checkAttackStatus() {
    if (Game.time % 5 > 0) {
      return;
    }
    const flag = Game.flags["attack"];
    if (!lastFlagStatus && flag) {
      var closestRoom = findClosestRoom(flag.pos.roomName);
      if (closestRoom) {
        const isRoomReady = this.isRoomReadyToStartAttack(closestRoom);

        if (isRoomReady.ready) {
          lastFlagStatus = flag;
          AttackManager.startAttack(closestRoom, flag.pos.roomName);
        } else {
          console.log("Cannot start attack : " + isRoomReady.reason);
        }
      }
    }

    if (lastFlagStatus && !flag) {
      lastFlagStatus = undefined;
    }
  }

  static assignToAttackParty(creep: Creep, attackPartyId: number) {
    if (Memory.attack) {
      var party = Memory.attack.parties.find(i => i.id === attackPartyId);
      if (party) {
        const currentPosition = attackPartyPositions[party.creeps.length];
        party.creeps.push({
          id: creep.id,
          ...currentPosition
        });
      }
    }
  }

  static createAttackParties() {
    if (Game.time % 5 > 0) {
      return;
    }

    const attack = Memory.attack;
    if (!attack) {
      return;
    }
    var ready = AttackManager.isRoomReadyToStartAttack(attack.fromRoom);
    if (!ready.ready) {
      console.log("Cannot create party: ", ready.reason);
      return;
    }

    const existingParty = attack.parties.find(
      i => i.status === "forming" || i.status === "moving" || i.status === "attacking"
    );
    if (existingParty) {
      return;
    }
    const targetInformation = ExplorationManager.getExploration(attack.toRoom);
    if (targetInformation) {
      // TODO: decide if we need to boost our creeps
    }

    attack.parties.push({
      boosted: false,
      count: 4,
      creeps: [],
      id: Game.time,
      status: "forming"
    });
  }

  static startAttack(fromRoom: string, toRoom: string) {
    console.log("Starting attack from ", fromRoom, "to", toRoom);

    Memory.attack = {
      fromRoom,
      toRoom,
      parties: []
    };
  }
  static setNeeds() {
    if (Game.time % 5 > 0) {
      return;
    }

    var myRooms = getMyRooms();
    for (let room of myRooms) {
      room.memory.needsAttackers = undefined;
    }

    const attack = Memory.attack;
    if (attack) {
      const sourceRoom = myRooms.find(i => i.name === attack.fromRoom);
      var formingParty = attack.parties.find(i => i.status === "forming");
      if (formingParty) {
        const attackersNeeded = formingParty.count - formingParty.creeps.length;
        if (sourceRoom && attackersNeeded > 0) {
          sourceRoom.memory.needsAttackers = {
            boosted: formingParty.boosted,
            count: attackersNeeded
          };
        }
      }
    }
  }

  static isRoomReadyToStartAttack(roomName: string): ReadyReason {
    const room = Game.rooms[roomName];
    if (!room) {
      return {
        ready: false,
        reason: "Room not found"
      };
    }
    if (room.memory.isUnderSiege) {
      return {
        ready: false,
        reason: "Under siege"
      };
    }

    var availableTrucks = Object.keys(Game.creeps)
      .map(i => Game.creeps[i])
      .filter(i => i.memory.role === "truck" && i.memory.homeRoom === roomName);

    if (availableTrucks.length < 2) {
      return {
        ready: false,
        reason: "not enough trucks"
      };
    }

    var trucksThatNeedsToBeRenewedSoon = availableTrucks.find(i => !i.ticksToLive || i.ticksToLive < 300);
    if (trucksThatNeedsToBeRenewedSoon) {
      return {
        ready: false,
        reason: `Truck ${trucksThatNeedsToBeRenewedSoon} will die soon`
      };
    }

    var storage = room.storage;
    if (!storage || storage.store.energy < storage.storeCapacity * 0.2) {
      return {
        ready: false,
        reason: `No enough energy in storage`
      };
    }

    return {
      ready: true,
      reason: `All conditions are fulfiled`
    };
  }
}

interface ReadyReason {
  ready: boolean;
  reason: string;
}
