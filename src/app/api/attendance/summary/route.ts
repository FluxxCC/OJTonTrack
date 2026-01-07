import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  // Fetch all attendance sorted by timestamp
  const { data, error } = await admin
    .from("attendance")
    .select("idnumber, type, ts, status, approvedby, approvedat")
    .order("ts", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, number> = {};
  const activeSessions: Record<string, number> = {};
  const recentAttendance: { idnumber: string; type: string; ts: number }[] = [];

  // Group by idnumber
  const grouped: Record<string, { type: string; ts: number; status: string; approvedby?: string | null; approvedat?: number | null }[]> = {};
  (data || []).forEach((row: { idnumber: string; type: string; ts: number | string; status: string; approvedby?: string | null; approvedat?: string | null }) => {
    if (!grouped[row.idnumber]) grouped[row.idnumber] = [];
    grouped[row.idnumber].push({ 
      type: row.type, 
      ts: Number(row.ts),
      status: row.status,
      approvedby: row.approvedby,
      approvedat: row.approvedat ? Number(new Date(row.approvedat).getTime()) : null
    });
    // Collect recent attendance (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (Number(row.ts) >= sevenDaysAgo) {
      recentAttendance.push({ idnumber: row.idnumber, type: row.type, ts: Number(row.ts) });
    }
  });

  // Calculate hours
  Object.keys(grouped).forEach(id => {
    const events = grouped[id];
    let totalMs = 0;
    
    // Filter only approved events or legacy approved (if logic existed)
    // We strictly follow: status === 'Approved' OR approvedby IS NOT NULL
    const approvedEvents = events.filter(e => 
      (e.status && String(e.status).toLowerCase() === 'approved') || e.approvedby
    );

    // We need to pair them based on the filtered list?
    // Or do we pair them from the full list but only count if both are approved?
    // "when the supervisor approves the time in the total hours will start counting"
    // "when the supervisor approves the time out it will stop counting"
    // This implies we pair APPROVED events.
    
    // Logic: Iterate approved events.
    // If we find an 'in', look for next 'out'.
    // If found 'out', add duration.
    // If NO 'out' found, and it's the last event, it is ACTIVE.
    
    for (let i = 0; i < approvedEvents.length; i++) {
      if (approvedEvents[i].type === 'in') {
        let outIndex = -1;
        for (let j = i + 1; j < approvedEvents.length; j++) {
          if (approvedEvents[j].type === 'out') {
            outIndex = j;
            break;
          }
        }

        if (outIndex !== -1) {
          const inTs = approvedEvents[i].approvedat ?? approvedEvents[i].ts;
          const outTs = approvedEvents[outIndex].approvedat ?? approvedEvents[outIndex].ts;
          totalMs += (outTs - inTs);
          i = outIndex; // skip to out
        } else {
           // No approved out found. This is an active session.
           // We only consider it active if there is NO subsequent approved IN (which shouldn't happen normally)
           // But technically, if we have In (Approved), In (Approved)... that's an error in data, but let's assume valid pairs.
           activeSessions[id] = approvedEvents[i].approvedat ?? approvedEvents[i].ts;
        }
      }
    }
    summary[id] = totalMs;
  });

  // Recent reports (last 7 days, exclude drafts)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data: reportsData } = await admin
    .from("reports")
    .select("id, idnumber, title, text, ts, status")
    .gte("ts", sevenDaysAgo)
    .neq("status", "draft")
    .order("ts", { ascending: false })
    .limit(20);

  const recentReports = (reportsData || []).map((r: { id: number; idnumber: string; title?: string | null; text?: string | null; ts?: number | string | null; status?: string | null }) => ({
    id: r.id,
    idnumber: r.idnumber,
    title: r.title || "(Untitled)",
    body: r.text || "",
    ts: Number(r.ts || 0),
    status: r.status || "submitted"
  }));

  // Sort recent attendance by latest first and limit
  recentAttendance.sort((a, b) => b.ts - a.ts);

  return NextResponse.json({ summary, activeSessions, recentAttendance: recentAttendance.slice(0, 20), recentReports });
}
