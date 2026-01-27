export const BUFFER_START_MS = 30 * 60 * 1000;
export const BUFFER_END_MS = 12 * 60 * 60 * 1000;

export type ShiftSchedule = {
  amIn: number;
  amOut: number;
  pmIn: number;
  pmOut: number;
  otStart: number;
  otEnd: number;
};

export function determineShift(ts: number, schedule: ShiftSchedule): 'am' | 'pm' | 'ot' {
  // Simple logic matching Superadmin
  if (ts < schedule.amOut) return 'am';
  if (ts < schedule.pmOut) return 'pm';
  return 'ot';
}

/**
 * GOLDEN RULE: Calculate hours strictly within official time window.
 * 
 * Total hours = overlap between [studentIn, studentOut] AND [officialIn, officialOut]
 * 
 * Rules:
 * 1. Clamp start to official start (max)
 * 2. Clamp end to official end (min)
 * 3. If clamped start >= clamped end, duration is 0
 * 4. Return duration in milliseconds (to be formatted later)
 */
export function calculateHoursWithinOfficialTime(
  studentIn: Date,
  studentOut: Date,
  officialIn: Date,
  officialOut: Date
): number {
  // CLONE dates and ZERO OUT seconds/ms to ensure minute-level precision
  // "Always calculate in MINUTES first"
  const sIn = new Date(studentIn); sIn.setSeconds(0, 0);
  const sOut = new Date(studentOut); sOut.setSeconds(0, 0);
  const oIn = new Date(officialIn); oIn.setSeconds(0, 0);
  const oOut = new Date(officialOut); oOut.setSeconds(0, 0);

  const start = Math.max(sIn.getTime(), oIn.getTime());
  const end = Math.min(sOut.getTime(), oOut.getTime());

  if (start >= end) return 0;

  return end - start;
}

export function calculateSessionDuration(
  start: number,
  end: number,
  shift: 'am' | 'pm' | 'ot',
  schedule: ShiftSchedule,
  isApproved: boolean = false
): number {
  if (!start || !end || start >= end) return 0;

  const studentIn = new Date(start);
  const studentOut = new Date(end);
  let officialIn: Date;
  let officialOut: Date;

  // Determine official window based on shift
  if (shift === 'am') {
    officialIn = new Date(schedule.amIn);
    officialOut = new Date(schedule.amOut);
  } else if (shift === 'pm') {
    officialIn = new Date(schedule.pmIn);
    officialOut = new Date(schedule.pmOut);
  } else { // ot
    officialIn = new Date(schedule.otStart);
    officialOut = new Date(schedule.otEnd);
  }

  // Hard Guard: Validate official window
  if (officialIn.getTime() >= officialOut.getTime()) {
      // If start > end, it's a genuine error (invalid window)
      if (officialIn.getTime() > officialOut.getTime()) {
        console.error("INVALID SHIFT WINDOW DETECTED", {
            shift,
            officialIn: officialIn.toLocaleString(),
            officialOut: officialOut.toLocaleString(),
            scheduleRaw: schedule,
            reason: "Official Start >= Official End"
        });
      }
      // If start == end, it's just a zero-duration shift (e.g. not scheduled), return 0 gracefully.
      return 0;
  }

  // Use the Golden Rule function
  // Note: We return milliseconds to maintain compatibility with existing code
  // which expects ms for formatting (e.g. formatHours).
  return calculateHoursWithinOfficialTime(studentIn, studentOut, officialIn, officialOut);
}

export function calculateShiftDurations(
  start: number,
  end: number,
  schedule: ShiftSchedule
): { am: number; pm: number; ot: number } {
  const isAmStart = start < schedule.amOut;

  if (isAmStart) {
    return {
      am: calculateSessionDuration(start, end, 'am', schedule),
      pm: 0,
      ot: 0
    };
  }

  const isPmStart = start < schedule.pmOut;

  if (isPmStart) {
    return {
      am: 0,
      pm: calculateSessionDuration(start, end, 'pm', schedule),
      ot: 0
    };
  }

  return {
    am: 0,
    pm: 0,
    ot: calculateSessionDuration(start, end, 'ot', schedule)
  };
}

/**
 * Calculates the total duration of a session across all shifts (AM, PM, OT).
 * 
 * NOTE: This function does NOT apply any policy penalties (like Missed Lunch Punch).
 * It purely calculates the raw duration based on the Golden Rule.
 * Policy violations should be detected separately (e.g. using checkSessionFlags).
 */
export function calculateTotalDuration(
  start: number,
  end: number,
  schedule: ShiftSchedule
): number {
    const { am, pm, ot } = calculateShiftDurations(start, end, schedule);
    return am + pm + ot;
}

export function checkSessionFlags(
  start: number,
  end: number,
  schedule: ShiftSchedule
): string[] {
  const flags: string[] = [];
  if (!start || !end || start >= end) return flags;

  // Check for "Missed Lunch Punch"
  // Definition: A single session that spans across AM and PM windows.
  // We need to check if the session overlaps with BOTH AM and PM.
  
  const amIn = schedule.amIn;
  const amOut = schedule.amOut;
  const pmIn = schedule.pmIn;
  const pmOut = schedule.pmOut;

  // Simple overlap check
  const overlapsAM = (start < amOut) && (end > amIn);
  const overlapsPM = (start < pmOut) && (end > pmIn);

  if (overlapsAM && overlapsPM) {
      // Check if the gap (lunch) is covered by the session
      // If the session starts before AM Out and ends after PM In, it bridges the gap.
      // (Assuming AM Out < PM In)
      if (start <= amOut && end >= pmIn) {
          flags.push("MISSED_LUNCH_PUNCH");
      }
  }

  return flags;
}

