import { profiler } from "../utils/profiler";
import { rampartMinHp, wallsMinHp, whitelist } from "constants/misc";
import { getMyRooms } from "utils/misc-utils";
import { stat } from "fs";

interface ITowerMemory extends CreepMemory {
  upgrading: boolean;
}

interface ICreepMemory {
  id: string;
  firstSeen: number;
  attackedCount: number;
  nextAttackAt: number;
  range: number;
  room: string;
}

interface ICreepMemories {
  [id: string]: ICreepMemory;
}

const creepsMemory: ICreepMemories = {};

const maxAttacks = 5;
const attackDelay = 100;

class RoleTower {
  runAllTowers() {
    getMyRooms().forEach(r => this.runSingleRoom(r));
  }

  private runSingleRoom(room: Room) {
    if (Game.time % 30 === 0) {
      this.refreshDamagedStructures(room);
    }

    if (Game.time % 7 === 0) {
      this.refreshEnemiesMemory(room);
    }

    if (Game.time % 11 === 0) {
      this.refreshDamagedCreep(room);
    }

    if (this.hasDamagedCreeps(room)) {
      this.refreshDamagedCreep(room);
    }

    if (this.hasEnemies(room)) {
      this.refreshEnemiesMemory(room);
      this.refreshDamagedCreep(room);
      this.showStatus(room);
    }

    if (this.hasDamagedStructures(room)) {
      this.refreshDamagedStructures(room);
    }

    if (this.hasDamagedCreeps(room) || this.hasDamagedStructures(room) || this.hasAttackableEnemies(room)) {
      _.forEach(room.towers, this.runSingleTower);
    }
  }

  private runSingleTower = (tower: StructureTower) => {
    if (tower.energy === 0) {
      return;
    }

    if (this.hasDamagedCreeps(tower.room)) {
      // if there are enemy creeps, alternate between healing and attacking
      if (!this.hasAttackableEnemies(tower.room) || Game.time % 2 === 0) {
        this.healDamageedCreeps(tower);
        return;
      }
    }

    if (this.hasAttackableEnemies(tower.room)) {
      this.attackEnemies(tower);
      return;
    }

    if (this.hasDamagedStructures(tower.room)) {
      this.repairDamagedStructures(tower);
      return;
    }
  };

  private hasDamagedStructures(room: Room): boolean {
    return room.memory && room.memory.damagedStructureId ? true : false;
  }

  private hasDamagedCreeps(room: Room): boolean {
    return room.memory && room.memory.damagedCreepId ? true : false;
  }

  private hasEnemies(room: Room): boolean {
    return !!Object.keys(creepsMemory)
      .map(i => creepsMemory[i])
      .find(i => i.room === room.name);
  }

