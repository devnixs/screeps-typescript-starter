import { getMyRooms } from "utils/misc-utils";

export class DefenseManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => {
      new DefenseManager(room).run();
    });
  }

  run() {
    if (Game.time % 4 > 0) {
      return;
    }

    this.room.memory.needsDefenders = [];
    this.checkRemotes();
    this.runForOwnRoom();
  }

  runForOwnRoom() {
    const threatLevel = this.getThreatLevel(this.room);
    const towerCount = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === "tower" }).length;
    const towerThreatCompensation = towerCount * 5;

    const threatDifference = threatLevel - towerThreatCompensation;

    if (threatDifference > 0) {
      this.room.memory.needsDefenders.push({
        room: this.room.name,
        threatLevel: threatDifference,
        mode: "local"
      });
    }
  }

  checkRemotes() {
    _.uniq(this.room.memory.remotes.filter(i => !i.disabled).map(i => i.room)).forEach(room => {
      const remoteRoom = Game.rooms[room];
      if (remoteRoom) {
        this.addDefenders(remoteRoom);
      }
    });
  }

  addDefenders(targetRoom: Room) {
    const threatLevel = this.getThreatLevel(targetRoom);
    if (threatLevel) {
      console.log("Found thread in room", targetRoom.name);
      this.room.memory.needsDefenders.push({
        room: targetRoom.name,
        threatLevel: threatLevel,
        mode: targetRoom.name === this.room.name ? "local" : "remote"
      });
    }
  }

  getThreatLevel(targetRoom: Room) {
    const enemies =
      targetRoom &&
      targetRoom.find(FIND_HOSTILE_CREEPS, {
        filter: i =>
          i.body.find(
            bodyPart =>
              bodyPart.hits > 0 &&
              (bodyPart.type === "attack" || bodyPart.type === "ranged_attack" || bodyPart.type === "heal")
          )
      });

    if (enemies.length) {
      const threatValues = _.flatten(
        enemies.map(enemy =>
          enemy.body.map(i => {
            if (i.hits === 0) {
              return 0;
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
            if (i.boost) {
              threat = threat * 2;
            }
            return threat;
          })
        )
      );
      const threatLevel = _.sum(threatValues);

      targetRoom.visual.text("DANGER " + threatLevel, 20, 20, {
        color: "white",
        backgroundColor: "black",
        opacity: 0.5
      });
      return threatLevel;
    } else {
      return 0;
    }
  }
}
