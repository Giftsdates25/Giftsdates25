import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import TimeChooser from "./TimeChooser";
import { minHm } from "../lib/availability";

const fmtDay = (d) => {
  try {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch { return d; }
};

const DURATIONS = [60, 120, 180];

export default function VipScheduleBookModal({ open, onOpenChange, target, defaultCoins, rescheduleId, onDone }) {
  const { user, meta, refreshUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ days: [], tz: "UTC", buffer: 15 });
  const [day, setDay] = useState(null);
  const [startMin, setStartMin] = useState(null);
  const [dur, setDur] = useState(60);
  const [activity, setActivity] = useState("");
  const [coins, setCoins] = useState(defaultCoins || meta?.date_min_coins || 300);
  const [busy, setBusy] = useState(false);
  const isReschedule = !!rescheduleId;

  const load = useCallback(() => {
    if (!target?.id) return;
    setLoading(true);
    api.get(`/vip/schedule/${target.id}/slots`)
      .then((r) => {
        setData(r.data);
        const first = (r.data.days || [])[0];
        setDay(first ? first.date : null);
      })
      .catch(() => setData({ days: [], tz: "UTC", buffer: 15 }))
      .finally(() => setLoading(false));
  }, [target]);

  useEffect(() => {
    if (open) { setStartMin(null); setDur(60); setActivity(""); setCoins(defaultCoins || meta?.date_min_coins || 300); load(); }
  }, [open, load, defaultCoins, meta]);

  const dayObj = (data.days || []).find((d) => d.date === day);
  const slot = startMin == null ? null : { start: minHm(startMin), end: minHm(startMin + dur) };

  const submit = async () => {
    if (!slot) { toast.error("Pick an available time slot"); return; }
    if (!isReschedule && ((user?.coins || 0) + (user?.withdrawable || 0)) < coins) { toast.error("Not enough coins"); return; }
    setBusy(true);
    try {
      if (isReschedule) {
        await api.post(`/vip/schedule/bookings/${rescheduleId}/reschedule`, { date: day, start: slot.start, end: slot.end });
        toast.success("New time proposed — waiting for VIP confirmation");
      } else {
        await api.post(`/vip/schedule/${target.id}/book`, {
          date: day, start: slot.start, end: slot.end, coins,
          activity, venue: activity, tz: dayObj?.tz,
        });
        toast.success("Request sent — waiting for VIP confirmation");
      }
      await refreshUser();
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      const d = e.response?.data?.detail || "";
      toast.error(
        d === "SLOT_TAKEN" ? "That time was just taken. Please pick another slot."
          : d === "TIME_UNAVAILABLE" ? "This time is not available."
          : d === "BAD_DURATION" ? "Choose a 1h, 2h or 3h date."
          : d === "CANNOT_BOOK_SELF" ? "You cannot book yourself."
          : d === "NOT_PENDING" ? "This booking can no longer be rescheduled."
          : d === "Insufficient coins" ? "Not enough coins."
          : d || "Could not book");
      if (d === "SLOT_TAKEN") load();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161320] border-white/10 text-white max-w-lg max-h-[88vh] overflow-y-auto" data-testid="vs-book-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif-luxe text-2xl flex items-center gap-2">
            <Calendar size={20} className="text-amber-300" /> {isReschedule ? "Propose a new time" : "Book a date"} · {target?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : (data.days || []).length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm" data-testid="vs-book-no-availability">
            This VIP has not published any availability yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Choose a day</Label>
              <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1" data-testid="vs-book-days">
                {data.days.map((d) => (
                  <button key={d.date} type="button" onClick={() => { setDay(d.date); setStartMin(null); }}
                    data-testid={`vs-book-day-${d.date}`}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-mono-num transition-colors ${day === d.date ? "bg-rose-500 border-rose-500 text-white" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"}`}>
                    {fmtDay(d.date)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-400">How long?</Label>
              <div className="mt-1.5 flex gap-2" data-testid="vs-book-durations">
                {(data.durations || DURATIONS).map((m) => (
                  <button key={m} type="button" onClick={() => setDur(m)} data-testid={`vs-book-dur-${m / 60}h`}
                    className={`flex-1 px-3 py-2 rounded-xl border text-sm font-mono-num transition-colors ${dur === m ? "bg-amber-500 border-amber-500 text-black font-semibold" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"}`}>
                    {m / 60}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> Pick a start time</Label>
                <span className="text-[11px] text-slate-500">VIP local time ({dayObj?.tz || data.tz})</span>
              </div>
              <TimeChooser key={`${day}-${dur}`} day={day} wins={dayObj?.windows || []} taken={dayObj?.taken || []} slot={dur}
                value={startMin} onChange={setStartMin} testid="vs-book-time"
                note={`Tap an hour, then the minutes. Only start times where the full ${dur / 60}h date fits are shown. Each date locks ${data.buffer} min before and after.`} />
            </div>

            <div className={isReschedule ? "hidden" : ""}>
              <Label className="text-xs text-slate-400">Date / activity</Label>
              <Input data-testid="vs-book-activity" value={activity} onChange={(e) => setActivity(e.target.value)}
                placeholder="Dinner at Le Bernardin" className="bg-white/5 border-white/10 mt-1" />
            </div>

            <div className={isReschedule ? "hidden" : ""}>
              <Label className="text-xs text-slate-400">Coins (held in escrow, min {meta?.date_min_coins || 300})</Label>
              <Input data-testid="vs-book-coins" type="number" min={meta?.date_min_coins || 300} step="50" value={coins}
                onChange={(e) => setCoins(parseInt(e.target.value || 0))} className="bg-white/5 border-white/10 mt-1" />
            </div>

            <div className="text-xs text-slate-400 glass rounded-lg p-3">
              {isReschedule
                ? "🔁 Your coins stay in escrow. The VIP will be asked to confirm the new time you propose."
                : "🔒 Your coins are held in escrow. The VIP has 15-minute buffers before and after each booking. You'll be notified when the VIP confirms or declines."}
            </div>

            <Button data-testid="vs-book-submit" disabled={busy || !slot} onClick={submit} className="rose-btn text-white border-0 w-full h-11">
              {busy ? <Loader2 size={16} className="animate-spin" /> : (isReschedule ? <>Propose new time</> : <>Request date · 🪙 {coins}</>)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
