import { getMyRooms } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { Chemist } from "./chemist";
import { whitelist } from "constants/misc";

interface ThreatLevelAndTime {
  threatLevel: number;
  time: number;
}

const lastSeenThreatLevels: { [roomName: string]: ThreatLevelAndTime } = {};
(global as any).getLastSeenThreatLevels = function() {
  return lastSeenThreatLevels;
};

export class DefenseManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new DefenseManager(room).run();
    });
  }

  run() {
    if (Game.time % 3 > 0) {
      return;
    }

    this.room.memory.needsDefenders = [];
    this.checkRemotes();
    this.runForOwnRoom();
    this.reassignDefenders();
  }

  runForOwnRoom() {
    if (this.room.name === "W2N5") {
      return;
    }

    const threatLevel = this.getThreatLevel(this.room.name);
    const towerCount = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === "tower" }).length;
    const towerThreatCompensation = towerCount * 8;

    const threatDifference = threatLevel - towerThreatCompensation;

    if (threatDifference > 0) {
      this.room.memory.needsDefenders.push({
        room: this.room.name,
        threatLevel: threatDifference,
        mode: "local"
      });
      const underSiege = threatLevel > 60;
      if (!this.room.memory.isUnderSiege && underSiege) {
        this.setupSiegeMode();
      } else if (this.room.memory.isUnderSiege && !underSiege) {
        this.removeSiegeMode();
      }
    } else {
      if (this.room.memory.isUnderSiege) {
        this.removeSiegeMode();
      }
    }
  }

  setupSiegeMode() {
    this.room.memory.isUnderSiege = true;
    console.log("Room", this.room.name, "is under siege!");
    this.room.memory.boostMode = {
      parts: [RANGED_ATTACK],
      reason: "siege"
    };
    Game.notify("Room " + this.room.name + " is under siege! Tick=" + Game.time);
  }

  removeSiegeMode() {
    this.room.memory.isUnderSiege = false;
    console.log("Room", this.room.name, "is no longer under siege.");
    if (this.room.memory.boostMode && this.room.memory.boostMode.reason === "siege") {
      this.room.memory.boostMode = undefined;
    }
  }

  checkRemotes() {
    _.uniq(this.room.memory.remotes.filter(i => !i.disabled).map(i => i.room)).forEach(room => {
      this.addDefenders(room);
    });

    // if there's a remote with more than 50 threat, use boosts to defend
    const highThreatRoom = this.room.memory.needsDefenders.find(i => i.threatLevel > 50);
    if (highThreatRoom) {
      highThreatRoom.boosted = true;
      this.room.memory.boostMode = {
        parts: [RANGED_ATTACK, HEAL],
        reason: "remote"
      };
    } else if (this.room.memory.boostMode && this.room.memory.boostMode.reason === "remote") {
      this.room.memory.boostMode = undefined;
    }
  }

  addDefenders(targetRoom: string) {
    const threatLevel = this.getThreatLevel(targetRoom);
    if (threatLevel > 0) {
      // console.log("Found threat in room", targetRoom.name);
      this.room.memory.needsDefenders.push({
        room: targetRoom,
        threatLevel: threatLevel,
        mode: targetRoom === this.room.name ? "local" : "remote"
      });
    }
  }

  reassignDefenders() {
    const defenders = Object.keys(Game.creeps)
      .map(i => Game.creeps[i])
      .filter(i => i.memory.homeRoom === this.room.name && i.memory.role === "remote-defender");
    let idleDefenders = defenders.filter(i => !i.memory.subRole);
    const threatenedRooms = this.room.memory.needsDefenders;

    threatenedRooms.forEach(room => {
      let currentDefense = _.sum(defenders.filter(d => d.memory.subRole === room.room).map(i => i.memory.r));

      while (currentDefense < room.threatLevel && idleDefenders.length > 0) {
        idleDefenders[0].memory.subRole = room.room;
        currentDefense += idleDefenders[0].memory.r || 0;
        idleDefenders[0].say("Reassigned to " + room.room);
        // console.log("Reassigned", idleDefenders[0].name, " to " + room.room);
        idleDefenders = defenders.filter(i => !i.memory.subRole);
      }
    });

    // unassign defenders in rooms with no threats

    defenders.forEach(defender => {
      const targetRoom = defender.memory.subRole;
      if (targetRoom) {
        const hasThreat = this.room.memory.needsDefenders.find(i => i.room === targetRoom && i.threatLevel > 0);
        if (!hasThreat) {
          defender.say("Unassigned");
          // console.log("Unassigned", defender.name, "from room", targetRoom);
          defender.memory.subRole = undefined;
        }
      }
    });

    // if there are still
  }

  getThreatLevel(targetRoomName: string) {
    const targetRoom = Game.rooms[targetRoomName];
    const lastSeenThreat = lastSeenThreatLevels[targetRoomName];

    if (!targetRoom && lastSeenThreat && lastSeenThreat.time > Game.time - 70) {
      return lastSeenThreat.threatLevel;
    }

    let threatLevel = 0;

    if (Cartographer.roomType(targetRoomName) === "SK") {
      threatLevel += 16;
    }

    const enemies = targetRoom
      ? targetRoom.find(FIND_HOSTILE_CREEPS, {
          filter: i =>
            whitelist.indexOf(i.owner.username) === -1 &&
            i.body.find(
              bodyPart =>
                bodyPart.type === "attack" ||
                bodyPart.type === "ranged_attack" ||
                bodyPart.type === "heal" ||
                bodyPart.type === "work"
            )
        })
      : [];

    if (enemies.length) {
      const threatValues = DefenseManager.getCreepThreatLevel(enemies);
      threatLevel += threatValues;
    }

    if (threatLevel > 0) {
      lastSeenThreatLevels[targetRoomName] = {
        threatLevel: threatLevel,
        time: Game.time
      };

      targetRoom &&
        targetRoom.visual.text("DANGER " + threatLevel, 20, 20, {
          color: "white",
          backgroundColor: "black",
          opacity: 0.5
        });
    }

    return threatLevel;
  }

  static getCreepThreatLevel(creeps: Creep[]) {
    return _.sum(
      _.flatten(
        creeps
          .filter(i => !i.my)
          .map(enemy =>
            enemy.body.map(i => {
              if (i.hits === 0) {
                return 0.1;
              }
              let threat = 0;
              if (i.type === "attack") {
                threat = 1;
              }
              if (i.type === "ranged_attack") {
                threat = 1;
              }
              if (i.type === "heal") {
                threat = 1;
              }
              if (i.type === "tough") {
                threat = 1;
              }
              if (i.type === "work") {
                threat = 0.1;
              }
              if (i.boost) {
                threat = threat * 2;
              }
              return threat;
            })
          )
      )
    );
  }
}
