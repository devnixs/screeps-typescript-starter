import { createFlagAtPosition, getMyRooms, hasSafeModeAvailable, hasSafeModeActivated } from "utils/misc-utils";
import { profiler } from "utils/profiler";

export class AttackPlanner {
  static run() {
    if (Game.time % 17 > 0) {
      return;
    }

    // If an attack is already in progress, no need to do anything
    if (Memory.attack || "attack" in Game.flags) {
      return;
    }

    const nextAttack = Memory.nextAttack;

    if (nextAttack && nextAttack.time <= Game.time) {
      Memory.nextAttack = undefined;

      console.log("Starting auto attack to room ", nextAttack.room);
      createFlagAtPosition(new RoomPosition(25, 25, nextAttack.room), "attack");
      return;
    }
    /*
    const rebuildingRoom = getMyRooms().find(i => i.memory.isRebuilding);
    if (rebuildingRoom) {
      createFlagAtPosition(new RoomPosition(25, 25, rebuildingRoom.name), "attack");
      return;
    }
 */
    const roomThatNeedHelp = getMyRooms().find(i =>
      i.controller &&
      i.controller.level >= 2 &&
      i.controller.level <= 6 &&
      !hasSafeModeAvailable(i) &&
      !hasSafeModeActivated(i) &&
      i.memory.isUnderSiege
        ? true
        : false
    );
    if (roomThatNeedHelp) {
      createFlagAtPosition(new RoomPosition(25, 25, roomThatNeedHelp.name), "attack");
    }
  }
}

profiler.registerClass(AttackPlanner, "AttackPlanner");
