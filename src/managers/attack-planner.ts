import { createFlagAtPosition } from "utils/misc-utils";

export class AttackPlanner {
  static run() {
    if (Game.time % 17 > 0) {
      return;
    }

    // If an attack is already in progress, no need to do anything
    if (Memory.attack) {
      return;
    }

    const nextAttack = Memory.nextAttack;

    if (nextAttack && nextAttack.time <= Game.time) {
      Memory.nextAttack = undefined;

      console.log("Starting auto attack to room ", nextAttack.room);
      createFlagAtPosition(new RoomPosition(25, 25, nextAttack.room), "attack");
    }
  }
}
