export const defaultReusePath = 15;

export const requiredHealersForAnAttack = 0;
export const requiredFightersForAnAttack = 1;
export const requiredDismantlersForAnAttack = 2;

/*
var calc = (roomLevel, power)=>Math.pow(roomLevel, power) * (25000000 / Math.pow(8, power));
[1,2,3,4,5,6,7,8].map(i=>calc(i, 9)).map(i=>Math.round(i/1000000*100)/100)

result:
[0, 0, 0, 0.05, 0.36, 1.88, 7.52, 25]
*/

export const wallsMinHp = (roomLevel: number) => {
  // level 8 = 15M
  const power = 9;
  return Math.pow(roomLevel, power) * (25000000 / Math.pow(8, power));
};

export const rampartMinHp = (roomLevel: number) => {
  // level 8 = 15M
  const power = 9;
  return Math.pow(roomLevel, power) * (25000000 / Math.pow(8, power));
};

// How much we should store in the terminal
export const wantsToSell: { [roomName: string]: StoreDefinition } = {
  E27N47: {
    energy: 10000,
    [RESOURCE_LEMERGIUM]: 10000
  },
  E25N48: {
    energy: 10000,
    [RESOURCE_OXYGEN]: 10000
  }
};

// limit boosts to N parts
export const boostsLimitations: { [key: string]: number } = {
  // [TOUGH]: 5
};

export const desiredEnergyInTerminal = 26000;

export const buyableElements = [
  RESOURCE_HYDROGEN,
  RESOURCE_OXYGEN,
  RESOURCE_UTRIUM,
  RESOURCE_LEMERGIUM,
  RESOURCE_KEANIUM,
  RESOURCE_ZYNTHIUM,
  RESOURCE_CATALYST
];

export const sellableElements = [
  RESOURCE_HYDROGEN,
  RESOURCE_OXYGEN,
  RESOURCE_UTRIUM,
  RESOURCE_LEMERGIUM,
  RESOURCE_KEANIUM,
  RESOURCE_ZYNTHIUM,
  RESOURCE_CATALYST
] as string[];

export const desiredStocks: StoreDefinitionWithoutEnergy = {
  // E27N47: {
  // Base minerals
  [RESOURCE_HYDROGEN]: 5000,
  [RESOURCE_OXYGEN]: 5000,
  [RESOURCE_UTRIUM]: 5000,
  [RESOURCE_LEMERGIUM]: 5000,
  [RESOURCE_KEANIUM]: 5000,
  [RESOURCE_ZYNTHIUM]: 5000,
  [RESOURCE_CATALYST]: 1000,
  [RESOURCE_GHODIUM]: 5000,

  [RESOURCE_HYDROXIDE]: 1000,
  [RESOURCE_ZYNTHIUM_KEANITE]: 1000,
  [RESOURCE_UTRIUM_LEMERGITE]: 1000,

  [RESOURCE_UTRIUM_HYDRIDE]: 1000,
  [RESOURCE_UTRIUM_OXIDE]: 0,
  [RESOURCE_KEANIUM_HYDRIDE]: 0,
  [RESOURCE_KEANIUM_OXIDE]: 10000,
  [RESOURCE_LEMERGIUM_HYDRIDE]: 0,
  [RESOURCE_LEMERGIUM_OXIDE]: 1000,
  [RESOURCE_ZYNTHIUM_HYDRIDE]: 1000,
  [RESOURCE_ZYNTHIUM_OXIDE]: 1000,
  [RESOURCE_GHODIUM_HYDRIDE]: 0,
  [RESOURCE_GHODIUM_OXIDE]: 5000,

  [RESOURCE_UTRIUM_ACID]: 1000,
  [RESOURCE_UTRIUM_ALKALIDE]: 0,
  [RESOURCE_KEANIUM_ACID]: 0,
  [RESOURCE_KEANIUM_ALKALIDE]: 20000,
  [RESOURCE_LEMERGIUM_ACID]: 0,
  [RESOURCE_LEMERGIUM_ALKALIDE]: 10000,
  [RESOURCE_ZYNTHIUM_ACID]: 1000,
  [RESOURCE_ZYNTHIUM_ALKALIDE]: 2000,
  [RESOURCE_GHODIUM_ACID]: 0,
  [RESOURCE_GHODIUM_ALKALIDE]: 5000,

  [RESOURCE_CATALYZED_UTRIUM_ACID]: 0,
  [RESOURCE_CATALYZED_UTRIUM_ALKALIDE]: 0,
  [RESOURCE_CATALYZED_KEANIUM_ACID]: 0,
  [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: 20000,
  [RESOURCE_CATALYZED_LEMERGIUM_ACID]: 0,
  [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 10000,
  [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: 1000,
  [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: 2000,
  [RESOURCE_CATALYZED_GHODIUM_ACID]: 0,
  [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: 5000
};

export const signature = "(V)  (°,,,,°)  (V)";

export const buildRangeFromRoomLimit = 7;
