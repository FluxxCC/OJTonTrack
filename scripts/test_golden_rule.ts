
function calculateHoursWithinOfficialTime(
  studentIn: Date | string | number,
  studentOut: Date | string | number,
  officialIn: Date | string | number,
  officialOut: Date | string | number
) {
  // CLONE dates and ZERO OUT seconds/ms to ensure minute-level precision
  const sIn = new Date(studentIn); sIn.setSeconds(0, 0);
  const sOut = new Date(studentOut); sOut.setSeconds(0, 0);
  const oIn = new Date(officialIn); oIn.setSeconds(0, 0);
  const oOut = new Date(officialOut); oOut.setSeconds(0, 0);

  const start = Math.max(sIn.getTime(), oIn.getTime());
  const end = Math.min(sOut.getTime(), oOut.getTime());

  if (start >= end) return 0;

  return end - start;
}

function runTest(name: string, studentInStr: string, studentOutStr: string, officialInStr: string, officialOutStr: string, expectedHours: number) {
    const studentIn = new Date(studentInStr);
    const studentOut = new Date(studentOutStr);
    const officialIn = new Date(officialInStr);
    const officialOut = new Date(officialOutStr);

    const ms = calculateHoursWithinOfficialTime(studentIn, studentOut, officialIn, officialOut);
    const hours = ms / (1000 * 60 * 60);

    const pass = Math.abs(hours - expectedHours) < 0.01;
    console.log(`Test: ${name}`);
    console.log(`  Student: ${studentIn.toLocaleTimeString()} - ${studentOut.toLocaleTimeString()}`);
    console.log(`  Official: ${officialIn.toLocaleTimeString()} - ${officialOut.toLocaleTimeString()}`);
    console.log(`  Result: ${hours.toFixed(2)}h`);
    console.log(`  Expected: ${expectedHours.toFixed(2)}h`);
    console.log(`  Status: ${pass ? 'PASS' : 'FAIL'}`);
    console.log('-----------------------------------');
}

console.log('--- GOLDEN RULE TESTS (JS Mode) ---');

// User Example 1
runTest(
    "User Example (Morning)",
    "2026-01-20T08:35:00",
    "2026-01-20T12:15:00",
    "2026-01-20T09:00:00",
    "2026-01-20T12:00:00",
    3.0
);

// User Example 2 (Afternoon)
runTest(
    "User Example (Afternoon)",
    "2026-01-20T12:45:00",
    "2026-01-20T17:30:00",
    "2026-01-20T13:00:00",
    "2026-01-20T17:00:00",
    4.0
);

// Edge Case: No Overlap (Before)
runTest(
    "No Overlap (Before)",
    "2026-01-20T07:00:00",
    "2026-01-20T08:00:00",
    "2026-01-20T09:00:00",
    "2026-01-20T12:00:00",
    0.0
);

// Edge Case: No Overlap (After)
runTest(
    "No Overlap (After)",
    "2026-01-20T13:00:00",
    "2026-01-20T14:00:00",
    "2026-01-20T09:00:00",
    "2026-01-20T12:00:00",
    0.0
);

// Edge Case: Partial Overlap (Start)
runTest(
    "Partial Overlap (Start)",
    "2026-01-20T08:30:00",
    "2026-01-20T09:30:00",
    "2026-01-20T09:00:00",
    "2026-01-20T12:00:00",
    0.5
);

// Edge Case: Partial Overlap (End)
runTest(
    "Partial Overlap (End)",
    "2026-01-20T11:30:00",
    "2026-01-20T12:30:00",
    "2026-01-20T09:00:00",
    "2026-01-20T12:00:00",
    0.5
);

export {};