  private showStatus(room: Room) {
    if ("show_enemy" in Game.flags) {
      const enemies = Object.keys(creepsMemory)
        .map(i => creepsMemory[i])
        .filter(i => i.room === room.name);

      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        room.visual.text("ENEMY SINCE " + (Game.time - enemy.firstSeen), 10, 10 + i * 5, {
          color: "white",
          backgroundColor: "black",
          opacity: 0.5
        });
        room.visual.text("RANGE " + enemy.range, 10, 11 + i * 5, {
          color: "white",
          backgroundColor: "black",
          opacity: 0.5
        });
        room.visual.text("ATTACKED " + enemy.attackedCount, 10, 12 + i * 5, {
          color: "white",
          backgroundColor: "black",
          opacity: 0.5
        });
        room.visual.text("NEXT ATTACK: " + (enemy.nextAttackAt - Game.time), 10, 13 + i * 5, {
          color: "white",
          backgroundColor: "black",
          opacity: 0.5
        });
      }
    }
  }

  private hasAttackableEnemies(room: Room): boolean {
    return !!Object.keys(creepsMemory)
      .map(i => creepsMemory[i])
      .find(i => i.room === room.name && i.nextAttackAt <= Game.time);
  }

  private refreshEnemiesMemory(room: Room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS, {
      filter: i => whitelist.indexOf(i.owner.username) === -1
    });
    const towers = room.towers;

    const hostilesAndRange = hostiles.map(h => ({ hostile: h, range: _.sum(towers, t => t.pos.getRangeTo(h)) }));

    for (const data of hostilesAndRange) {
      if (creepsMemory[data.hostile.id]) {
        creepsMemory[data.hostile.id].range = data.range;
      } else {
        creepsMemory[data.hostile.id] = {
          firstSeen: Game.time,
          id: data.hostile.id,
          room: room.name,
          range: data.range,
          attackedCount: 0,
          nextAttackAt: Game.time + 15
        };
      }
    }

    // cleanup
    for (const id in creepsMemory) {
      if (creepsMemory[id].room === room.name && !hostilesAndRange.find(i => i.hostile.id === id)) {
        delete creepsMemory[id];
      }
    }
  }

  /*   private refreshEnemy(room: Room) {
    room.memory = room.memory || {};
    const enemy = this.getEnemyInRoom(room);

    const enemyMemory = room.memory.enemy;
    const existingEnemy: Creep | undefined | null = enemyMemory && Game.getObjectById(enemyMemory.id);

    if (enemyMemory && existingEnemy) {
      enemyMemory.attack = enemyMemory.range <= 8 || Game.time - enemyMemory.firstSeen > 18;
      const towersOrdered = _.sortBy(room.towers.map(t => t.pos.getRangeTo(existingEnemy)), i => i);
      enemyMemory.range = towersOrdered.length ? towersOrdered[0] : 0;
    } else {
      if (enemy) {
        room.memory.enemy = {
          attack: false,
          firstSeen: Game.time,
          id: enemy.hostile.id,
          range: enemy.range
        };
      } else {
        delete room.memory.enemy;
      }
    }
  }
 */
  private refreshDamagedCreep(room: Room) {
    room.memory = room.memory || {};
    const creep = this.getDamagedCreepInRoom(room);
    room.memory.damagedCreepId = creep ? creep.id : null;
  }

  private refreshDamagedStructures(room: Room) {
    room.memory = room.memory || {};
    let damagedStructure = this.getDamagedStructureInRoom(room);
    if (room.memory.isUnderSiege) {
      // save energy during sieges.
      damagedStructure = null;
    }
    room.memory.damagedStructureId = damagedStructure ? damagedStructure.id : null;
  }

  private repairDamagedStructures(tower: StructureTower) {
    let damagedStructureId = tower.room.memory && tower.room.memory.damagedStructureId;
    let damagedStructure: AnyStructure | null = null;
    if (damagedStructureId) {
      damagedStructure = Game.getObjectById(damagedStructureId);
      if (!damagedStructure || damagedStructure.hits === damagedStructure.hitsMax) {
        tower.room.memory.damagedStructureId = null;
        damagedStructureId = null;
        damagedStructure = null;
      }
    }

    if (damagedStructure) {
      return tower.repair(damagedStructure);
    } else {
      return -1;
    }
  }

  private attackEnemies(tower: StructureTower) {
    const firstEnemy = Object.keys(creepsMemory)
      .map(i => creepsMemory[i])
      .find(i => i.room === tower.room.name && i.nextAttackAt <= Game.time);

    const enemyCreep = firstEnemy && (Game.getObjectById(firstEnemy.id) as Creep);

    if (enemyCreep && firstEnemy) {
      const status = tower.attack(enemyCreep);
      if (status === OK) {
        firstEnemy.attackedCount++;
        if (firstEnemy.attackedCount > maxAttacks && enemyCreep.hits === enemyCreep.hitsMax) {
          firstEnemy.nextAttackAt = Game.time + attackDelay;
          firstEnemy.attackedCount = 0;
        }
      }
      return status;
    } else {
      return -1;
    }
  }

  private healDamageedCreeps(tower: StructureTower) {
    let damagedCreepId = Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].damagedCreepId;
    let damagedCreep: Creep | null = null;
    if (damagedCreepId) {
      damagedCreep = Game.getObjectById(damagedCreepId);
      if (!damagedCreep || damagedCreep.hits === damagedCreep.hitsMax) {
        Memory.rooms[tower.room.name].damagedCreepId = null;
        damagedCreepId = null;
        damagedCreep = null;
      }
    }

    if (damagedCreep) {
      return tower.heal(damagedCreep);
    } else {
      return -1;
    }
  }

  private getDamagedStructureInRoom(room: Room): AnyStructure | null {
    const maxEnergyInExtensions = room.energyAvailable === room.energyCapacityAvailable;
    const allowWallsAndRemparts =
      Game.cpu.bucket > 9000 && maxEnergyInExtensions && (room.storage ? room.storage.store.energy > 930000 : false);
    // const minHpRampart = rampartMinHp(room.controller ? room.controller.level : 0);
    // const minHpWalls = wallsMinHp(room.controller ? room.controller.level : 0);

    // only repair really damaged stuff
    var damagedOther = room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType != STRUCTURE_RAMPART && structure.hits < structure.hitsMax / 10
    });
    if (damagedOther.length) {
      damagedOther.sort((a, b) => a.hits - b.hits);
      return damagedOther[0];
    }

    var damagedRoads = room.find(FIND_STRUCTURES, {
      filter: structure =>
        (allowWallsAndRemparts && structure.structureType === STRUCTURE_RAMPART) ||
        (allowWallsAndRemparts && structure.structureType === "constructedWall" && structure.hits > 0) ||
        ((structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER) &&
          structure.hits < structure.hitsMax / 2)
    });
    damagedRoads.sort((a, b) => a.hits - b.hits);
    return damagedRoads[0];
  }

  private getDamagedCreepInRoom(room: Room): Creep | undefined {
    const isUnderSiege = room.memory.isUnderSiege;

    if (isUnderSiege) {
      // only heal defenders during sieges
      const allowedRoles: roles[] = ["local-defender", "remote-defender", "builder", "remote-defender-helper", "truck"];
      return room.find(FIND_MY_CREEPS, {
        filter: structure => structure.hits < structure.hitsMax && allowedRoles.indexOf(structure.memory.role) >= 0
      })[0];
    } else {
      return room.find(FIND_MY_CREEPS, {
        filter: structure => structure.hits < structure.hitsMax
      })[0];
    }
  }

  private getEnemyInRoom(room: Room): { hostile: Creep; range: number } | undefined {
    const hostiles = room.find(FIND_HOSTILE_CREEPS, {
      filter: i => whitelist.indexOf(i.owner.username) === -1
    });
    const towers = room.towers;

    const hostilesAndRange = hostiles.map(h => ({ hostile: h, range: _.sum(towers, t => t.pos.getRangeTo(h)) }));
    const closest = _.sortBy(hostilesAndRange, i => i.range)[0];

    return closest;
  }
}

profiler.registerClass(RoleTower, "RoleTower");
export const roleTower = new RoleTower();
