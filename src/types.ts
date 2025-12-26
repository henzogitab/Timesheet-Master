export type Causal =
  | "Ufficio"
  | "Smart"
  | "Ferie"
  | "Malattia"
  | "104"
  | "Art.25"
  | "Art.26"
  | "FS"
  | "PSTU"
  | "PESA"
  | "Weekend"
  | "Festa";

export interface LongDayConfig {
  startDate: string; // ISO YYYY-MM-DD
  days: number[]; // Max 2 elements
}

export type SWLimit = 6 | 8 | 10;
export type TimeClassType = "alternated" | "flat";

export interface SmartWorkingConfig {
  startDate: string; // ISO YYYY-MM-DD
  limit: SWLimit;
}

export interface TimeClassConfig {
  startDate: string; // ISO YYYY-MM-DD
  type: TimeClassType;
}

export interface UserSettings {
  userName: string;
  initialFerie: number;
  monthlyFerieAccrual: number;
  bankHoursInitial: number;
  patronSaintDate: string; // MM-DD format
  longDayConfigs: LongDayConfig[];
  swConfigs: SmartWorkingConfig[];
  timeClassConfigs: TimeClassConfig[];
}

export interface AppState {
  entries: Record<string, DailyEntry>;
  settings: UserSettings;
  paidHours: Record<string, number>; // key: YYYY-MM, value: minutes
  dayOverrides?: Record<string, "long" | "short">; // Scambi una tantum
}

export interface DailyEntry {
  date: string; // ISO format YYYY-MM-DD
  causal: Causal;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  permessoMinutes: number;
  notes?: string;
  springRequest?: boolean; // Richiesto su gestionale HR
}

export interface DayStats {
  workedMinutes: number;
  targetMinutes: number;
  buonoPasto: boolean;
  isHoliday: boolean;
  isLongDay: boolean;
  timeClass: TimeClassType;
  errors: string[];
}
