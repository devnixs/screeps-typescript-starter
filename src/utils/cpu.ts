let cpuAverage = 0;
let lastRetrievalDate = Game.time;

export function measureCpuAverage(used?: number) {
  const cpuUsed = used || Game.cpu.getUsed();
  Memory.cpuUsages = Memory.cpuUsages || [];
  Memory.cpuUsages.push(cpuUsed);
  if (Memory.cpuUsages.length > 100) {
    Memory.cpuUsages.shift();
  }
}

export function getAverageCpu() {
  if (lastRetrievalDate != Game.time) {
    cpuAverage = _.sum(Memory.cpuUsages) / Memory.cpuUsages.length;
    lastRetrievalDate = Game.time;
  }

  return cpuAverage;
}

export function getUsedPercentage() {
  return getAverageCpu() / Game.cpu.limit;
}

export function getReduceUsageRatio() {
  const average = getAverageCpu();
  const tolerance = 0.9;

  if (average < Game.cpu.limit * tolerance) {
    return 1;
  } else {
    if (average > Game.cpu.limit) {
      return 0;
    } else {
      return 1 - (average - Game.cpu.limit * tolerance) / (Game.cpu.limit * (1 - tolerance));
    }
  }
}

(global as any).getAverageCpu = getAverageCpu;
(global as any).getReduceUsageRatio = getReduceUsageRatio;
(global as any).resetCpu = function() {
  Memory.cpuUsages = [0];
};

export function isLowOnCpu() {
  return false;
  /*   const currentCpu = Game.cpu.bucket;
  const cpuAverage = getCpuAverage();
  return currentCpu < 7000 || cpuAverage > 19; */
}
