import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Calendar, Clock, Check, X, Crown, Loader2, CalendarClock, Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import VipScheduleManager from "../components/VipScheduleManager";
import VipScheduleBookModal from "../components/VipScheduleBookModal";
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

function BookingCard({ b, who, onConfirm, onDecline, onCancel, onReschedule, busyId }) {
  const card = who === "incoming" ? b.requester : b.vip_card;
  const loading = busyId === b.id;
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
            <Clock size={12} /> {b.start}–{b.end} <span className="text-slate-600">·</span> {b.tz}
          </div>
          {b.activity ? <div className="text-xs text-slate-300 mt-0.5 truncate">{b.activity}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right me-1">
          <div className="text-amber-300 font-mono-num text-sm">🪙 {b.coins}</div>
          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_BADGE[b.status]}`}>{b.status}</span>
        </div>
        {who === "incoming" && b.status === "pending" && (
          <>
            <Button data-testid={`vs-confirm-${b.id}`} size="sm" disabled={loading} onClick={() => onConfirm(b.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 h-9">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} className="me-1" /> Confirm</>}
            </Button>
            <Button data-testid={`vs-decline-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onDecline(b.id)} className="bg-white/5 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 h-9">
              <X size={14} className="me-1" /> Decline
            </Button>
          </>
        )}
        {who === "incoming" && b.status === "confirmed" && (
          <Button data-testid={`vs-cancel-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onCancel(b.id)} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9">Cancel</Button>
        )}
        {who === "outgoing" && (b.status === "pending" || b.status === "confirmed") && (
          <>
            {b.status === "pending" && (
              <Button data-testid={`vs-reschedule-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onReschedule(b)} className="bg-white/5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-9">Reschedule</Button>
            )}
            <Button data-testid={`vs-cancel-${b.id}`} size="sm" variant="outline" disabled={loading} onClick={() => onCancel(b.id)} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9">Cancel</Button>
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
  const { user, refreshUser } = useApp();
  const nav = useNavigate();
  const [sched, setSched] = useState(null);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reschedule, setReschedule] = useState(null); // booking being rescheduled

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
  const confirm = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/confirm`); toast.success("Date confirmed"); }, id);
  const decline = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/decline`); toast.success("Date declined — coins refunded"); }, id);
  const cancel = (id) => act(async () => { await api.post(`/vip/schedule/bookings/${id}/cancel`); toast.success("Booking cancelled"); }, id);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  const isVip = sched?.is_vip;
  const pending = sched?.pending || [];
  const confirmed = sched?.confirmed || [];
  const past = sched?.past || [];
  const minePending = mine.filter((m) => m.status === "pending");
  const mineConfirmed = mine.filter((m) => m.status === "confirmed");
  const minePast = mine.filter((m) => ["completed", "declined", "cancelled"].includes(m.status));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-serif-luxe text-3xl gold-text flex items-center gap-2"><Crown size={26} className="text-amber-300" /> VIP Bookings</h1>
        {pending.length > 0 && <Badge className="bg-rose-500 text-white border-0 rounded-full" data-testid="vs-pending-badge">🔔 {pending.length}</Badge>}
      </div>
      <p className="text-sm text-slate-400 mb-6">Control your availability and manage every date request in one place.</p>

      <section className="mb-8" data-testid="vip-escrow-dates">
        <h2 className="font-serif-luxe text-xl mb-3 flex items-center gap-2"><Crown size={18} className="text-amber-300" /> VIP Dates</h2>
        <DateBookingList mode="vip" />
      </section>

      {isVip ? (
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="requests" data-testid="vs-tab-requests" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Requests {pending.length > 0 && <span className="ml-1.5 text-[10px] bg-rose-500 text-white rounded-full px-1.5">{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="confirmed" data-testid="vs-tab-confirmed" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">Confirmed</TabsTrigger>
            <TabsTrigger value="past" data-testid="vs-tab-past" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">Past</TabsTrigger>
            <TabsTrigger value="availability" data-testid="vs-tab-availability" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">Availability</TabsTrigger>
            <TabsTrigger value="mine" data-testid="vs-tab-mine" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">My Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-5 space-y-3">
            {pending.length === 0 ? <Empty icon={Inbox} text="No pending date requests." /> :
              pending.map((b) => <BookingCard key={b.id} b={b} who="incoming" onConfirm={confirm} onDecline={decline} onCancel={cancel} busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="confirmed" className="mt-5 space-y-3">
            {confirmed.length === 0 ? <Empty icon={CalendarClock} text="No confirmed dates yet." /> :
              confirmed.map((b) => <BookingCard key={b.id} b={b} who="incoming" onConfirm={confirm} onDecline={decline} onCancel={cancel} busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="past" className="mt-5 space-y-3">
            {past.length === 0 ? <Empty icon={Calendar} text="No past bookings." /> :
              past.map((b) => <BookingCard key={b.id} b={b} who="incoming" busyId={busyId} />)}
          </TabsContent>
          <TabsContent value="availability" className="mt-5">
            <VipScheduleManager blocks={sched?.blocks || []} onChanged={load} />
          </TabsContent>
          <TabsContent value="mine" className="mt-5 space-y-3">
            {mine.length === 0 ? <Empty icon={Send} text="You haven't requested any VIP dates yet." /> : (
              <>
                {minePending.map((b) => <BookingCard key={b.id} b={b} who="outgoing" onCancel={cancel} onReschedule={setReschedule} busyId={busyId} />)}
                {mineConfirmed.map((b) => <BookingCard key={b.id} b={b} who="outgoing" onCancel={cancel} onReschedule={setReschedule} busyId={busyId} />)}
                {minePast.map((b) => <BookingCard key={b.id} b={b} who="outgoing" busyId={busyId} />)}
              </>
            )}
          </TabsContent>
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
            {mine.length === 0 ? <Empty icon={Send} text="You haven't requested any VIP dates yet." /> :
              mine.map((b) => <BookingCard key={b.id} b={b} who="outgoing" onCancel={cancel} onReschedule={setReschedule} busyId={busyId} />)}
          </div>
        </div>
      )}

      {reschedule && (
        <VipScheduleBookModal
          open={!!reschedule}
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
