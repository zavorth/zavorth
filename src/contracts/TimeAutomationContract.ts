export type ZavorthTimeWindow = {
  start: string;
  end: string;
};

export type ZavorthDaySchedule = {
  day:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  workingHours: ZavorthTimeWindow | null;
  focusHours: ZavorthTimeWindow | null;
  available: boolean;
};

export type ZavorthTimeAutomationPolicy = {
  schemaVersion: 'zavorth.time-automation.policy/v1';
  timezone: string;
  schedules: ZavorthDaySchedule[];
  weekendPolicy: 'normal' | 'reduced' | 'urgent-only';
  updatedAt: string;
};
