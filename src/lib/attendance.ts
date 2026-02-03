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
  const start = Math.max(studentIn.getTime(), officialIn.getTime());
  const end = Math.min(studentOut.getTime(), officialOut.getTime());

  if (start >= end) return 0;

  return end - start;
}

/**
 * Checks if a student is late.
 * Rule: Late if timeIn > officialIn + 1 minute (grace period).
 * Example: Official 8:00. Time In 8:01:00 -> Not Late. Time In 8:01:01 -> Late.
 * @param timeIn Timestamp of student time in
 * @param officialIn Timestamp of official time in
 * @returns boolean
 */
export function isLate(timeIn: number, officialIn: number): boolean {
    if (!timeIn || !officialIn) return false;
    // 1 minute grace period (60000 ms)
    return timeIn > officialIn + 60000;
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
  // A single session can span multiple shifts (e.g. 8am to 5pm)
  // We must calculate overlap for EACH shift independently.
  // calculateSessionDuration handles the overlap/clamping logic (returns 0 if no overlap).
  
  return {
    am: calculateSessionDuration(start, end, 'am', schedule),
    pm: calculateSessionDuration(start, end, 'pm', schedule),
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

export function getManilaDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return {
    year: parseInt(get('year')!),
    month: parseInt(get('month')!),
    day: parseInt(get('day')!),
    hour: parseInt(get('hour')!),
    minute: parseInt(get('minute')!)
  };
}

/**
 * Constructs an absolute Date object for a given time string (HH:mm) interpreted in Manila Time.
 * 
 * @param referenceDate The base date (e.g. student clock-in timestamp)
 * @param timeStr The official time string (e.g. "08:00" or "22:00")
 * @param isNextDay Force the date to be the next day (relative to reference date's Manila date)
 * @param isPrevDay Force the date to be the previous day (relative to reference date's Manila date)
 */
export function getOfficialTimeInManila(referenceDate: Date, timeStr: string, isNextDay: boolean = false, isPrevDay: boolean = false): Date {
  const manila = getManilaDateParts(referenceDate);
  
  // Use parseTime to handle AM/PM and 12h/24h formats robustly
  const { h, m } = parseTime(timeStr);

  // Construct ISO string with Manila offset
  // Note: Manila is strictly UTC+8 (no DST)
  let year = manila.year;
  let month = manila.month;
  let day = manila.day;

  // Handle Date Math properly using a temporary date object
  // We create a date at 12:00 noon Manila time to safely add/sub days
  // (Using strict ISO format for Manila timezone to avoid local env interference)
  const tempDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+08:00`);
  
  if (isNextDay) {
    tempDate.setDate(tempDate.getDate() + 1);
  } else if (isPrevDay) {
    tempDate.setDate(tempDate.getDate() - 1);
  }

  // Extract new YMD
  const newManila = getManilaDateParts(tempDate);
  year = newManila.year;
  month = newManila.month;
  day = newManila.day;

  const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`;
  
  return new Date(isoString);
}

export function buildDateTime(date: Date, h: number, m: number): Date {
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return getOfficialTimeInManila(date, timeStr);
}

export function buildSchedule(
    date: Date,
    config: { amIn: string, amOut: string, pmIn: string, pmOut: string, otIn?: string, otOut?: string },
    otShift?: { start: number, end: number }
): ShiftSchedule {
    
    // Helper to robustly parse hours with context
    const parseShiftTime = (timeStr: string, isPmContext: boolean): { h: number, m: number } => {
    const lower = timeStr.toLowerCase();
    const hasSuffix = lower.includes('am') || lower.includes('pm');
    
    // Strict 24-hour check:
    // 1. Has seconds (e.g. 01:30:00) -> DB format
    // 2. Starts with "0" (e.g. 01:30) -> Leading zero implies 24h/ISO
    // 3. Hour > 12 -> Obviously 24h
    const parts = timeStr.split(':');
    const hPart = parseInt(parts[0], 10);
    const isLikely24Hour = (parts.length === 3) || (timeStr.trim().startsWith('0')) || (hPart > 12);
    
    let { h, m } = parseTime(timeStr);
    
    // If it's a PM context (Afternoon/OT) and the hour is small (1-6), 
    // and it didn't have an explicit AM/PM suffix (parseTime handles suffix),
    // and it's NOT likely 24-hour (which we assume is correct as-is),
    // we might need to adjust.
    if (!hasSuffix && !isLikely24Hour && isPmContext && h >= 1 && h <= 6) {
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
        if (otStart < pmOut) {
            otStart = pmOut; 
            // Fix: Ensure OT End is not before OT Start (e.g. if OT was fully inside PM window)
            if (otEnd < otStart) {
                otEnd = otStart;
            }
        }
    } else {
        // No OT configured -> 0 duration
        otStart = pmOut;
        otEnd = pmOut;
    }

    return { amIn, amOut, pmIn, pmOut, otStart, otEnd };
}

export const formatHours = (ms: number) => {
    if (!ms) return "0h 0m";
    // Round to nearest minute to avoid truncation errors
    const totalMinutes = Math.round(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
};
