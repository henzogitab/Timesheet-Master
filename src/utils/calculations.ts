import {
  ITALIAN_HOLIDAYS,
  TARGET_MINUTES_LONG,
  TARGET_MINUTES_SHORT,
  TARGET_MINUTES_FLAT,
  BREAK_MINUTES,
  LIMITS,
} from "./constants";
import {
  DailyEntry,
  DayStats,
  UserSettings,
  AppState,
  Causal,
  SmartWorkingConfig,
  TimeClassConfig,
} from "../types";

export const formatDateISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseISOLocal = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const isHoliday = (date: Date, patronSaint?: string): boolean => {
  const m = date.getMonth();
  const d = date.getDate();
  const isFixed = ITALIAN_HOLIDAYS.some((h) => h.month === m && h.day === d);
  if (isFixed) return true;
  if (patronSaint) {
    const [sm, sd] = patronSaint.split("-").map(Number);
    return m + 1 === sm && d === sd;
  }
  return false;
};

export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const prefix = minutes < 0 ? "-" : "";
  return `${prefix}${h}h ${m.toString().padStart(2, "0")}m`;
};

export const getTimeClassForDate = (
  date: Date,
  configs: TimeClassConfig[]
): TimeClassConfig => {
  const dateStr = formatDateISO(date);
  const sorted = [...configs].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );
  return (
    sorted.find((c) => dateStr >= c.startDate) || {
      startDate: "2020-01-01",
      type: "alternated",
    }
  );
};

export const getLongDayInfo = (
  date: Date,
  configs: UserSettings["longDayConfigs"],
  overrides?: Record<string, "long" | "short">
): boolean => {
  const dateStr = formatDateISO(date);
  if (overrides && overrides[dateStr]) {
    return overrides[dateStr] === "long";
  }
  const sorted = [...configs].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );
  const activeConfig = sorted.find((c) => dateStr >= c.startDate);
  return activeConfig ? activeConfig.days.includes(date.getDay()) : false;
};

export const getSWConfigForDate = (
  date: Date,
  configs: SmartWorkingConfig[]
): SmartWorkingConfig => {
  const dateStr = formatDateISO(date);
  const sorted = [...configs].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );
  return (
    sorted.find((c) => dateStr >= c.startDate) || {
      startDate: "2020-01-01",
      limit: 8,
    }
  );
};

export const getDefaultEntry = (
  date: Date,
  settings: UserSettings,
  overrides?: Record<string, "long" | "short">
): DailyEntry => {
  const holiday = isHoliday(date, settings.patronSaintDate);
  const timeClass = getTimeClassForDate(date, settings.timeClassConfigs);
  const isLong =
    timeClass.type === "alternated" &&
    getLongDayInfo(date, settings.longDayConfigs, overrides);

  let endTime = "13:30";
  if (timeClass.type === "flat") {
    endTime = "15:12"; // 7h 12m + 30m break = 7h 42m total. 07:30 + 462 min = 15:12
  } else if (isLong) {
    endTime = "17:00";
  }

  return {
    date: formatDateISO(date),
    causal: (holiday ? "Festa" : "Ufficio") as Causal,
    startTime: holiday ? "00:00" : "07:30",
    endTime: holiday ? "00:00" : endTime,
    permessoMinutes: 0,
    notes: holiday
      ? "Giorno Festivo"
      : isLong
      ? "Default Ufficio (Lunga)"
      : "Default Ufficio (Corta)",
  };
};

