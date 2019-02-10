// example declaration file - remove these and add your own custom typings

type roles = "harvester" | "upgrader" | "builder" | "ranged" | "fighter";

// memory extension samples
interface CreepMemory {
  role: roles;
}

interface RoomMemory {}

interface Memory {
  uuid: number;
  log: any;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
