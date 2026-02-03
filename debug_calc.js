
const schedule = {
    amIn: new Date("2026-02-02T08:00:00").getTime(),
    amOut: new Date("2026-02-02T12:00:00").getTime(),
    pmIn: new Date("2026-02-02T13:00:00").getTime(),
    pmOut: new Date("2026-02-02T17:00:00").getTime(),
    otStart: new Date("2026-02-02T17:00:00").getTime(),
    otEnd: new Date("2026-02-02T18:00:00").getTime()
};

function calculateHoursWithinOfficialTime(studentIn, studentOut, officialIn, officialOut) {
    const sIn = new Date(studentIn); sIn.setSeconds(0, 0);
    const sOut = new Date(studentOut); sOut.setSeconds(0, 0);
    const oIn = new Date(officialIn); oIn.setSeconds(0, 0);
    const oOut = new Date(officialOut); oOut.setSeconds(0, 0);

    const start = Math.max(sIn.getTime(), oIn.getTime());
    const end = Math.min(sOut.getTime(), oOut.getTime());

    if (start >= end) return 0;
    return end - start;
}

function calculateSessionDuration(start, end, shift, schedule) {
    if (!start || !end || start >= end) return 0;
    const studentIn = new Date(start);
    const studentOut = new Date(end);
    let officialIn, officialOut;

    if (shift === 'am') {
        officialIn = new Date(schedule.amIn);
        officialOut = new Date(schedule.amOut);
    } else if (shift === 'pm') {
        officialIn = new Date(schedule.pmIn);
        officialOut = new Date(schedule.pmOut);
    } else {
        officialIn = new Date(schedule.otStart);
        officialOut = new Date(schedule.otEnd);
    }

    if (officialIn.getTime() >= officialOut.getTime()) return 0;
    return calculateHoursWithinOfficialTime(studentIn, studentOut, officialIn, officialOut);
}

function calculateShiftDurations(start, end, schedule) {
    return {
        am: calculateSessionDuration(start, end, 'am', schedule),
        pm: calculateSessionDuration(start, end, 'pm', schedule),
        ot: calculateSessionDuration(start, end, 'ot', schedule)
    };
}

// The logic from ui.tsx
function calculateHours(start, end, requireApproved) {
    if (!start || !end) return 0;
    
    const { am, pm, ot } = calculateShiftDurations(start, end, schedule);
    let shiftTotal = am + pm + ot;
    
    console.log(`Shift Calc: am=${am}, pm=${pm}, ot=${ot}, total=${shiftTotal}`);

    if (!requireApproved && (shiftTotal === 0 || isNaN(shiftTotal))) {
        const raw = end - start;
        console.log(`Fallback triggered. Raw=${raw}`);
        if (raw > 0) shiftTotal = raw;
    }

    return shiftTotal;
}

// Test Case: 11:43 to 11:47 within AM window should be 4 minutes
const startTs = new Date("2026-02-02T11:43:00").getTime();
const endTs = new Date("2026-02-02T11:47:00").getTime();

console.log("Testing Off-Schedule Calculation:");
const result = calculateHours(startTs, endTs, false);
console.log(`Result: ${result} ms (${result/60000} mins)`);
