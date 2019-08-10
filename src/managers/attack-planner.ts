export class AttackPlanner {
  static run() {
    if (Game.time % 17 > 0) {
      return;
    }
    const nextAttack = Memory.nextAttack;

    if (nextAttack && nextAttack.time > Game.time) {
      Memory.nextAttack = undefined;

      console.log("Starting auto attack to room ", nextAttack.room);
      new RoomPosition(25, 25, nextAttack.room).createFlag("attack");
    }
  }
}
