import React, { useEffect, useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Calendar } from "./ui/calendar";
import { Clock, Plus, Trash2, CalendarClock, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Switch } from "./ui/switch";

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const hmMin = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const minHm = (x) => { const v = ((x % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const fmtDay = (d) => { try { return fromKey(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch { return d; } };
// End minute of a window, extended past midnight into the next day when end <= start.
const winEnd = (start, end) => { const s = hmMin(start); let e = hmMin(end); if (e <= s) e += 1440; return e; };
const crossesMidnight = (start, end) => hmMin(end) <= hmMin(start);

const SLOT_LENGTHS = [30, 45, 60, 90, 120];
const WEEKDAYS = [["Mon", 0], ["Tue", 1], ["Wed", 2], ["Thu", 3], ["Fri", 4], ["Sat", 5], ["Sun", 6]];

function previewSlots(start, end, len) {
  const s = hmMin(start), e = winEnd(start, end), L = Math.max(15, len);
  const out = [];
  for (let x = s; x + L <= e; x += L) out.push({ label: `${minHm(x)}–${minHm(x + L)}`, nextDay: x + L > 1440 });
  return out;
}

export default function VipScheduleManager({ blocks = [], onChanged }) {
  const [day, setDay] = useState(toKey(new Date()));
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("22:00");
  const [slotLen, setSlotLen] = useState(60);
  const [saving, setSaving] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState([]);
  const [weeks, setWeeks] = useState(8);

  const toggleWeekday = (n) => setWeekdays((w) => w.includes(n) ? w.filter((x) => x !== n) : [...w, n]);

  const add = async () => {
    if (hmMin(start) === hmMin(end)) { toast.error("End time can't equal start time"); return; }
    if (winEnd(start, end) - hmMin(start) < slotLen) { toast.error("Window is shorter than one slot"); return; }
    setSaving(true);
    try {
      if (repeat) {
        if (weekdays.length === 0) { toast.error("Pick at least one weekday to repeat"); setSaving(false); return; }
        const r = await api.post("/vip/schedule/availability/recurring", { weekdays, start, end, slot_len: slotLen, weeks });
        toast.success(`Added ${r.data.created} weekly slot day(s)`);
      } else {
        await api.post("/vip/schedule/availability", { date: day, start, end, slot_len: slotLen });
        toast.success("Availability added");
      }
      onChanged?.();
    } catch (e) {
      const d = e.response?.data?.detail || "";
      toast.error(d === "VIP_REQUIRED" ? "VIP membership required" : d === "DATE_PAST" ? "Pick a future date" : d === "NO_WEEKDAYS" ? "Pick at least one weekday" : d || "Could not add");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/vip/schedule/availability/${id}`);
      toast.success("Removed");
      onChanged?.();
    } catch (e) {
      const d = e.response?.data?.detail || "";
      toast.error(d === "HAS_BOOKINGS" ? "This day has active bookings — cancel them first" : d || "Could not remove");
    }
  };

  const preview = previewSlots(start, end, slotLen);
  const byDate = {};
  blocks.forEach((b) => { (byDate[b.date] = byDate[b.date] || []).push(b); });
  const dates = Object.keys(byDate).sort();
  const selectedDays = blocks.map((b) => fromKey(b.date));

  return (
    <div className="glass rounded-2xl p-6" data-testid="vip-schedule-manager">
      <h2 className="font-serif-luxe text-2xl flex items-center gap-2"><CalendarClock size={20} className="text-amber-300" /> Availability Calendar</h2>
      <p className="text-xs text-slate-400 mt-1 mb-4">Pick the days and time windows you're open for dates. Choose how long each bookable slot is. A 15-minute buffer is added automatically before and after every booking.</p>

      <div className="flex flex-wrap gap-6 items-start">
        <div className="rounded-xl border border-white/10 bg-white/5" data-testid="vip-schedule-calendar">
          <Calendar mode="single" selected={fromKey(day)} onSelect={(d) => d && setDay(toKey(d))} disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            modifiers={{ has: selectedDays }}
            modifiersClassNames={{ has: "ring-1 ring-emerald-400/60 rounded-md" }}
            classNames={{ day_selected: "bg-rose-500 text-white hover:bg-rose-500 focus:bg-rose-500" }} />
        </div>

        <div className="flex-1 min-w-[260px] space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white mb-2">{fmtDay(day)}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <Label className="text-[11px] text-slate-400 flex items-center gap-1"><Clock size={11} /> From</Label>
                <Input data-testid="vs-avail-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="bg-white/5 border-white/10 h-9 w-28 mt-1" />
              </div>
              <span className="text-slate-500 self-end pb-2">—</span>
              <div>
                <Label className="text-[11px] text-slate-400">To</Label>
                <Input data-testid="vs-avail-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-white/5 border-white/10 h-9 w-28 mt-1" />
              </div>
              {crossesMidnight(start, end) && (
                <span data-testid="vs-avail-overnight" className="self-end pb-2 text-[11px] text-sky-300/90">🌙 next day (+1)</span>
              )}
            </div>
            <div className="mt-3">
              <Label className="text-[11px] text-slate-400">Slot length</Label>
              <div className="flex flex-wrap gap-1.5 mt-1" data-testid="vs-avail-slotlen">
                {SLOT_LENGTHS.map((L) => (
                  <button key={L} type="button" onClick={() => setSlotLen(L)}
                    data-testid={`vs-avail-slotlen-${L}`}
                    className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${slotLen === L ? "bg-amber-500/20 border-amber-500/50 text-amber-200" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}>
                    {L}m
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-slate-300 flex items-center gap-1.5"><Repeat size={12} /> Repeat weekly</Label>
                <Switch data-testid="vs-avail-repeat" checked={repeat} onCheckedChange={setRepeat} />
              </div>
              {repeat && (
                <div className="mt-2.5" data-testid="vs-avail-recurring">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map(([lbl, n]) => (
                      <button key={n} type="button" onClick={() => toggleWeekday(n)}
                        data-testid={`vs-avail-wd-${n}`}
                        className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${weekdays.includes(n) ? "bg-rose-500 border-rose-500 text-white" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Label className="text-[11px] text-slate-400">for the next</Label>
                    <Input data-testid="vs-avail-weeks" type="number" min={1} max={26} value={weeks}
                      onChange={(e) => setWeeks(Math.max(1, Math.min(26, parseInt(e.target.value || 1))))} className="bg-white/5 border-white/10 h-8 w-16" />
                    <span className="text-[11px] text-slate-400">weeks</span>
                  </div>
                </div>
              )}
            </div>
            {preview.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-slate-400 mb-1.5">Bookable slots ({preview.length})</p>
                {crossesMidnight(start, end) && (
                  <p className="text-[11px] text-sky-300/90 mb-1.5">🌙 This window runs past midnight — times marked +1 are on the next day.</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {preview.slice(0, 14).map((s) => (
                    <span key={s.label} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-mono-num">{s.label}{s.nextDay ? <span className="ml-0.5 text-sky-300/90">+1</span> : ""}</span>
                  ))}
                </div>
              </div>
            )}
            <Button data-testid="vs-avail-add" onClick={add} disabled={saving} className="rose-btn text-white border-0 w-full mt-4 h-10">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} className="me-1" /> {repeat ? "Add weekly availability" : "Add availability"}</>}
            </Button>
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-2">Published availability · <b className="text-white" data-testid="vs-avail-count">{blocks.length}</b></div>
            {dates.length === 0 ? (
              <div className="text-xs text-slate-500">No availability yet — add your first window above.</div>
            ) : (
              <div className="space-y-2" data-testid="vs-avail-list">
                {dates.map((d) => (
                  <div key={d} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-white mb-1.5">{fmtDay(d)}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {byDate[d].sort((a, b) => a.start.localeCompare(b.start)).map((b) => (
                        <span key={b.id} data-testid={`vs-avail-block-${b.id}`} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-mono-num">
                          {b.recurring ? <Repeat size={10} className="text-emerald-300" /> : null}
                          {b.start}–{b.end}{crossesMidnight(b.start, b.end) ? <span className="text-sky-300/90"> 🌙</span> : ""} · {b.slot_len}m
                          <button onClick={() => remove(b.id)} data-testid={`vs-avail-del-${b.id}`} className="text-rose-300 hover:text-rose-200"><Trash2 size={12} /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
