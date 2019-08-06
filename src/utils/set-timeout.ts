/**
 * global.setTimeout()    - works like external to screeps except measured in ticks, not milliseconds
 * global.clearTimeout()  - works like external to screeps
 *
 * global.setInterval()   - works like external to screeps except measured in ticks, not milliseconds
 * global.clearInterval() - works like external to screeps
 *
 * global.runTimeout()    - required to run inside loop to force tick increment for all timeouts
 *
 * @author:  SemperRabbit
 * @version: 1.2
 * @date:    180811
 *
 * NOTE: global resets will clear all timeouts and intervals...
 *
 * setTimeout() acts as it regularly would in JS outside of screeps, except that it is measured in
 *   ticks as opposed to milliseconds. It returns a timeout ID, which can be cancelled via
 *   clearTimeout(id). runTimeout() is required to increment the tick count. setInterval() and
 *   clearInterval() work the same way.
 *
 * Example:
 *   setInterval(()=>{console.log('every 3 ticks')}, 3);
 *
 *   var a = setTimeout(()=>{console.log('5 ticks from start')}, 5);
 *   clearTimeout(a) // removes the "5 ticks from start" timeout
 *
 *   module.exports.loop = function() {
 *       runTimeout();
 *       // remainder of loop
 *   }
 *
 * ChangeLog:
 *   v1.0 initial commit
 *   v1.1 refactored function storage from module scoped array to internal to the generator
 *   v1.2 added setInterval/clearInterval in addition to setTimeout/clearTimeout
 */
// Storage for timer generators
const timerStore: (IterableIterator<number | false | void> | undefined)[] = [];
// timer generator, calling function every time `ticks % count === 0`
function* timerGen(id: number, func: () => void, count: number, interval = false) {
  var ticks = 0;
  while (true) {
    ticks++;
    if (ticks % count === 0 && ticks !== 0) {
      if (!interval) timerStore[id] = undefined;
      yield func(); // run the function
    } else {
      yield false; // do not run the function
    }
  }
}
// must be run inside the loop for the tick count to proceed
export function runTimeout() {
  for (var i = 0; i < timerStore.length; i++) {
    const generator = timerStore[i];
    if (!!generator) {
      // ensure generator exists
      generator.next();
    }
  }
}
// initialize a new generator and register it in `timerStor[]`
export function setTimeout(func: () => void, time: number) {
  const id = timerStore.length;
  var t = timerGen(id, func, time);
  timerStore[id] = t;
  return id;
}
// initialize a new generator and register it in `timerStor[]`
export function setInterval(func: () => void, time: number) {
  const id = timerStore.length;
  var t = timerGen(id, func, time, true);
  timerStore[id] = t;
  return id;
}
// removes timeout of "id" from activity. id is returned from setTimeout()
// the same function can be used for intervals and timeouts
export function clearInterval(id: number) {
  if (!!timerStore[id]) {
    timerStore[id] = undefined;
  }
}

(global as any).setTimeout = setTimeout;
(global as any).setInterval = setInterval;
(global as any).clearInterval = clearInterval;
