"use client";
import Link from "next/link";
import { useRef } from "react";

export default function Carousel() {
  const ref = useRef<HTMLDivElement>(null);
  const goTo = (index: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  };
  return (
    <>
      <div className="relative w-full flex justify-center md:hidden">
        <div ref={ref} className="slider scroll-smooth w-full max-w-[700px]">
          <section id="slide-1" className="slide mx-auto rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-secondary/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M7 3a2 2 0 0 0-2 2v2H3v2h2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9h2V7h-2V5a2 2 0 0 0-2-2H7Zm0 4V5h10v2H7Zm2 4h2v2H9v-2Zm0 4h2v2H9v-2Zm4-4h2v2h-2v-2Zm0 4h2v2h-2v-2Z"/></svg>
              </div>
              <div className="text-left">
                <div className="text-[#1F2937] font-bold">Track Attendance</div>
                <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Log daily OJT presence with ease.</div>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Auto log</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Weekly view</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Time-in/out</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Export CSV</li>
            </ul>
          </section>
          <section id="slide-2" className="slide mx-auto rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-accent/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M3 3h18v2H3V3Zm2 5h4v11H5V8Zm6 3h4v8h-4v-8Zm6-5h4v13h-4V6Z"/></svg>
              </div>
              <div className="text-left">
                <div className="text-[#1F2937] font-bold">Monitor Progress</div>
                <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Visualize tasks and milestones.</div>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Goals & tasks</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Weekly reports</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Charts</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Insights</li>
            </ul>
          </section>
          <section id="slide-3" className="slide mx-auto rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M4 4h16v12H5.17L4 17.17V4Zm2 4v2h12V8H6Zm0 4v2h8v-2H6Z"/></svg>
              </div>
              <div className="text-left">
                <div className="text-[#1F2937] font-bold">Supervisor Feedback</div>
                <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Capture comments and approvals.</div>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Supervisor notes</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Approvals</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Ratings</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Export PDF</li>
            </ul>
          </section>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2 md:hidden">
        <button onClick={() => goTo(0)} className="h-2.5 w-2.5 rounded-full bg-primary/40 hover:bg-primary" />
        <button onClick={() => goTo(1)} className="h-2.5 w-2.5 rounded-full bg-primary/40 hover:bg-primary" />
        <button onClick={() => goTo(2)} className="h-2.5 w-2.5 rounded-full bg-primary/40 hover:bg-primary" />
      </div>
      <div className="hidden md:grid grid-cols-3 gap-5 w-full max-w-[1000px] mx-auto">
        <section className="rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-secondary/40 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M7 3a2 2 0 0 0-2 2v2H3v2h2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9h2V7h-2V5a2 2 0 0 0-2-2H7Zm0 4V5h10v2H7Zm2 4h2v2H9v-2Zm0 4h2v2H9v-2Zm4-4h2v2h-2v-2Zm0 4h2v2h-2v-2Z"/></svg>
            </div>
            <div className="text-left">
              <div className="text-[#1F2937] font-bold">Track Attendance</div>
              <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Log daily OJT presence with ease.</div>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Auto log</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Weekly view</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Time-in/out</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Export CSV</li>
          </ul>
        </section>
        <section className="rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-accent/40 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M3 3h18v2H3V3Zm2 5h4v11H5V8Zm6 3h4v8h-4v-8Zm6-5h4v13h-4V6Z"/></svg>
            </div>
            <div className="text-left">
              <div className="text-[#1F2937] font-bold">Monitor Progress</div>
              <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Visualize tasks and milestones.</div>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Goals & tasks</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Weekly reports</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Charts</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Insights</li>
          </ul>
        </section>
        <section className="rounded-xl bg-white shadow-lg border border-secondary/30 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/30 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316" className="h-6 w-6"><path d="M4 4h16v12H5.17L4 17.17V4Zm2 4v2h12V8H6Zm0 4v2h8v-2H6Z"/></svg>
            </div>
            <div className="text-left">
              <div className="text-[#1F2937] font-bold">Supervisor Feedback</div>
              <div className="text-[#4a4a4a] text-[0.95rem]" style={{opacity:.9}}>Capture comments and approvals.</div>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-left">
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Supervisor notes</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Approvals</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Ratings</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Export PDF</li>
          </ul>
        </section>
      </div>
    </>
  );
}
