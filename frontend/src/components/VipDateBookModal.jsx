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
import ExtraHoursStepper from "./ExtraHoursStepper";
import { minHm } from "../lib/availability";
import { EXTRA_HOUR_MIN } from "../lib/vipCatalog";
import { t } from "../lib/i18n";

const LENGTHS = [1, 2, 3];
const fmtDay = (d) => { try { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch { return d; } };
const ERR = { SLOT_TAKEN: "bk_slot_taken", TIME_UNAVAILABLE: "bk_time_unavail", TIME_PASSED: "bk_time_passed", DURATION_CHANGED: "bk_same_len", "Insufficient coins": "not_enough_coins" };

function PriceSummary({ lang, length, extra, rate, extraPrice, total }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs space-y-1" data-testid="vs-book-price">
      <div className="flex justify-between"><span className="text-slate-400">{t("bk_rate_for", lang).replace("{h}", length)}</span><span className="font-mono-num text-white">🪙 {rate}</span></div>
      {extra > 0 && <div className="flex justify-between"><span className="text-slate-400">{t("bk_extra_hours", lang)} · {extra} × {extraPrice}</span><span className="font-mono-num text-white">🪙 {extra * extraPrice}</span></div>}
      <div className="flex justify-between border-t border-white/10 pt-1"><span className="text-amber-200 font-semibold">{t("bk_total", lang)}</span><b className="font-mono-num text-amber-300" data-testid="vs-book-total">🪙 {total}</b></div>
    </div>
  );
}

export default function VipDateBookModal({ open, onOpenChange, target, rescheduleId, rescheduleHours, onDone }) {
  const { user, refreshUser, lang } = useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ days: [], tz: "UTC", buffer: 15 });
  const [day, setDay] = useState(null);
  const [startMin, setStartMin] = useState(null);
  const [length, setLength] = useState(1);
  const [extra, setExtra] = useState(0);
  const [activity, setActivity] = useState("");
  const [busy, setBusy] = useState(false);
  const isReschedule = !!rescheduleId;
  const dur = 60 * (length + extra);

  const load = useCallback(() => {
    if (!target?.id) return;
    setLoading(true);
    api.get(`/vip/schedule/${target.id}/slots`)
      .then((r) => { setData(r.data); setDay((r.data.days || [])[0]?.date || null); })
      .catch(() => setData({ days: [], tz: "UTC", buffer: 15 }))
      .finally(() => setLoading(false));
  }, [target]);

  useEffect(() => {
    if (!open) return;
    const h = rescheduleHours || 1;
    setStartMin(null); setLength(Math.min(3, h)); setExtra(Math.max(0, h - 3)); setActivity(""); load();
  }, [open, load, rescheduleHours]);

  const dayObj = (data.days || []).find((d) => d.date === day);
  const slot = startMin == null ? null : { start: minHm(startMin), end: minHm(startMin + dur) };
  const extraPrice = data.extra_hour_price || EXTRA_HOUR_MIN;
  const rate = data.rates?.[String(length)] || EXTRA_HOUR_MIN;
  const total = rate + extra * extraPrice;

  const submit = async () => {
    if (!slot) { toast.error(t("bk_pick_slot_err", lang)); return; }
    if (!isReschedule && ((user?.coins || 0) + (user?.withdrawable || 0)) < total) { toast.error(t("not_enough_coins", lang)); return; }
    setBusy(true);
    try {
      if (isReschedule) {
        await api.post(`/vip/schedule/bookings/${rescheduleId}/reschedule`, { date: day, start: slot.start, end: slot.end });
        toast.success(t("bk_resched_sent", lang));
      } else {
        await api.post(`/vip/schedule/${target.id}/book`, { date: day, start: slot.start, end: slot.end, length, activity, venue: activity, tz: dayObj?.tz });
        toast.success(t("bk_sent", lang));
      }
      await refreshUser(); onDone?.(); onOpenChange(false);
    } catch (e) {
      const d = e.response?.data?.detail || "";
      toast.error(ERR[d] ? t(ERR[d], lang) : d || "Error");
      if (d === "SLOT_TAKEN") load();
    } finally { setBusy(false); }
  };

  const chip = (on) => `px-3 py-2 rounded-xl border text-sm font-mono-num transition-colors ${on ? "bg-amber-500 border-amber-500 text-black font-semibold" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161320] border-white/10 text-white max-w-lg max-h-[88vh] overflow-y-auto" data-testid="vs-book-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif-luxe text-2xl flex items-center gap-2">
            <Calendar size={20} className="text-amber-300" /> {t(isReschedule ? "bk_reschedule_title" : "bk_title", lang)} · {target?.name}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : (data.days || []).length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm" data-testid="vs-book-no-availability">{t("bk_no_avail", lang)}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">{t("bk_choose_day", lang)}</Label>
              <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1" data-testid="vs-book-days">
                {data.days.map((d) => (
                  <button key={d.date} type="button" onClick={() => { setDay(d.date); setStartMin(null); }} data-testid={`vs-book-day-${d.date}`}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-mono-num transition-colors ${day === d.date ? "bg-rose-500 border-rose-500 text-white" : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"}`}>{fmtDay(d.date)}</button>
                ))}
              </div>
            </div>
            <div className={isReschedule ? "hidden" : "space-y-2"}>
              <Label className="text-xs text-slate-400">{t("bk_how_long", lang)}</Label>
              <div className="flex gap-2" data-testid="vs-book-durations">
                {LENGTHS.map((h) => (
                  <button key={h} type="button" onClick={() => { setLength(h); setStartMin(null); }} data-testid={`vs-book-dur-${h}h`} className={`flex-1 ${chip(length === h)}`}>
                    {h}h<span className="block text-[11px] opacity-80">🪙 {data.rates?.[String(h)] || EXTRA_HOUR_MIN}</span>
                  </button>
                ))}
              </div>
              <ExtraHoursStepper label={t("bk_extra_hours", lang)} each={t("bk_each", lang)} value={extra} onChange={(n) => { setExtra(n); setStartMin(null); }} price={extraPrice} testid="vs-book-extra-hours" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {t("bk_pick_start", lang)}</Label>
                <span className="text-[11px] text-slate-500">{t("bk_vip_local", lang).replace("{tz}", dayObj?.tz || data.tz)}</span>
              </div>
              <TimeChooser key={`${day}-${dur}`} day={day} wins={dayObj?.windows || []} taken={dayObj?.taken || []} slot={dur}
                value={startMin} onChange={setStartMin} testid="vs-book-time" note={t("bk_time_note", lang).replace("{h}", dur / 60)} />
            </div>
            {!isReschedule && (
              <>
                <div>
                  <Label className="text-xs text-slate-400">{t("bk_activity", lang)}</Label>
                  <Input data-testid="vs-book-activity" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder={t("bk_activity_ph", lang)} className="bg-white/5 border-white/10 mt-1" />
                </div>
                <PriceSummary lang={lang} length={length} extra={extra} rate={rate} extraPrice={extraPrice} total={total} />
              </>
            )}
            <div className="text-xs text-slate-400 glass rounded-lg p-3">{t(isReschedule ? "bk_resched_note" : "bk_escrow_note", lang)}</div>
            <Button data-testid="vs-book-submit" disabled={busy || !slot} onClick={submit} className="rose-btn text-white border-0 w-full h-11">
              {busy ? <Loader2 size={16} className="animate-spin" /> : isReschedule ? t("bk_propose", lang) : <>{t("bk_request", lang)} · 🪙 {total}</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
