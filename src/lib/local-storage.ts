// Local Storage Service for Offline-First Data Persistence

const STORAGE_KEYS = {
  CURRENT_USER: 'ops_current_user',
  CURRENT_SHIFT: 'ops_current_shift',
  CART: 'ops_cart',
  OFFLINE_TRANSACTIONS: 'ops_offline_transactions',
  TABLES: 'ops_tables',
  ORDERS: 'ops_orders',
  SETTINGS: 'ops_settings',
  APP_STATE: 'ops_app_state',
  THEME: 'ops_theme',
} as const;

export interface ShiftData {
  id: string;
  staffId: string;
  staffName: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  totalSales: number;
  transactions: number;
  status: 'open' | 'closed';
}

export interface OfflineTransaction {
  id: string;
  type: 'sale' | 'refund';
  items: any[];
  total: number;
  paymentMethod: string;
  timestamp: string;
  synced: boolean;
  shiftId: string;
  staffId: string;
}

export interface AppSettings {
  businessName: string;
  taxRate: number;
  printerEnabled: boolean;
  soundEnabled: boolean;
  offlineMode: boolean;
  currency: string;
  branches: Branch[];
  activatedModuleIds: string[];
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMain: boolean;
}

// Generic storage helpers
const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const setItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
};

const removeItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key} from localStorage:`, error);
  }
};

// User Session
export const getCurrentUser = () => getItem<{ id: string; name: string; role: string } | null>(STORAGE_KEYS.CURRENT_USER, null);
export const setCurrentUser = (user: { id: string; name: string; role: string } | null) => {
  if (user) {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
  } else {
    removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

// Shift Management
export const getCurrentShift = () => getItem<ShiftData | null>(STORAGE_KEYS.CURRENT_SHIFT, null);
export const setCurrentShift = (shift: ShiftData | null) => {
  if (shift) {
    setItem(STORAGE_KEYS.CURRENT_SHIFT, shift);
  } else {
    removeItem(STORAGE_KEYS.CURRENT_SHIFT);
  }
};

// Cart
export const getCart = () => getItem<any[]>(STORAGE_KEYS.CART, []);
export const setCart = (cart: any[]) => setItem(STORAGE_KEYS.CART, cart);
export const clearCart = () => removeItem(STORAGE_KEYS.CART);

// Offline Transactions
export const getOfflineTransactions = () => getItem<OfflineTransaction[]>(STORAGE_KEYS.OFFLINE_TRANSACTIONS, []);
export const addOfflineTransaction = (transaction: OfflineTransaction) => {
  const transactions = getOfflineTransactions();
  transactions.push(transaction);
  setItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS, transactions);
};
export const markTransactionSynced = (id: string) => {
  const transactions = getOfflineTransactions();
  const updated = (Array.isArray(transactions) ? transactions : []).map(t => t.id === id ? { ...t, synced: true } : t);
  setItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS, updated);
};
export const getUnsyncedTransactions = () => getOfflineTransactions().filter(t => !t.synced);

// Tables State
export const getTables = () => getItem<any[]>(STORAGE_KEYS.TABLES, []);
export const setTables = (tables: any[]) => setItem(STORAGE_KEYS.TABLES, tables);

// Orders
export const getOrders = () => getItem<any[]>(STORAGE_KEYS.ORDERS, []);
export const setOrders = (orders: any[]) => setItem(STORAGE_KEYS.ORDERS, orders);
export const addOrder = (order: any) => {
  const orders = getOrders();
  orders.push(order);
  setItem(STORAGE_KEYS.ORDERS, orders);
};

// Settings
export const getSettings = (): AppSettings => getItem<AppSettings>(STORAGE_KEYS.SETTINGS, {
  businessName: 'My Business',
  taxRate: 8.5,
  printerEnabled: true,
  soundEnabled: true,
  offlineMode: false,
  currency: 'IDR',
  branches: [
    { id: '1', name: 'Main Branch', address: '123 Main St', phone: '555-0100', isMain: true },
  ],
  activatedModuleIds: [],
});
export const setSettings = (settings: AppSettings) => setItem(STORAGE_KEYS.SETTINGS, settings);

// App State
export const getAppState = () => getItem<{ lastSync: string; isOnline: boolean }>(STORAGE_KEYS.APP_STATE, {
  lastSync: new Date().toISOString(),
  isOnline: true,
});
export const setAppState = (state: { lastSync: string; isOnline: boolean }) => setItem(STORAGE_KEYS.APP_STATE, state);

// Theme
export const getTheme = () => getItem<'light' | 'dark'>(STORAGE_KEYS.THEME, 'dark');
export const setTheme = (theme: 'light' | 'dark') => setItem(STORAGE_KEYS.THEME, theme);

// Clear all data (for logout/reset)
export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => removeItem(key));
};

// Check if we're online
export const checkOnlineStatus = (): boolean => {
  return navigator.onLine;
};

// Sync helper - returns count of items needing sync
export const getPendingSyncCount = (): number => {
  return getUnsyncedTransactions().length;
};
