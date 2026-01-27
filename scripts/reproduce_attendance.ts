
import { calculateTotalDuration, calculateSessionDuration, ShiftSchedule } from '../src/lib/attendance';

// Helper to create date timestamps
function makeTime(baseDate: string, hour: number, minute: number): number {
    const d = new Date(baseDate);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
}

// Default Schedule: 9-12, 1-5
const getSchedule = (baseDate: string): ShiftSchedule => {
    return {
        amIn: makeTime(baseDate, 9, 0),
        amOut: makeTime(baseDate, 12, 0),
        pmIn: makeTime(baseDate, 13, 0),
        pmOut: makeTime(baseDate, 17, 0),
        otStart: makeTime(baseDate, 17, 30),
        otEnd: makeTime(baseDate, 20, 30)
    };
};

console.log("--- Reproducing User Scenarios ---");

// Scenario 1: Jan 19
// Session 1: 8:39 AM - 12:42 PM
// Session 2: 12:45 PM - 5:03 PM
const date1 = '2026-01-19T00:00:00';
const sched1 = getSchedule(date1);

const s1_start = makeTime(date1, 8, 39);
const s1_end = makeTime(date1, 12, 42);
const s1_dur = calculateTotalDuration(s1_start, s1_end, sched1);

const s2_start = makeTime(date1, 12, 45);
const s2_end = makeTime(date1, 17, 3);
const s2_dur = calculateTotalDuration(s2_start, s2_end, sched1);

console.log(`Jan 19 Session 1 (8:39-12:42): ${(s1_dur / 3600000).toFixed(2)}h`);
console.log(`Jan 19 Session 2 (12:45-17:03): ${(s2_dur / 3600000).toFixed(2)}h`);
console.log(`Jan 19 Total: ${((s1_dur + s2_dur) / 3600000).toFixed(2)}h`);


// Scenario 2: Jan 20
// Session 1: 9:02 AM - 12:00 PM
// Session 2: 2:05 PM - 5:26 PM
const date2 = '2026-01-20T00:00:00';
const sched2 = getSchedule(date2);

const s2_1_start = makeTime(date2, 9, 2);
const s2_1_end = makeTime(date2, 12, 0);
const s2_1_dur = calculateTotalDuration(s2_1_start, s2_1_end, sched2);

const s2_2_start = makeTime(date2, 14, 5); // 2:05 PM
const s2_2_end = makeTime(date2, 17, 26);
const s2_2_dur = calculateTotalDuration(s2_2_start, s2_2_end, sched2);

console.log(`Jan 20 Session 1 (9:02-12:00): ${(s2_1_dur / 3600000).toFixed(2)}h`);
console.log(`Jan 20 Session 2 (14:05-17:26): ${(s2_2_dur / 3600000).toFixed(2)}h`);
console.log(`Jan 20 Total: ${((s2_1_dur + s2_2_dur) / 3600000).toFixed(2)}h`);

