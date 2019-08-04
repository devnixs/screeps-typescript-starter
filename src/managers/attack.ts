import { findClosestRoom, getAttackFlag } from "utils/finder";
import { ExplorationManager } from "./exploration";
import { getMyRooms } from "utils/misc-utils";
import { generateAttackCreeps } from "./attack-analyst";

// This makes a quad
const attackPartyPositions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }];

export class AttackManager {
  static run() {
    AttackManager.setNeeds();
    AttackManager.checkAttackStatus();
    AttackManager.createAttackParties();
    AttackManager.stopAttackIfSuccessful();
    AttackManager.stopAttackIfFailed();
  }

  static checkAttackStatus() {
    if (Game.time % 5 > 0) {
      return;
    }
    const flag = getAttackFlag();
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
      Memory.attack.lastUpdateDate = Game.time;
    }
    this.setNeeds(true);
  }

  static stopAttackIfFailed() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    if (attack.parties.filter(i => i.failed).length >= 3) {
      // stop attack
      console.log("Too many attack failed. Stopping attack");
      const flag = getAttackFlag();
      if (flag) {
        flag.remove();
      }
    }
  }

  static stopAttackIfIdle() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    if (attack.lastUpdateDate < Game.time - 3000) {
      // stop attack
      console.log("Attack is idle. Stopping");
      const flag = getAttackFlag();
      if (flag) {
        flag.remove();
      }
    }
  }

  static stopAttackIfSuccessful() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    if (attack.parties.find(i => i.status === "complete")) {
      // stop attack
      console.log("Attack successful. Stopping attack");
      const flag = getAttackFlag();
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

    let partyInfo = generateAttackCreeps({
      fromRoom: attack.fromRoom,
      targetRoom: attack.toRoom,
      force: false
    });
    if (!partyInfo) {
      // stop attack
      console.log("WARNING: Cannot defeat this room. Trying anyway.");
      partyInfo = generateAttackCreeps({
        fromRoom: attack.fromRoom,
        targetRoom: attack.toRoom,
        force: true
      });
      if (!partyInfo) {
        console.log("I was not able to generate an attack party. aborting attack");
        this.stopAttack();
        return;
      }
    }

    var party = {
      boosted: true,
      count: partyInfo.creeps.length,
      creeps: [],
      mineralsNeeded: partyInfo.minerals,
      needs: partyInfo.creeps.map(creep => _.flatten(Object.keys(creep).map(part => _.fill(Array(creep[part]), part)))),
      id: Game.time,
      status: "forming",
      isApproxPath: true,
      ttl: 1500,
      failed: false
    } as AttackParty;

    console.log("Creating attack party ", JSON.stringify(party));

    if (partyInfo.minerals.length) {
      Game.rooms[attack.fromRoom].memory.boostMode = {
        minerals: partyInfo.minerals,
        reason: "attack"
      };
    }

    attack.parties.push(party);
  }

  static startAttack(fromRoom: string, toRoom: string) {
    console.log("Starting attack from ", fromRoom, "to", toRoom);

    const exploration = ExplorationManager.getExploration(toRoom);
    if (exploration) {
      if (exploration.eb) {
        console.log("Exploration Report: Enemy base level ", exploration.el);
      } else {
        console.log("Exploration Report: This room doesn't appear to be an enemy base");
      }
    } else {
      console.log("Exploration Report: We no nothing of this room.");
    }

    if (Memory.attack) {
      console.log("ERROR: attack already in progress");
      return;
    }

    Memory.attack = {
      fromRoom,
      toRoom,
      parties: [],
      lastUpdateDate: Game.time
    };
  }

  static stopAttack() {
    console.log("Stopping attack");

    const attack = Memory.attack;
    if (attack) {
      const boostMode = Game.rooms[attack.fromRoom].memory.boostMode;
      if (boostMode && boostMode.reason === "attack") {
        Game.rooms[attack.fromRoom].memory.boostMode = undefined;
      }
      Memory.attack = undefined;
    } else {
      console.log("ERROR: attack was already stopped");
    }
  }

  static setNeeds(force = false) {
    if (Game.time % 5 > 0 && !force) {
      return;
    }
    const attack = Memory.attack;

    var myRooms = getMyRooms();
    for (let room of myRooms) {
      if (!attack || room.name !== attack.fromRoom) {
        // this room has no reason to have attackers
        room.memory.needsAttackers = undefined;
      }
    }

    if (attack) {
      const sourceRoom = myRooms.find(i => i.name === attack.fromRoom);
      if (!sourceRoom) {
        return;
      }

      var formingParty = attack.parties.find(i => i.status === "forming");
      if (formingParty) {
        const attackersNeeded = formingParty.count - formingParty.creeps.length;
        if (sourceRoom && attackersNeeded > 0) {
          // if the attack hasn't started yet, make sure we can do it
          var readyness = AttackManager.isRoomReadyToStartAttack(attack.fromRoom);
          if (!sourceRoom.memory.needsAttackers && !readyness.ready) {
            console.log("Cannot create party: ", readyness.reason);
            return;
          }
          const currentCreepNeeded = formingParty.needs[formingParty.creeps.length];
          const mineralsNeeded = formingParty.mineralsNeeded;

          const labs = AttackManager.getLabs(Game.rooms[attack.fromRoom]);
          const mineralNotReady = mineralsNeeded.find(
            i =>
              !labs.find(
                j =>
                  j.lab.mineralType === i.mineral &&
                  j.lab.mineralAmount >= Math.min(i.requiredAmount, LAB_MINERAL_CAPACITY)
              )
          );

          if (mineralNotReady) {
            console.log("Cannot start attackers as we lack mineral ", mineralNotReady.mineral, "in labs");
            return;
          }

          console.log("Asking for spawn of creep #" + formingParty.creeps.length, JSON.stringify(currentCreepNeeded));

          sourceRoom.memory.needsAttackers = {
            boosted: mineralsNeeded.length > 0,
            count: 1,
            parts: currentCreepNeeded,
            partyId: formingParty.id
          };
        }
      } else {
        if (sourceRoom.memory.needsAttackers) {
          console.log("All creeps have been spawned");
        }
        // we have all the creeps we need
        sourceRoom.memory.needsAttackers = undefined;
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
