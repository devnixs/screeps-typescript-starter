export class SafeModeActivator {
  static activeSafeModeIfNecessary() {
    if (Game.time % 2 > 0) {
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

    var spawns = room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "spawn" });
    if (spawns.length !== 1) {
      return;
    }

    var lastSpawn = spawns[0];

    enemies.forEach(enemy => {
      //if a boosted enemy can freely access the last spawn, trigger safe mode
      var isBoosted = enemy.body.filter(i => i.boost).length > 5;
      var isPlayer = enemy.owner.username != "Invader" && enemy.owner.username != "Source Keeper";
      var isBig = enemy.body.length > 10;

      if (isBoosted && isBig && isPlayer) {
        // test if can access spawn
        var canAccessLastSpawn = enemy.pos.inRangeTo(lastSpawn, 8);
        if (canAccessLastSpawn) {
          // has at least 100K rampart
          const rampart = lastSpawn.pos.lookFor("structure").find(a => a.structureType === "rampart");
          if (!rampart || rampart.hits < 100000) {
            const result = room.controller && room.controller.activateSafeMode();
            if (result === OK) {
              Game.notify("Activated safe mode on room " + room.name);
            }
          }
        }
      }
    });
  }
}
