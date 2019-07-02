let cpuAverage = 0;
let lastRetrievalDate = Game.time;

export function getCpuAverage() {
  if (lastRetrievalDate != Game.time) {
    cpuAverage = _.sum(Memory.cpuUsages) / Memory.cpuUsages.length;
    lastRetrievalDate = Game.time;
  }

  return cpuAverage;
}

export function isLowOnCpu() {
  return false;
  /*   const currentCpu = Game.cpu.bucket;
  const cpuAverage = getCpuAverage();
  return currentCpu < 7000 || cpuAverage > 19; */
}
