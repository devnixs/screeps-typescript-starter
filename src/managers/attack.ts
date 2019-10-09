import { findClosestRoom, getAttackFlag } from "utils/finder";
import { getMyRooms, hasSafeModeAvailable } from "utils/misc-utils";
import { generateAttackCreeps } from "./attack-analyst";
import { ExplorationCache } from "utils/exploration-cache";
import { Cartographer } from "utils/cartographer";
import { profiler } from "utils/profiler";
import { getCreepsByRoleAndRoom } from "utils/creeps-cache";
import { setTimeout } from "utils/set-timeout";

// This makes a quad
const attackPartyPositions = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 }
];

export class AttackManager {
  static run() {
    AttackManager.setNeeds();
    AttackManager.checkAttackStatus();
    AttackManager.createAttackParties();
    AttackManager.stopAttackIfSuccessful();
    AttackManager.stopAttackIfFailed();
    AttackManager.stopAttackIfIdle();
    AttackManager.stopAttackIfExpired();
    AttackManager.removeIdleParties();
    AttackManager.stopDefenseWhenItsNoLongerNecessary();
    AttackManager.relocateAttack();
  }

  static checkAttackStatus() {
    if (Game.time % 5 > 0) {
      return;
    }
    const flag = getAttackFlag();
    if (!Memory.attack && flag) {
      const roomsInRange = getMyRooms()
        .map(i => ({
          range: Cartographer.findRoomDistanceSum(i.name, flag.pos.roomName),
          room: i,
          lvl: i.controller ? i.controller.level : 0
        }))
        .filter(i => i.range <= 17);

      const highestLevelRoomInRange = _.sortBy(_.sortBy(roomsInRange, i => i.range), i => -1 * i.lvl)[0];

      var closestRoom = highestLevelRoomInRange && highestLevelRoomInRange.room.name;
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
      } else {
        console.log("Cannot find room in range for attack to ", flag.pos.roomName);
        flag.remove();
      }
    }

