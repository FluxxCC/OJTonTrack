// const fetch = require('node-fetch'); // Use global fetch in Node 18+

async function test() {
  const body = {
    title: "Test Event Node",
    event_date: "2026-02-02",
    am_in: null,
    am_out: null,
    pm_in: "13:00",
    pm_out: "17:00",
    overtime_in: null,
    overtime_out: null,
    type: "event",
    course_ids: null
  };

  try {
    const res = await fetch('http://localhost:3000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