// --- Helper Functions for Schedule Building ---

export function toPm(t: string): string {
  if (!t) return t;
  const lower = t.toLowerCase();
  if (lower.includes('m')) return t; // Already has am/pm
  
  const parts = t.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  
  // Logic: If it's a small number (1-6) and no suffix, assume PM context for PM fields
  // BUT this function is generic "toPm". 
  // Better: Just convert to 24h if it looks like 12h without suffix?
  // No, 1:00 -> 13:00. 12:00 -> 12:00. 11:00 -> 23:00? No.
  
  if (h > 0 && h <= 6) h += 12; // Assume 1-6 without suffix is PM (13-18)
  
  return `${h.toString().padStart(2, '0')}:${m}`;
}

export function normalizeTimeString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const h = parts[0]?.padStart(2, "0");
  const m = parts[1]?.padStart(2, "0");
  if (!h || !m) return null;
  return `${h}:${m}`;
}

export function formatDisplayTime(raw: string | null | undefined): string {
  const t = normalizeTimeString(raw);
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr || 0);
  const m = Number(mStr || 0);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const mm = String(m).padStart(2, "0");
  return `${h}:${mm} ${suffix}`;
}

export function timeStringToMinutes(raw: string | null | undefined): number {
  const t = normalizeTimeString(raw);
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function parseTime(timeStr: string): { h: number, m: number } {
  if (!timeStr) return { h: 0, m: 0 };
  
  // Handle "8:00 AM" or "8:00"
  const lower = timeStr.toLowerCase();
  // Remove am/pm for splitting
  const cleanTime = timeStr.replace(/am|pm|AM|PM/g, '').trim();
  const [hStr, mStr] = cleanTime.split(':');
  
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);

  if (lower.includes("pm") && h < 12) h += 12;
  if (lower.includes("am") && h === 12) h = 0;
  
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

export function buildDateTime(date: Date, h: number, m: number): Date {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
}

export function buildSchedule(
    date: Date,
    config: { amIn: string, amOut: string, pmIn: string, pmOut: string, otIn?: string, otOut?: string },
    otShift?: { start: number, end: number }
): ShiftSchedule {
    
    // Helper to robustly parse hours with context
    const parseShiftTime = (timeStr: string, isPmContext: boolean): { h: number, m: number } => {
        let { h, m } = parseTime(timeStr);
        
        // If it's a PM context (Afternoon/OT) and the hour is small (1-6), 
        // and it didn't have an explicit AM/PM suffix (parseTime handles suffix),
        // we might need to adjust.
        // parseTime returns 0-23.
        // If input was "1:00" (no suffix), parseTime returns 1.
        // If input was "1:00 PM", parseTime returns 13.
        // We only want to adjust if it looks like 12h format without suffix in a PM slot.
        // How do we know if it had suffix? parseTime strips it.
        // But we can check raw string or just assume:
        // If isPmContext is true, and h is in [1, 6], assume PM (13-18).
        if (isPmContext && h >= 1 && h <= 6) {
             h += 12;
        }
        
        return { h, m };
    };

    const amInVal = parseShiftTime(config.amIn, false);
    const amOutVal = parseShiftTime(config.amOut, false);
    const pmInVal = parseShiftTime(config.pmIn, true);
    const pmOutVal = parseShiftTime(config.pmOut, true);
    const otInVal = parseShiftTime(config.otIn || "", true);
    const otOutVal = parseShiftTime(config.otOut || "", true);

    let amIn = buildDateTime(date, amInVal.h, amInVal.m).getTime();
    let amOut = buildDateTime(date, amOutVal.h, amOutVal.m).getTime();

    // Auto-correct AM window crossing (e.g. 12:00 PM entered as 12:00 AM or 1:00 PM as 1:00)
    if (amOut < amIn) amOut += 12 * 3600 * 1000;
    if (amOut < amIn) amOut += 12 * 3600 * 1000; // Handle 24h wrap

    let pmIn = buildDateTime(date, pmInVal.h, pmInVal.m).getTime();
    let pmOut = buildDateTime(date, pmOutVal.h, pmOutVal.m).getTime();

    // Auto-correct PM window crossing
    if (pmOut < pmIn) pmOut += 12 * 3600 * 1000;
    if (pmOut < pmIn) pmOut += 12 * 3600 * 1000;
    
    let otStart, otEnd;
    if (otShift) {
        otStart = otShift.start;
        otEnd = otShift.end;
    } else if (config.otIn && config.otOut) {
        otStart = buildDateTime(date, otInVal.h, otInVal.m).getTime();
        otEnd = buildDateTime(date, otOutVal.h, otOutVal.m).getTime();

        // Auto-correct OT window
        if (otEnd < otStart) otEnd += 12 * 3600 * 1000;
        if (otEnd < otStart) otEnd += 12 * 3600 * 1000;
        
        // Basic OT adjustments
        if (otStart < pmOut) otStart = pmOut; 
    } else {
        // No OT configured -> 0 duration
        otStart = pmOut;
        otEnd = pmOut;
    }

    return { amIn, amOut, pmIn, pmOut, otStart, otEnd };
}

export const formatHours = (ms: number) => {
    if (!ms) return "";
    // Round to nearest minute to avoid truncation errors
    const totalMinutes = Math.round(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
};