    if (Memory.attack && !flag) {
      console.log("Attack flag no longer exist. Stopping attack");
      AttackManager.stopAttack();
    }
  }

  static relocateAttack() {
    if (Game.time % 7 > 0) {
      return;
    }

    const flag = getAttackFlag();
    const attack = Memory.attack;
    if (flag && attack && flag.pos.roomName !== attack.toRoom) {
      console.log("Relocating attack from ", attack.toRoom, "to", flag.pos.roomName);
      attack.toRoom = flag.pos.roomName;
      attack.parties
        .filter(
          i =>
            i.status === "moving" ||
            i.status === "attacking" ||
            i.status === "safemode" ||
            i.status === "regrouping" ||
            i.status === "camping" ||
            i.status === "complete"
        )
        .forEach(party => {
          party.status = "moving";
          party.rallyPoint = undefined;
          party.attackPath = undefined;
        });
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

  static stopDefenseWhenItsNoLongerNecessary() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    const targetRoom = Game.rooms[attack.toRoom];
    if (!targetRoom) {
      return;
    }

    if (!targetRoom.controller || !targetRoom.controller.my) {
      return;
    }

    if (
      hasSafeModeAvailable(targetRoom) ||
      (targetRoom.controller && targetRoom.controller.level >= 6) ||
      (!targetRoom.memory.isUnderSiege && !targetRoom.memory.isRebuilding)
    ) {
      console.log("Defense is no longer necessary.");
      this.stopAttack();
    }
  }

  static removeIdleParties() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    const idleParty = attack.parties.find(
      i => i.creeps.length === 0 && i.status === "forming" && i.creationDate < Game.time - 300
    );
    if (idleParty) {
      // stop attack
      console.log("Removing idle attack party");
      attack.parties = attack.parties.filter(i => i !== idleParty);
    }
  }

  static stopAttackIfIdle() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    if (attack.lastUpdateDate < Game.time - 4000) {
      // stop attack
      console.log("Attack is idle. Stopping");
      const flag = getAttackFlag();
      if (flag) {
        flag.remove();
      }
    }
  }

  static stopAttackIfExpired() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    const flag = Game.flags["attack"];
    const memory = flag && (flag.memory as AttackFlagMemory);
    const nonDeadParties = attack.parties.find(i => i.status !== "dead" && i.status !== "forming");

    if (flag && memory && memory.expiration && memory.expiration + 300 < Game.time && !nonDeadParties) {
      // stop attack
      console.log("Attack is expired. Stopping");
      flag.remove();
    }
  }

  static isAlmostExpired() {
    const flag = Game.flags["attack"];
    const memory = flag && (flag.memory as AttackFlagMemory);

    if (flag && memory && memory.expiration && memory.expiration < Game.time + 500) {
      return true;
    } else {
      return false;
    }
  }

  static stopAttackIfSuccessful() {
    const attack = Memory.attack;
    if (!attack || Game.time % 5 > 0) {
      return;
    }

    if (attack.parties.find(i => i.status === "complete")) {
      // stop attack
      console.log("Attack successful. (complete)");
      this.stopOrGoToNextAttackRoom();
    }

    const safeModeParty = attack.parties.find(i => i.status === "safemode");

    if (safeModeParty) {
      // stop attack
      console.log("Attack successful (safemode activated).");
      Memory.nextAttack = {
        room: attack.toRoom,
        time: Game.time + SAFE_MODE_DURATION
      };
      this.stopOrGoToNextAttackRoom();
    }
  }

  static stopOrGoToNextAttackRoom() {
    const flag = getAttackFlag();
    if (flag) {
      (flag.memory as AttackFlagMemory).expiration = Game.time;

      const nextTarget = Game.flags.next_target;
      if (nextTarget) {
        const nextpos = new RoomPosition(25, 25, nextTarget.pos.roomName);
        console.log("Moving attack flag to next target", nextpos);
        // flag.setPosition(nextpos);
        setTimeout(() => {
          console.log("Flag is now located at: ", Game.flags.attack ? Game.flags.attack.pos : "Not found");
          // Game.flags.next_target.remove();
        }, 1);
      } else {
        console.log("No next attack");
        this.stopAttack();
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

    if (AttackManager.isAlmostExpired()) {
      return;
    }

    const existingParty = attack.parties.find(i => i.status !== "dead" && (!i.distance || i.distance <= i.ttl - 300));
    if (existingParty) {
      return;
    }

    const formingParty = attack.parties.find(i => i.status === "forming");
    if (formingParty) {
      return;
    }

    const attackFlagMemory = Game.flags.attack && (Game.flags.attack.memory as AttackFlagMemory);

    let partyInfo = generateAttackCreeps({
      fromRoom: attack.fromRoom,
      targetRoom: attack.toRoom,
      force: false,
      priority: attackFlagMemory ? attackFlagMemory.priority : undefined
    });
    if (!partyInfo) {
      // stop attack
      console.log("WARNING: Cannot defeat this room. Trying anyway.");
      partyInfo = generateAttackCreeps({
        fromRoom: attack.fromRoom,
        targetRoom: attack.toRoom,
        force: true,
        priority: attackFlagMemory ? attackFlagMemory.priority : undefined
      });
      if (!partyInfo) {
        console.log("I was not able to generate an attack party. aborting attack");
        this.stopAttack();
        return;
      }
    }

    var party = {
      kind: partyInfo.name,
      boosted: true,
      count: partyInfo.creeps.length,
      creeps: [],
      mineralsNeeded: partyInfo.minerals,
      needs: partyInfo.creeps.map(creep => _.flatten(Object.keys(creep).map(part => _.fill(Array(creep[part]), part)))),
      id: Game.time,
      status: "forming",
      isApproxPath: true,
      ttl: 1500,
      failed: false,
      retreat: false,
      creationDate: Game.time
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

    const exploration = ExplorationCache.getExploration(toRoom);
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

      const flag = Game.flags.attack;
      if (flag) {
        flag.remove();
      }
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
          const labs = AttackManager.getLabs(Game.rooms[attack.fromRoom]);
          const labNotReady = labs.find(i =>
            i.memory.boostBodyType ? i.lab.mineralAmount < i.memory.needsAmount : false
          );
          if (!sourceRoom.memory.needsAttackers && (!readyness.ready || labNotReady)) {
            console.log(
              "Cannot create party: ",
              readyness && readyness.reason,
              labNotReady ? "lab not ready " + labNotReady.memory.boostResource : ""
            );
            return;
          }
          const currentCreepNeeded = formingParty.needs[formingParty.creeps.length];
          const mineralsNeeded = formingParty.mineralsNeeded;

          if (formingParty.creeps.length === 0) {
            // only check at the beggining of the sequence.
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
          }

          console.log(
            "Asking for spawn of creep #" + (formingParty.creeps.length + 1),
            JSON.stringify(currentCreepNeeded)
          );

          sourceRoom.memory.needsAttackers = {
            boosted: mineralsNeeded.length > 0,
            count: 1,
            parts: currentCreepNeeded,
            partyId: formingParty.id
          };
        } else {
          if (sourceRoom.memory.needsAttackers) {
            console.log("All creeps have been spawned");
          }
          // we have all the creeps we need
          sourceRoom.memory.needsAttackers = undefined;
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

    var availableTrucks = getCreepsByRoleAndRoom(roomName, "truck");

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

profiler.registerClass(AttackManager, "AttackManager");

(global as any).AttackManager = AttackManager;
