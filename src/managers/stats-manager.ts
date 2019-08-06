import { getMyRooms } from "utils/misc-utils";
import { measureCpuAverage } from "utils/cpu";

const roles: roles[] = [
  "harvester",
  "static-harvester",
  "upgrader",
  "builder",
  "ranged",
  "reparator",
  "fighter",
  "explorer",
  "long-distance-harvester",
  "long-distance-truck",
  "remote-defender",
  "remote-defender-helper",
  "local-defender",
  "pickaboo",
  "healer",
  "claimer",
  "miner",
  "truck",
  "versatile",
  "attacker",
  "pestcontrol",
  "reserver",
  "scout",
  "transport",
  "poker",
  "dismantler"
];

export class StatsManager {
  static runForAllRooms() {
    if (Game.time % 13 > 0) {
      return;
    }
    var cpu = Game.cpu.getUsed();

    measureCpuAverage(cpu);

    var myRooms = getMyRooms();
    var allCreeps = Object.keys(Game.creeps).map(i => Game.creeps[i]);

    var roomStats = myRooms.map(room => {
      var ctrl = room.controller as StructureController;
      const storage = room.storage ? room.storage.store.energy : 0;
      const controller = room.controller ? room.controller.progress : 0;

      const walls = _.sum(
        room
          .find(FIND_STRUCTURES)
          .filter(i => i.structureType === STRUCTURE_WALL)
          .map(i => i.hits / 100)
      );
      const ramparts = _.sum(
        room
          .find(FIND_MY_STRUCTURES)
          .filter(i => i.structureType === STRUCTURE_RAMPART)
          .map(i => i.hits / 100)
      );

      const total = storage + controller + walls + ramparts;

      room.memory.lastProgressChecktime = Game.time;
      room.memory.lastProgress = total;

      var spawnsUsage = room.spawns.length ? _.sum(room.spawns.map(i => (i.spawning ? 1 : 0))) / room.spawns.length : 0;
      var storedEnergy = room.storage ? room.storage.store.energy : 0;
      var progressPercent = ctrl.progressTotal ? ctrl.progress / ctrl.progressTotal : 0;

      const counts = _.countBy(allCreeps.filter(i => i.memory.homeRoom === room.name), c => c.memory.role);

      for (const role of roles) {
        counts[role] = counts[role] || 0;
      }

      return {
        name: room.name,
        rcl: ctrl.level,
        rclP: ctrl.level + progressPercent,
        energy: room.energyAvailable,
        energyCapacity: room.energyCapacityAvailable,
        progress: ctrl.progress,
        progressTotal: ctrl.progressTotal,
        progressPercent: ctrl.progress / ctrl.progressTotal,
        underSiege: room.memory.isUnderSiege ? 1 : 0,
        energyAccumulated: total,
        spawnsUsage,
        storedEnergy,
        nukes: room.find(FIND_NUKES).length,
        creepsCount: counts,
        lacksEnergy: room.energyAvailable < room.energyCapacityAvailable && room.spawns.find(i => !i.spawning) ? 1 : 0
      };
    });

    const resources = getMyRooms()
      .filter(i => i.terminal)
      .map(i => i.terminal && i.terminal.store)
      .reduce((acc, store) => _.merge(acc, _.omit(store as any, "energy"), (a, b) => (a || 0) + (b || 0)), {});

    Memory.stats = {
      tick: Game.time,
      gcl: Game.gcl.level,
      roomsCount: myRooms.length,
      gclProgress: Game.gcl.progress,
      gclProgressTotal: Game.gcl.progressTotal,
      creeps: Object.keys(Game.creeps).length,
      cpu: cpu,
      cpuMax: Game.cpu.limit,
      cpuPercent: cpu / Game.cpu.limit,
      bucket: Game.cpu.bucket,
      siegedRooms: myRooms.filter(i => i.memory.isUnderSiege).length,
      rooms: _.mapValues(_.groupBy(roomStats, i => i.name), i => i[0]),
      resources,
      heap: Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics()
    };
  }
}
