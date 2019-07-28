import { findClosestRoom } from "utils/finder";
import { ExplorationManager } from "./exploration";
import { getMyRooms } from "utils/misc-utils";

// This makes a quad
const attackPartyPositions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }];

export class AttackManager {
  static run() {
    AttackManager.setNeeds();
    AttackManager.checkAttackStatus();
    AttackManager.createAttackParties();
  }

  static checkAttackStatus() {
    if (Game.time % 5 > 0) {
      return;
    }
    const flag = Game.flags["attack"];
    if (!Memory.attack && flag) {
      var closestRoom = findClosestRoom(flag.pos.roomName, i => (i.controller ? i.controller.level >= 6 : false));
      if (closestRoom) {
        const isRoomReady = this.isRoomReadyToStartAttack(closestRoom);

        if (isRoomReady.ready) {
          AttackManager.startAttack(closestRoom, flag.pos.roomName);
        } else {
          console.log(
            "Cannot start attack : " + isRoomReady.reason,
            "from room ",
            closestRoom,
            "to room",
            flag.pos.roomName
          );
        }
      }
    }

    if (Memory.attack && !flag) {
      AttackManager.stopAttack();
    }
  }

  static assignToAttackParty(creepName: string, attackPartyId: number) {
    if (Memory.attack) {
      var party = Memory.attack.parties.find(i => i.id === attackPartyId);
      if (party) {
        const currentPosition = attackPartyPositions[party.creeps.length];
        party.creeps.push({
          name: creepName,
          ...currentPosition
        });
      }
    }
    this.setNeeds(true);
  }

  static stopAttackIfFailed() {
    const attack = Memory.attack;
    if (!attack) {
      return;
    }

    if (attack.parties.filter(i => i.failed).length >= 3) {
      // stop attack
      console.log("Too many attack failed. Stop attack");
      const flag = Game.flags["attack"];
      if (flag) {
        flag.remove();
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
    const existingParty = attack.parties.find(i => i.status !== "dead" && (!i.distance || i.distance <= i.ttl - 150));
    if (existingParty) {
      return;
    }

    var ready = AttackManager.isRoomReadyToStartAttack(attack.fromRoom);
    if (!ready.ready) {
      console.log("Cannot create party: ", ready.reason);
      return;
    }

    const targetInformation = ExplorationManager.getExploration(attack.toRoom);
    if (targetInformation) {
      // TODO: decide if we need to boost our creeps
    }
    var party = {
      boosted: true,
      count: 4,
      creeps: [],
      id: Game.time,
      status: "forming",
      isApproxPath: true,
      ttl: 1500,
      failed: false
    } as AttackParty;

    console.log("Creating attack party ", JSON.stringify(party));
    attack.parties.push(party);
  }

  static startAttack(fromRoom: string, toRoom: string) {
    console.log("Starting attack from ", fromRoom, "to", toRoom);

    if (Memory.attack) {
      console.log("ERROR: attack already in progress");
      return;
    }

    Memory.attack = {
      fromRoom,
      toRoom,
      parties: []
    };

    Game.rooms[fromRoom].memory.boostMode = {
      reason: "attack",
      parts: [HEAL, RANGED_ATTACK]
    };
  }

  static stopAttack() {
    console.log("Stopping attack");

    const attack = Memory.attack;
    if (attack) {
      Game.rooms[attack.fromRoom].memory.boostMode = undefined;
      Memory.attack = undefined;
    } else {
      console.log("ERROR: attack was already stopped");
    }
  }

  static setNeeds(force = false) {
    if (Game.time % 5 > 0 && !force) {
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
            count: formingParty.count,
            partyId: formingParty.id
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

    const attack = Memory.attack;
    if (attack) {
      const boostMode = Game.rooms[attack.fromRoom].memory.boostMode;
      if (boostMode && boostMode.reason === "attack") {
        // check that boosts have been dispatched
        const labs = AttackManager.getLabs(Game.rooms[attack.fromRoom]);
        const labNotReady = labs.find(i =>
          i.memory.boostBodyType && (i.memory.needsResource !== i.lab.mineralType || i.lab.mineralAmount < 2000)
            ? true
            : false
        );
        if (labNotReady) {
          return {
            ready: false,
            reason: `Lab not ready : ${labNotReady.lab.id} needs ${labNotReady.memory.needsAmount} ${
              labNotReady.memory.needsResource
            }`
          };
        }
      }
    }

    /*     var storage = room.storage;
    if (!storage || storage.store.energy < storage.storeCapacity * 0.1) {
      return {
        ready: false,
        reason: `No enough energy in storage`
      };
    } */

    return {
      ready: true,
      reason: `All conditions are fulfiled`
    };
  }
  static getLabs(room: Room) {
    var groups = room.memory.labGroups || [];
    const labs = _.flatten(groups.map(i => i.labResults.concat([i.labSource1, i.labSource2])));
    return labs.map(i => ({ lab: Game.getObjectById(i.id) as StructureLab, memory: i })).filter(i => i.lab);
  }
}

interface ReadyReason {
  ready: boolean;
  reason: string;
}