export const calculateDayStats = (
  date: Date,
  entry: DailyEntry | undefined,
  settings: UserSettings,
  overrides?: Record<string, "long" | "short">
): DayStats => {
  const timeClassConfig = getTimeClassForDate(date, settings.timeClassConfigs);
  const isLongDay =
    timeClassConfig.type === "alternated" &&
    getLongDayInfo(date, settings.longDayConfigs, overrides);
  const holiday = isHoliday(date, settings.patronSaintDate);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  let targetMinutes = 0;
  if (!holiday && !isWeekend) {
    if (timeClassConfig.type === "flat") {
      targetMinutes = TARGET_MINUTES_FLAT;
    } else {
      targetMinutes = isLongDay ? TARGET_MINUTES_LONG : TARGET_MINUTES_SHORT;
    }
  }

  const effectiveCausal = entry?.causal || (holiday ? "Festa" : "Ufficio");

  if (effectiveCausal === "Festa" || effectiveCausal === "Weekend") {
    return {
      workedMinutes: 0,
      targetMinutes: 0,
      buonoPasto: false,
      isHoliday: holiday,
      isLongDay,
      timeClass: timeClassConfig.type,
      errors: [],
    };
  }

  const effectiveEntry =
    entry ||
    (!isWeekend ? getDefaultEntry(date, settings, overrides) : undefined);
  if (!effectiveEntry) {
    return {
      workedMinutes: 0,
      targetMinutes: 0,
      buonoPasto: false,
      isHoliday: holiday,
      isLongDay,
      timeClass: timeClassConfig.type,
      errors: [],
    };
  }

  let workedMinutes = 0;
  const startMinRaw = timeToMinutes(effectiveEntry.startTime);
  const startMinEffective = Math.max(startMinRaw, timeToMinutes("07:30"));
  const endMin = timeToMinutes(effectiveEntry.endTime);
  const rawDiff = endMin - startMinEffective;

  if (
    effectiveEntry.causal === "Ufficio" ||
    effectiveEntry.causal === "Smart"
  ) {
    if (timeClassConfig.type === "flat" || isLongDay) {
      workedMinutes = rawDiff - BREAK_MINUTES;
    } else {
      if (rawDiff > 360) {
        workedMinutes = rawDiff <= 390 ? 360 : rawDiff - BREAK_MINUTES;
      } else {
        workedMinutes = rawDiff;
      }
    }
    // Cap a 9h (540m)
    if (workedMinutes > 540) workedMinutes = 540;
  } else if (!holiday && !isWeekend) {
    workedMinutes = targetMinutes;
  }

  workedMinutes += effectiveEntry.permessoMinutes || 0;
  if (
    workedMinutes > 540 &&
    (effectiveEntry.causal === "Ufficio" || effectiveEntry.causal === "Smart")
  ) {
    workedMinutes = 540;
  }

  let buonoPasto = false;
  if (effectiveEntry.causal === "Smart") {
    buonoPasto = timeClassConfig.type === "flat" || isLongDay;
  } else if (effectiveEntry.causal === "Ufficio") {
    if (timeClassConfig.type === "flat" || isLongDay) {
      buonoPasto = endMin > timeToMinutes("15:12");
    } else {
      buonoPasto = endMin > startMinRaw + 565;
    }
  } else if (effectiveEntry.causal === "PSTU") {
    if (timeClassConfig.type === "flat" || isLongDay) buonoPasto = true;
  }

  return {
    workedMinutes,
    targetMinutes,
    buonoPasto,
    isHoliday: holiday,
    isLongDay,
    timeClass: timeClassConfig.type,
    errors: [],
  };
};

export const calculatePresenceInPeriod = (
  startDate: Date,
  endDate: Date,
  entries: Record<string, DailyEntry>,
  settings: UserSettings,
  overrides?: Record<string, "long" | "short">
): number => {
  let presence = 0;
  let current = new Date(startDate.getTime());
  current.setHours(12, 0, 0, 0);

  while (current <= endDate) {
    const dateStr = formatDateISO(current);
    const dayOfWeek = current.getDay();
    const isWkEnd = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWkEnd) {
      const holiday = isHoliday(current, settings.patronSaintDate);
      const entry = entries[dateStr];
      const causal = entry?.causal || (holiday ? "Festa" : "Ufficio");

      if (["Ufficio", "Smart", "Ferie", "FS"].includes(causal)) {
        presence += 1;
      } else if (causal === "PSTU") {
        const stats = calculateDayStats(current, entry, settings, overrides);
        const target = stats.targetMinutes > 0 ? stats.targetMinutes : 360;
        const deduction = (entry?.permessoMinutes || 0) / target;
        // La presenza è 1 (il giorno intero) meno la frazione di assenza
        presence += Math.max(0, 1 - deduction);
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return presence;
};

export const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const validateState = (date: Date, state: AppState): string[] => {
  const errors: string[] = [];
  const dateStr = formatDateISO(date);
  const entry = state.entries[dateStr];
  if (!entry) return errors;

  const yearStr = date.getFullYear().toString();
  const monthStr = `${yearStr}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
  const entries = Object.values(state.entries) as DailyEntry[];
  const monthEntries = entries.filter((e) => e.date.startsWith(monthStr));

  if (entry.causal === "Smart") {
    const swConfig = getSWConfigForDate(date, state.settings.swConfigs);
    const timeClass = getTimeClassForDate(
      date,
      state.settings.timeClassConfigs
    );
    const swMonthCount = monthEntries.filter(
      (e) => e.causal === "Smart"
    ).length;

    // Limite mensile sempre attivo
    if (swMonthCount > swConfig.limit) {
      errors.push(
        `Limite mensile Smart Working superato (${swMonthCount}/${swConfig.limit})`
      );
    }

    // Limiti settimanali saltati se FLAT o se limite 10
    if (timeClass.type === "alternated" && swConfig.limit !== 10) {
      const { start, end } = getWeekRange(date);
      const weekEntries = entries.filter((e) => {
        const d = parseISOLocal(e.date);
        return d >= start && d <= end;
      });

      const swWeekCount = weekEntries.filter(
        (e) => e.causal === "Smart"
      ).length;
      if (swWeekCount > LIMITS.SW_WEEK_MAX) {
        errors.push(
          `Limite settimanale Smart Working superato (${swWeekCount}/${LIMITS.SW_WEEK_MAX})`
        );
      }

      const swLongWeekCount = weekEntries.filter((e) => {
        if (e.causal !== "Smart") return false;
        const d = parseISOLocal(e.date);
        return getLongDayInfo(
          d,
          state.settings.longDayConfigs,
          state.dayOverrides
        );
      }).length;

      if (swLongWeekCount > LIMITS.SW_LONG_WEEK_MAX) {
        errors.push(
          `Limite settimanale Smart Working in giorni lunghi superato (${swLongWeekCount}/${LIMITS.SW_LONG_WEEK_MAX})`
        );
      }
    }
  }
  return errors;
};
