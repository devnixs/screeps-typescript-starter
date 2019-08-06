import { profiler } from "./profiler";
import { isInSafeArea } from "./safe-area";
import { DefenseManager } from "managers/defense";

export class SafeModeActivator {
  static activeSafeModeIfNecessary() {
    if (Game.time % 4 > 0) {
      return;
    }

    const myRooms = Object.keys(Game.rooms)
      .map(i => Game.rooms[i])
      .filter(i => i.controller && i.controller.my)
      .map(i => Game.rooms[i.name]);

    myRooms.forEach(room => this.checkRoom(room));
  }

  static checkRoom(room: Room) {
    var enemies = room.find(FIND_HOSTILE_CREEPS);
    if (enemies.length === 0) {
      return;
    }

    if (
      room.controller &&
      (room.controller.safeMode || room.controller.safeModeAvailable === 0 || room.controller.safeModeCooldown)
    ) {
      return;
    }

    const spawns = room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "spawn" });
    if (spawns.length !== 1) {
      return;
    }

    const towers = room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });
    const towerPoints = towers.length * 10;
    const enemyPoints = DefenseManager.getCreepThreatLevel(enemies);
    console.log("Found threat level ", enemyPoints);

    enemies.forEach(enemy => {
      if (!enemy.owner) {
        return;
      }
      //if a big enemy can freely access the last spawn, trigger safe mode
      // var isBoosted = enemy.body.filter(i => i.boost).length > 5;
      var isPlayer = enemy.owner.username != "Invader" && enemy.owner.username != "Source Keeper";
      var isBig = enemy.body.length > 10;

      if (isBig && isPlayer) {
        const inSafeArea = isInSafeArea(enemy.pos, enemy.room);
        if (inSafeArea === true) {
          const result = room.controller && room.controller.activateSafeMode();
          if (result === OK) {
            Game.notify("Enemy in safe area, activating safe mode on room " + room.name);
          }
        }
        if (inSafeArea === undefined && enemyPoints > towerPoints) {
          const result = room.controller && room.controller.activateSafeMode();
          if (result === OK) {
            Game.notify("Enemy present, but no safe area defined. Activating safe mode on room " + room.name);
          }
        }
      }
    });
  }
}

profiler.registerClass(SafeModeActivator, "SafeModeActivator");
