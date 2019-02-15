export function notify(text: string, cache: number) {
  const noNotificationBefore = Memory.noNotificationBefore;
  if (!noNotificationBefore || Game.time <= noNotificationBefore) {
    Memory.noNotificationBefore = Game.time;
    Game.notify(text);
  }
}
