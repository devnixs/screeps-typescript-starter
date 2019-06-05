let cpuAverage = 0;
let lastRetrievalDate = Game.time;

export function getCpuAverage() {
  if (lastRetrievalDate != Game.time) {
    cpuAverage = _.sum(Memory.cpuUsages) / Memory.cpuUsages.length;
    lastRetrievalDate = Game.time;
  }

  return cpuAverage;
}
