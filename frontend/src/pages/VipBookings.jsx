import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Calendar, Clock, Check, X, Crown, Loader2, CalendarClock, Inbox, Send, Ban, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import VipAvailabilityEditor from "../components/VipAvailabilityEditor";
import VipDateBookModal from "../components/VipDateBookModal";
import AddToCalendar from "../components/AddToCalendar";
import CancelPreviewDialog from "../components/CancelPreviewDialog";
import DirectionsButton from "../components/DirectionsButton";
import ExtendDateButton from "../components/ExtendDateButton";
import { t } from "../lib/i18n";
import { MapsLink } from "../components/AddressPicker";
import { placeLabel } from "../lib/vipCatalog";
import DateBookingList from "../components/DateBookingList";
import CancelledDates from "../components/CancelledDates";

const fmtDay = (d) => { try { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch { return d; } };

const STATUS_BADGE = {
  pending: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  confirmed: "bg-sky-500/15 border-sky-500/40 text-sky-300",
  declined: "bg-rose-500/15 border-rose-500/40 text-rose-300",
  cancelled: "bg-slate-500/15 border-slate-500/40 text-slate-300",
  completed: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
};

function Avatar({ card }) {
  const p = card?.photo;
  const src = p ? `${api.defaults.baseURL}/files/${p}?auth=${encodeURIComponent(localStorage.getItem("gd_token") || "")}` : null;
  return src ? (
    <img src={src} alt="" className="w-11 h-11 rounded-full object-cover gold-hairline" />
  ) : (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-500 to-violet-500 flex items-center justify-center text-sm font-semibold">
      {card?.name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

const bookingTimes = (b) => {
  const start = new Date(`${b.date}T${b.start}:00`);
  const [sh, sm] = b.start.split(":").map(Number), [eh, em] = b.end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm); if (mins <= 0) mins += 1440;
  return { start, end: new Date(start.getTime() + mins * 60000) };
};

function BookingPlace({ b, lang, who }) {
  const loc = b.location || {};
  if (!b.place && !loc.address) return null;
  return (
    <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-1.5" data-testid={`vs-booking-place-${b.id}`}>
      <MapPin size={12} className="text-rose-300" />
      {b.place && <span className="text-slate-200">{who === "outgoing" && b.place === "own" ? t("place_vip", lang) : placeLabel(b.place, lang)}</span>}
      {loc.address ? <><span>· {[loc.address, loc.postal_code, loc.city, loc.country].filter(Boolean).join(", ")}</span> <MapsLink loc={loc} testid={`vs-booking-maps-${b.id}`} /></>
        : b.address_hidden ? <span className="text-amber-300/80">· {t("addr_hidden", lang)}</span> : null}
    </div>
  );
}

function BookingCard({ b, who, onConfirm, onDecline, onCancel, onReschedule, onReload, busyId }) {
  const { lang } = useApp();
  const card = who === "incoming" ? b.requester : b.vip_card;
  const loading = busyId === b.id;
  const { start, end } = bookingTimes(b);
  const now = Date.now();
  const live = b.status === "confirmed" && now >= start.getTime() && now < end.getTime();
  return (
    <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4" data-testid={`vs-booking-${b.id}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar card={card} />
        <div className="min-w-0">
          <div className="font-semibold text-white truncate">{card?.name}{card?.age ? `, ${card.age}` : ""}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Calendar size={12} /> {fmtDay(b.date)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono-num">
            <Clock size={12} /> <span data-testid={`vs-booking-time-${b.id}`}>{t("bk_start", lang)} {b.start} → {t("bk_finish", lang)} {b.end}{end.getDate() !== start.getDate() ? " (+1)" : ""}</span> <span className="text-slate-600">·</span> {b.tz}
            {live && <span className="ms-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300" data-testid={`vs-live-${b.id}`}>{t("ext_in_progress", lang)}</span>}
          </div>
          <BookingPlace b={b} lang={lang} who={who} />
          {b.activity ? <div className="text-xs text-slate-300 mt-0.5 truncate">{b.activity}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {b.status === "confirmed" && <AddToCalendar id={b.id} title={`GiftsDates VIP: ${b.activity || card?.name || "Date"}`} place={[b.location?.address, b.location?.city].filter(Boolean).join(", ") || b.venue || b.activity} start={start} end={end} link="/vip-bookings" />}
        {b.status === "confirmed" && b.location?.address && <DirectionsButton loc={b.location} testid={`vs-directions-${b.id}`} />}
        {who === "outgoing" && live && <ExtendDateButton id={b.id} url={`/vip/schedule/bookings/${b.id}/extend`} price={b.extra_hour_price || 250} onDone={onReload} />}
        <div className="text-right me-1">
          <div className="text-amber-300 font-mono-num text-sm">🪙 {b.coins}</div>
          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[b.status]}`} data-testid={`vs-status-${b.id}`}>{t(`vb_st_${b.status}`, lang)}</span>
        </div>
        {who === "incoming" && b.status === "pending" && (
          <>
            <Button data-testid={`vs-confirm-${b.id}`} size="sm" disabled={loading} onClick={() => onConfirm(b.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 h-9">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} className="me-1" /> {t("vb_confirm", lang)}</>}
            </Button>
            <Button data-testid={`vs-decline-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onDecline(b.id)} className="bg-white/5 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 h-9">
              <X size={14} className="me-1" /> {t("vb_decline", lang)}
            </Button>
          </>
        )}
        {who === "incoming" && b.status === "confirmed" && (
          <Button data-testid={`vs-cancel-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onCancel(b, who)} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9">{t("vb_cancel", lang)}</Button>
        )}
        {who === "outgoing" && (b.status === "pending" || b.status === "confirmed") && (
          <>
            {b.status === "pending" && (
              <Button data-testid={`vs-reschedule-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onReschedule(b)} className="bg-white/5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-9">{t("vb_reschedule", lang)}</Button>
            )}
            <Button data-testid={`vs-cancel-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onCancel(b, who)} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9">{t("vb_cancel", lang)}</Button>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <Icon size={30} className="mx-auto mb-3 opacity-60" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default function VipBookings() {
  const { refreshUser, lang } = useApp();
  const nav = useNavigate();
  const [sched, setSched] = useState(null);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reschedule, setReschedule] = useState(null); // booking being rescheduled
  const [cancelFor, setCancelFor] = useState(null); // { b, who }

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get("/vip/schedule/me"),
        api.get("/vip/schedule/bookings/mine"),
      ]);
      setSched(a.data);
      setMine(b.data.requests || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id) => {
    setBusyId(id);
    try { await fn(); await load(); await refreshUser(); } finally { setBusyId(null); }
  };
  const confirm = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/confirm`); toast.success(t("vb_confirmed_toast", lang)); }, id);
  const decline = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/decline`); toast.success(t("vb_declined_toast", lang)); }, id);
  const cancel = (b, who) => setCancelFor({ b, who });
  const doCancel = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/cancel`); toast.success(t("vb_cancelled_toast", lang)); }, id);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  const isVip = sched?.is_vip;
  const pending = sched?.pending || [];
  const confirmed = sched?.confirmed || [];
  const CLOSED = ["declined", "cancelled"];
  const past = (sched?.past || []).filter((b) => !CLOSED.includes(b.status));
  const closedIn = (sched?.past || []).filter((b) => CLOSED.includes(b.status));
  const mineActive = mine.filter((m) => ["pending", "confirmed", "completed"].includes(m.status));
  const closedOut = mine.filter((m) => CLOSED.includes(m.status));
  const closedCount = closedIn.length + closedOut.length;
  const closedList = (
    <div className="space-y-3" data-testid="vs-cancelled-list">
      {closedCount === 0 ? <Empty icon={Ban} text={t("vb_none_cancelled", lang)} /> : (
        <>
          {closedIn.map((b) => <BookingCard key={b.id} b={b} who="incoming" busyId={busyId} />)}
          {closedOut.map((b) => <BookingCard key={b.id} b={b} who="outgoing" busyId={busyId} />)}
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-serif-luxe text-3xl gold-text flex items-center gap-2"><Crown size={26} className="text-amber-300" /> {t("vb_title", lang)}</h1>
        {pending.length > 0 && <Badge className="bg-rose-500 text-white border-0 rounded-full" data-testid="vs-pending-badge">🔔 {pending.length}</Badge>}
      </div>
      <p className="text-sm text-slate-400 mb-6">{t("vb_intro", lang)}</p>

      <section className="mb-8" data-testid="vip-escrow-dates">
        <h2 className="font-serif-luxe text-xl mb-3 flex items-center gap-2"><Crown size={18} className="text-amber-300" /> {t("vb_vip_dates", lang)}</h2>
        <DateBookingList mode="vip" />
      </section>

      {isVip && (
        <section className="mb-8" data-testid="vs-availability-section">
          <VipAvailabilityEditor blocks={sched?.blocks || []} onChanged={load} />
        </section>
      )}

      {isVip ? (
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto">
            <TabsTrigger value="requests" data-testid="vs-tab-requests" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              {t("vb_requests", lang)} {pending.length > 0 && <span className="ml-1.5 text-[10px] bg-rose-500 text-white rounded-full px-1.5">{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="confirmed" data-testid="vs-tab-confirmed" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">{t("vb_confirmed", lang)}</TabsTrigger>
            <TabsTrigger value="mine" data-testid="vs-tab-mine" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">{t("vb_mine", lang)}</TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="vs-tab-cancelled" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              {t("vb_cancel_refused", lang)} {closedCount > 0 && <span className="ml-1.5 text-[10px] bg-slate-500/60 text-white rounded-full px-1.5">{closedCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="vs-tab-past" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">{t("vb_past", lang)}</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-5 space-y-3">
            {pending.length === 0 ? <Empty icon={Inbox} text={t("vb_none_pending", lang)} /> :
              pending.map((b) => <BookingCard key={b.id} b={b} who="incoming" onConfirm={confirm} onDecline={decline} onCancel={cancel} busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="confirmed" className="mt-5 space-y-3">
            {confirmed.length === 0 ? <Empty icon={CalendarClock} text={t("vb_none_confirmed", lang)} /> :
              confirmed.map((b) => <BookingCard key={b.id} b={b} who="incoming" onConfirm={confirm} onDecline={decline} onCancel={cancel} busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="past" className="mt-5 space-y-3">
            {past.length === 0 ? <Empty icon={Calendar} text={t("vb_none_past", lang)} /> :
              past.map((b) => <BookingCard key={b.id} b={b} who="incoming" busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="mine" className="mt-5 space-y-3">
            {mineActive.length === 0 ? <Empty icon={Send} text={t("vb_none_mine", lang)} /> :
              mineActive.map((b) => <BookingCard key={b.id} b={b} who="outgoing" onCancel={cancel} onReschedule={setReschedule} onReload={load} busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="cancelled" className="mt-5">{closedList}</TabsContent>
        </Tabs>
      ) : (
        <div>
          <div className="glass rounded-2xl p-6 mb-5 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <Crown className="text-amber-300 shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold text-white">Availability Calendar is a VIP feature</div>
                <p className="text-sm text-slate-400 mt-1">Become a VIP to publish your availability and let members book exact time slots with you.</p>
                <Button onClick={() => nav("/wallet?premium=1")} className="rose-btn text-white border-0 mt-3">Get VIP</Button>
              </div>
            </div>
          </div>
          <h2 className="font-serif-luxe text-xl mb-3 flex items-center gap-2"><Send size={18} className="text-rose-300" /> My date requests</h2>
          <div className="space-y-3">
            {mineActive.length === 0 ? <Empty icon={Send} text={t("vb_none_mine", lang)} /> :
              mineActive.map((b) => <BookingCard key={b.id} b={b} who="outgoing" onCancel={cancel} onReschedule={setReschedule} onReload={load} busyId={busyId} />)}
          </div>
          <h2 className="font-serif-luxe text-xl mt-8 mb-3 flex items-center gap-2"><Ban size={18} className="text-slate-300" /> {t("vb_cancel_refused", lang)}</h2>
          {closedList}
        </div>
      )}

      <CancelPreviewDialog open={!!cancelFor} onOpenChange={(o) => !o && setCancelFor(null)} total={cancelFor?.b.coins || 0}
        byRequester={cancelFor?.who === "outgoing"} onConfirm={() => { const id = cancelFor.b.id; setCancelFor(null); doCancel(id); }} />
      {reschedule && (
        <VipDateBookModal
          open={!!reschedule}
          rescheduleHours={reschedule.hours}
          onOpenChange={(o) => { if (!o) setReschedule(null); }}
          target={{ id: reschedule.vip_id, name: reschedule.vip_card?.name || "VIP" }}
          rescheduleId={reschedule.id}
          onDone={() => { setReschedule(null); load(); }}
        />
      )}

      <div className="mt-8">
        <CancelledDates />
      </div>
    </div>
  );
}
