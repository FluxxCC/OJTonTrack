
import React from "react";

interface AttendanceEntry {
  type: "in" | "out";
  timestamp: number;
  photoDataUrl?: string;
  photourl?: string;
  photoUrl?: string;
  status?: string;
  validatedBy?: string | null;
  validated_by?: string | null;
  validatedAt?: number;
}

interface AttendanceDetailsModalProps {
  entry: AttendanceEntry;
  onClose: () => void;
  userName?: string;
}

export function AttendanceDetailsModal({ entry, onClose, userName }: AttendanceDetailsModalProps) {
  const photoSrc = entry.photoDataUrl || entry.photourl || entry.photoUrl;
  const isAutoTimeOut = entry.validated_by === 'SYSTEM_AUTO_CLOSE' || entry.validated_by === 'AUTO TIME OUT';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md md:max-w-lg max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Attendance Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4">
          {/* Photo */}
          <div className="aspect-[4/3] md:aspect-video w-full bg-gray-100 rounded-xl overflow-hidden mb-4 md:mb-6 border border-gray-200 shadow-inner flex items-center justify-center relative group">
            {photoSrc ? (
              <img 
                src={photoSrc} 
                className="w-full h-full object-contain" 
                alt="Attendance Log" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span className="text-sm mt-2">No photo available</span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type</label>
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {entry.type.toUpperCase()}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
              {(entry.validated_by === 'SYSTEM_AUTO_CLOSE' || entry.validated_by === 'AUTO TIME OUT') ? (
                <span className="text-xs font-bold text-red-500">AUTO TIME OUT</span>
              ) : (
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  entry.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                  entry.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {entry.status || "Pending"}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Date</label>
              <div className="font-semibold text-gray-900">
                {new Date(entry.timestamp).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Time</label>
              <div className="font-semibold text-gray-900 text-xl font-mono">
                {isAutoTimeOut ? (
                  <span className="text-gray-400">--:--</span>
                ) : (
                  (() => {
                    const d = new Date(entry.timestamp);
                    const h = d.getHours();
                    const m = d.getMinutes();
                    const hh = h.toString().padStart(2, '0');
                    const mm = m.toString().padStart(2, '0');
                    return `${hh}:${mm}`;
                  })()
                )}
              </div>
            </div>

            {(entry.validated_by === 'SYSTEM_AUTO_CLOSE' || entry.validated_by === 'AUTO TIME OUT') ? null : (
            <div
              className={`col-span-2 p-3 rounded-xl border flex items-center justify-between ${
                entry.status === 'Approved'
                  ? 'bg-green-50 border-green-100'
                  : entry.status === 'Rejected'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-yellow-50 border-yellow-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    entry.status === 'Approved'
                      ? 'bg-green-600'
                      : entry.status === 'Rejected'
                      ? 'bg-red-600'
                      : 'bg-yellow-600'
                  }`}
                ></span>
                <span
                  className={`text-[11px] font-bold ${
                    entry.status === 'Approved'
                      ? 'text-green-700'
                      : entry.status === 'Rejected'
                      ? 'text-red-700'
                      : 'text-yellow-700'
                  }`}
                >
                  {entry.status === 'Approved'
                    ? 'Approved by Supervisor'
                    : entry.status === 'Rejected'
                    ? 'Rejected by Supervisor'
                    : 'Pending approval'}
                </span>
              </div>
            </div>
            )}

            {userName && (
               <div className="col-span-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Student</label>
                <div className="font-semibold text-gray-900">{userName}</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
             <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
}
