
import { calculateTotalDuration, buildSchedule, ShiftSchedule } from '../src/lib/attendance';

console.log("--- Verifying Real File Logic ---");

// Helper to make date
function makeDate(d: string) {
    return new Date(d);
}

// Config matching the user's report
const config = {
    amIn: "09:00",
    amOut: "12:00",
    pmIn: "13:00",  // 1:00 PM
    pmOut: "17:00", // 5:00 PM
    otIn: "17:00",
    otOut: "18:00"
};

const dateStr = "2026-01-19T00:00:00"; // Jan 19
const baseDate = new Date(dateStr);

// Build schedule using the REAL function
const schedule = buildSchedule(baseDate, config);

console.log("Schedule Built:", {
    amIn: new Date(schedule.amIn).toLocaleString(),
    amOut: new Date(schedule.amOut).toLocaleString(),
    pmIn: new Date(schedule.pmIn).toLocaleString(),
    pmOut: new Date(schedule.pmOut).toLocaleString(),
});

// Jan 19 PM Session
// Time In: 12:45 PM -> 12:45
// Time Out: 5:03 PM -> 17:03
const pmStart = new Date("2026-01-19T12:45:00").getTime();
const pmEnd = new Date("2026-01-19T17:03:00").getTime();

const duration = calculateTotalDuration(pmStart, pmEnd, schedule);

console.log(`Jan 19 PM Duration (Expected ~4h): ${(duration / 3600000).toFixed(2)}h`);

// Jan 20 Morning (1-minute bug check)
// Time In: 9:02 AM -> 09:02
// Time Out: 12:00 PM -> 12:00
const amStart = new Date("2026-01-20T09:02:00").getTime();
const amEnd = new Date("2026-01-20T12:00:00").getTime();

// We need a schedule for Jan 20
const baseDate20 = new Date("2026-01-20T00:00:00");
const schedule20 = buildSchedule(baseDate20, config);

const duration20 = calculateTotalDuration(amStart, amEnd, schedule20);
console.log(`Jan 20 AM Duration (Expected 2.97h or 2h 58m): ${(duration20 / 3600000).toFixed(4)}h`);
console.log(`Jan 20 AM Mins: ${Math.floor(duration20 / 60000)}m`);
