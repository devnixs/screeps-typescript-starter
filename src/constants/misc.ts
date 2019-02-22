export const defaultReusePath = 5;

export const requiredHealersForAnAttack = 5;
export const requiredFightersForAnAttack = 1;

// How much we should store in the terminal
export const wantsToSell: { [roomName: string]: StoreDefinition } = {
  E27N47: {
    energy: 10000,
    [RESOURCE_LEMERGIUM]: 10000
  }
};

export const desiredStocks: { [roomName: string]: StoreDefinition } = {
  E27N47: {
    energy: 0,
    [RESOURCE_LEMERGIUM_ACID]: 20000
  }
};
