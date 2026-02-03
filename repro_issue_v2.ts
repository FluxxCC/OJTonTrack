
// Helper copied from src/lib/attendance.ts
function calculateHoursWithinOfficialTime(
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

// Mock formatTime from UI
const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// Test Case
const sInTime = "2023-01-01T04:13:59";
const sOutTime = "2023-01-01T04:15:01";
const oInTime = "2023-01-01T04:00:00";
const oOutTime = "2023-01-01T05:00:00";

const sIn = new Date(sInTime);
const sOut = new Date(sOutTime);
const oIn = new Date(oInTime);
const oOut = new Date(oOutTime);

console.log("sIn:", sIn.toISOString());
console.log("sOut:", sOut.toISOString());
console.log("Displayed In:", formatTime(sIn.getTime()));
console.log("Displayed Out:", formatTime(sOut.getTime()));

const duration = calculateHoursWithinOfficialTime(sIn, sOut, oIn, oOut);
console.log("Duration (ms):", duration);
console.log("Duration (mins):", duration / 60000);

// Test Case 2: 4:14:00 to 4:15:59
const sIn2 = new Date("2023-01-01T04:14:00");
const sOut2 = new Date("2023-01-01T04:15:59");

console.log("\nCase 2:");
console.log("Displayed In:", formatTime(sIn2.getTime()));
console.log("Displayed Out:", formatTime(sOut2.getTime()));
const dur2 = calculateHoursWithinOfficialTime(sIn2, sOut2, oIn, oOut);
console.log("Duration (mins):", dur2 / 60000);

// Test Case 3: 4:14:59 to 4:15:01
const sIn3 = new Date("2023-01-01T04:14:59");
const sOut3 = new Date("2023-01-01T04:15:01");

console.log("\nCase 3:");
console.log("Displayed In:", formatTime(sIn3.getTime()));
console.log("Displayed Out:", formatTime(sOut3.getTime()));
const dur3 = calculateHoursWithinOfficialTime(sIn3, sOut3, oIn, oOut);
console.log("Duration (mins):", dur3 / 60000);

// Test Case 4: 4:13:30 to 4:15:30 (Rounding?)
const sIn4 = new Date("2023-01-01T04:13:30");
const sOut4 = new Date("2023-01-01T04:15:30");

console.log("\nCase 4:");
console.log("Displayed In:", formatTime(sIn4.getTime()));
console.log("Displayed Out:", formatTime(sOut4.getTime()));
const dur4 = calculateHoursWithinOfficialTime(sIn4, sOut4, oIn, oOut);
console.log("Duration (mins):", dur4 / 60000);
