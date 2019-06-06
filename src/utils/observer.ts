export class Observer {
  static runAllObservers() {
    //E22N36
    var observer1 = Game.getObjectById("5cf5150f2d06a97e67901da7") as StructureObserver;

    //E19N37
    var observer2 = Game.getObjectById("5cd9f7c64586281e0e62ff5d") as StructureObserver;

    //E27N47
    var observer3 = Game.getObjectById("5c97e72dfe91cf5d1a562f8c") as StructureObserver;

    if (observer1) {
      observer1.observeRoom("E23N36");
    }

    if (observer2) {
      observer2.observeRoom("E23N36");
    }

    if (observer3) {
      observer3.observeRoom("E25N37");
    }
  }
}
