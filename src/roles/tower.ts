import { profiler } from "../utils/profiler";
import { rampartMinHp, wallsMinHp } from "constants/misc";

interface ITowerMemory extends CreepMemory {
  upgrading: boolean;
}

class RoleTower {
  runAllTowers() {
    const allTowers = this.getTowerList();
    _.forEach(allTowers, this.runSingleTower);
  }

  private runSingleTower = (tower: StructureTower) => {
    if (tower.energy === 0) {
      return;
    }
    if (Game.time % 30 === 0) {
      this.refreshDamagedStructures(tower);
    }

    if (Game.time % 3 === 0) {
      this.refreshEnemy(tower);
      this.refreshDamagedCreep(tower);
    }

    if (this.hasDamagedCreeps(tower)) {
      this.healDamageedCreeps(tower);
      this.refreshDamagedCreep(tower);
      return;
    }

    if (this.hasEnemies(tower)) {
      this.attackEnemies(tower);
      this.refreshEnemy(tower);
      return;
    }

    if (this.hasDamagedStructures(tower)) {
      this.repairDamagedStructures(tower);
      this.refreshDamagedStructures(tower);
      return;
    }
  };

  private hasDamagedStructures(tower: StructureTower): boolean {
    return Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].damagedStructureId ? true : false;
  }

  private hasDamagedCreeps(tower: StructureTower): boolean {
    return Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].damagedCreepId ? true : false;
  }

  private hasEnemies(tower: StructureTower): boolean {
    return Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].enemyId ? true : false;
  }

  private refreshEnemy(tower: StructureTower) {
    Memory.rooms[tower.room.name] = Memory.rooms[tower.room.name] || {};
    const enemy = this.getEnemyInRoom(tower);
    Memory.rooms[tower.room.name].enemyId = enemy ? enemy.id : null;
  }

  private refreshDamagedCreep(tower: StructureTower) {
    Memory.rooms[tower.room.name] = Memory.rooms[tower.room.name] || {};
    const creep = this.getDamagedCreepInRoom(tower);
    Memory.rooms[tower.room.name].damagedCreepId = creep ? creep.id : null;
  }

  private refreshDamagedStructures(tower: StructureTower) {
    Memory.rooms[tower.room.name] = Memory.rooms[tower.room.name] || {};
    const damagedStructure = this.getDamagedStructureInRoom(tower);
    Memory.rooms[tower.room.name].damagedStructureId = damagedStructure ? damagedStructure.id : null;
  }

  private repairDamagedStructures(tower: StructureTower) {
    let damagedStructureId = Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].damagedStructureId;
    let damagedStructure: AnyStructure | null = null;
    if (damagedStructureId) {
      damagedStructure = Game.getObjectById(damagedStructureId);
      if (!damagedStructure || damagedStructure.hits === damagedStructure.hitsMax) {
        Memory.rooms[tower.room.name].damagedStructureId = null;
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
    let enemyId = Memory.rooms[tower.room.name] && Memory.rooms[tower.room.name].enemyId;
    let enemy: Creep | null = null;
    if (enemyId) {
      enemy = Game.getObjectById(enemyId);
      if (!enemy || enemy.hits === 0) {
        Memory.rooms[tower.room.name].enemyId = null;
        enemyId = null;
        enemy = null;
      }
    }

    if (enemy) {
      return tower.attack(enemy);
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

  private getDamagedStructureInRoom(tower: StructureTower): AnyStructure | null {
    const maxEnergyInExtensions = tower.room.energyAvailable === tower.room.energyCapacityAvailable;
    const allowWallsAndRemparts =
      Game.cpu.bucket > 9000 &&
      maxEnergyInExtensions &&
      (tower.room.storage ? tower.room.storage.store.energy > 930000 : false);
    // const minHpRampart = rampartMinHp(tower.room.controller ? tower.room.controller.level : 0);
    // const minHpWalls = wallsMinHp(tower.room.controller ? tower.room.controller.level : 0);

    // only repair really damaged stuff
    var damagedOther = tower.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType != STRUCTURE_RAMPART && structure.hits < structure.hitsMax / 10
    });
    if (damagedOther.length) {
      damagedOther.sort((a, b) => a.hits - b.hits);
      return damagedOther[0];
    }

    var damagedRoads = tower.room.find(FIND_STRUCTURES, {
      filter: structure =>
        (allowWallsAndRemparts && structure.structureType === STRUCTURE_RAMPART) ||
        (allowWallsAndRemparts && structure.structureType === "constructedWall" && structure.hits > 0) ||
        ((structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER) &&
          structure.hits < structure.hitsMax / 2)
    });
    damagedRoads.sort((a, b) => a.hits - b.hits);
    return damagedRoads[0];
  }

  private getDamagedCreepInRoom(tower: StructureTower): Creep | null {
    var damagedOther = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
      filter: structure => structure.hits < structure.hitsMax
    });
    return damagedOther;
  }

  private getEnemyInRoom(tower: StructureTower): Creep | null {
    var enemies = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    // var healersFirst = _.sortBy(enemies, enemy => -1 * enemy.getActiveBodyparts(HEAL));

    return enemies;
  }

  private getTowerList(): StructureTower[] {
    const isSimulation = "sim" in Game.rooms;
    if (!Memory.existingTowerIds || Game.time % 100 === 0 || isSimulation) {
      const towerIds = Object.keys(Game.structures)
        .map(i => Game.structures[i])
        .filter(i => i.structureType === STRUCTURE_TOWER)
        .map(i => i.id);
      Memory.existingTowerIds = towerIds;
    }
    return Memory.existingTowerIds.map(i => Game.getObjectById(i) as StructureTower).filter(i => i);
  }
}

profiler.registerClass(RoleTower, "RoleTower");
export const roleTower = new RoleTower();
