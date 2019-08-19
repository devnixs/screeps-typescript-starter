let creepsByRoom: { [roomName: string]: { [roleName: string]: Creep[] } } | undefined = undefined;
let lastCheckTime = 0;

function generateCache() {
  const allCreeps = Object.keys(Game.creeps).map(i => Game.creeps[i]);
  creepsByRoom = {};
  for (const creep of allCreeps) {
    creepsByRoom[creep.memory.homeRoom] = creepsByRoom[creep.memory.homeRoom] || {};

    creepsByRoom[creep.memory.homeRoom][creep.memory.role] =
      creepsByRoom[creep.memory.homeRoom][creep.memory.role] || [];

    creepsByRoom[creep.memory.homeRoom][creep.memory.role].push(creep);
  }
  lastCheckTime = Game.time;
}

export function getCreepsByRoleAndRoom(roomName: string, role: roles) {
  if (!creepsByRoom || lastCheckTime !== Game.time) {
    generateCache();
  }

  return creepsByRoom && creepsByRoom[roomName] && creepsByRoom[roomName][role] ? creepsByRoom[roomName][role] : [];
}

export function getCreepsByHomeRoom(roomName: string) {
  if (!creepsByRoom || lastCheckTime !== Game.time) {
    generateCache();
  }

  if (creepsByRoom && creepsByRoom[roomName]) {
    const thisRoom = creepsByRoom[roomName];
    const creepsInThisRoom = _.flatten(Object.keys(thisRoom).map(i => thisRoom[i]));
    return creepsInThisRoom;
  } else {
    return [];
  }
}
