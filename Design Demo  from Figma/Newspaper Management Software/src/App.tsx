import { useState, useRef } from "react"
import {
  Users,
  ReceiptText,
  CalendarDays,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  Trash2,
  FileText,
  CircleCheck,
  Clock,
  GripVertical,
  Bike,
  Settings,
  TableProperties,
  Save,
  XCircle,
  AlertTriangle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

// How often is the paper delivered?
type Schedule =
  | "daily"       // every day
  | "weekdays"    // Mon–Fri
  | "weekends"    // Sat & Sun
  | "sundays"     // Sundays only
  | "specific"    // specific days of week (scheduleDays: number[])
  | "monthly"     // once a month (scheduleDayOfMonth: 1–31)
  | "annual"      // once a year (scheduleMonth + scheduleDayOfMonth)

interface PriceException {
  id: string
  label: string           // e.g. "Sunday Edition", "New Year Special"
  type: "day_of_week" | "specific_date"
  dayOfWeek?: number      // 0=Sun … 6=Sat (used when type === "day_of_week")
  specificDate?: string   // "YYYY-MM-DD" (used when type === "specific_date")
  price: number
}

interface MonthlyPrice {
  yearMonth: string  // "2026-07"
  price: number      // price per delivery on that month (overrides basePrice)
}

interface Paper {
  id: string
  name: string
  basePrice: number          // price per delivery / issue (default)
  schedule: Schedule
  scheduleDays: number[]     // day-of-week list for "specific" schedule
  scheduleDayOfMonth: number // day of month for "monthly" / "annual"
  scheduleMonth: number      // month (1–12) for "annual"
  priceExceptions: PriceException[]
  monthlyPrices: MonthlyPrice[]
}

interface DeliveryBoy {
  id: string
  name: string
  phone: string
  area: string
}

interface Resident {
  id: string
  routeOrder: number
  name: string
  unit: string
  address: string
  phone: string
  paperIds: string[]
  deliveryBoyId?: string
}

interface Bill {
  id: string
  residentId: string
  month: number
  year: number
  lineItems: { paperId: string; name: string; qty: number; unitDesc: string; amount: number }[]
  total: number
  paid: boolean
  paidDate?: string
  generatedOn: string
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedPapers: Paper[] = [
  {
    id: "p1", name: "The Daily Tribune", basePrice: 35, schedule: "daily",
    scheduleDays: [], scheduleDayOfMonth: 1, scheduleMonth: 1,
    priceExceptions: [{ id: "pe1", label: "Sunday Edition", type: "day_of_week", dayOfWeek: 0, price: 55 }],
    monthlyPrices: [{ yearMonth: "2026-08", price: 37 }],
  },
  {
    id: "p2", name: "Sunday Herald", basePrice: 50, schedule: "sundays",
    scheduleDays: [], scheduleDayOfMonth: 1, scheduleMonth: 1,
    priceExceptions: [], monthlyPrices: [],
  },
  {
    id: "p3", name: "Business Morning", basePrice: 42, schedule: "weekdays",
    scheduleDays: [], scheduleDayOfMonth: 1, scheduleMonth: 1,
    priceExceptions: [],
    monthlyPrices: [{ yearMonth: "2026-07", price: 45 }, { yearMonth: "2026-08", price: 48 }],
  },
  {
    id: "p4", name: "City Weekly Digest", basePrice: 80, schedule: "specific",
    scheduleDays: [3], scheduleDayOfMonth: 1, scheduleMonth: 1, // Wednesdays
    priceExceptions: [], monthlyPrices: [],
  },
  {
    id: "p5", name: "National Times", basePrice: 30, schedule: "daily",
    scheduleDays: [], scheduleDayOfMonth: 1, scheduleMonth: 1,
    priceExceptions: [{ id: "pe2", label: "Weekend Edition", type: "day_of_week", dayOfWeek: 6, price: 40 }],
    monthlyPrices: [],
  },
]

const seedDeliveryBoys: DeliveryBoy[] = [
  { id: "db1", name: "Arjun Mehta", phone: "9876-54321", area: "Oak Lane / Elm St" },
  { id: "db2", name: "Ravi Kumar", phone: "9876-54322", area: "Maple Ave" },
  { id: "db3", name: "Suresh Das", phone: "9876-54323", area: "All Areas" },
]

const seedResidents: Resident[] = [
  { id: "r1", routeOrder: 1, name: "John Smith",     unit: "A-101", address: "1 Oak Lane",   phone: "9800-10101", paperIds: ["p1", "p4"], deliveryBoyId: "db1" },
  { id: "r2", routeOrder: 2, name: "Maria Garcia",   unit: "B-202", address: "1 Oak Lane",   phone: "9800-20202", paperIds: ["p5", "p2"], deliveryBoyId: "db1" },
  { id: "r3", routeOrder: 3, name: "Robert Chen",    unit: "C-303", address: "1 Oak Lane",   phone: "9800-30303", paperIds: ["p1", "p3", "p4"], deliveryBoyId: "db1" },
  { id: "r4", routeOrder: 1, name: "Sarah Johnson",  unit: "D-404", address: "2 Elm Street", phone: "9800-40404", paperIds: ["p2"], deliveryBoyId: "db2" },
  { id: "r5", routeOrder: 2, name: "David Williams", unit: "E-505", address: "2 Elm Street", phone: "9800-50505", paperIds: ["p1", "p5"], deliveryBoyId: "db2" },
  { id: "r6", routeOrder: 1, name: "Priya Patel",    unit: "F-606", address: "3 Maple Ave",  phone: "9800-60606", paperIds: ["p3", "p2"], deliveryBoyId: "db3" },
]

// ─── Scheduling & billing helpers ─────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function daysInMonth(m: number, y: number) { return new Date(y, m, 0).getDate() }
function firstDayOfMonth(m: number, y: number) { return new Date(y, m - 1, 1).getDay() }
function yearMonth(y: number, m: number) { return `${y}-${String(m).padStart(2, "0")}` }
function todayYM() { const d = new Date(); return yearMonth(d.getFullYear(), d.getMonth() + 1) }

function scheduleLabel(p: Paper): string {
  switch (p.schedule) {
    case "daily":    return "Daily"
    case "weekdays": return "Weekdays (Mon–Fri)"
    case "weekends": return "Weekends (Sat–Sun)"
    case "sundays":  return "Sundays only"
    case "specific": return `Every ${p.scheduleDays.map(d => DOW_NAMES[d]).join(", ") || "—"}`
    case "monthly":  return `Monthly (day ${p.scheduleDayOfMonth})`
    case "annual":   return `Annual (${MONTH_SHORT[(p.scheduleMonth ?? 1) - 1]} ${p.scheduleDayOfMonth})`
  }
}

function getDeliveryDays(paper: Paper, month: number, year: number): Date[] {
  const num = daysInMonth(month, year)
  const result: Date[] = []
  for (let d = 1; d <= num; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    let include = false
    switch (paper.schedule) {
      case "daily":    include = true; break
      case "weekdays": include = dow >= 1 && dow <= 5; break
      case "weekends": include = dow === 0 || dow === 6; break
      case "sundays":  include = dow === 0; break
      case "specific": include = paper.scheduleDays.includes(dow); break
      case "monthly":  include = d === paper.scheduleDayOfMonth; break
      case "annual":   include = month === paper.scheduleMonth && d === paper.scheduleDayOfMonth; break
    }
    if (include) result.push(date)
  }
  return result
}

function priceOnDay(paper: Paper, date: Date, ym: string): number {
  const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const dow = date.getDay()
  // Priority: specific-date exception > day-of-week exception > monthly override > base
  const specExc = paper.priceExceptions.find(e => e.type === "specific_date" && e.specificDate === dStr)
  if (specExc) return specExc.price
  const dowExc = paper.priceExceptions.find(e => e.type === "day_of_week" && e.dayOfWeek === dow)
  if (dowExc) return dowExc.price
  const mp = paper.monthlyPrices.find(x => x.yearMonth === ym)
  if (mp) return mp.price
  return paper.basePrice
}

function calcBill(resident: Resident, papers: Paper[], month: number, year: number): Bill["lineItems"] {
  const ym = yearMonth(year, month)
  return resident.paperIds.map(pid => {
    const p = papers.find(x => x.id === pid)!
    const days = getDeliveryDays(p, month, year)
    const amount = days.reduce((s, d) => s + priceOnDay(p, d, ym), 0)
    return {
      paperId: pid,
      name: p.name,
      qty: days.length,
      unitDesc: scheduleLabel(p),
      amount: Math.round(amount * 100) / 100,
    }
  })
}

function estMonthly(paper: Paper): number {
  const today = new Date()
  return calcBill(
    { id: "", routeOrder: 0, name: "", unit: "", address: "", phone: "", paperIds: [paper.id] },
    [paper],
    today.getMonth() + 1,
    today.getFullYear()
  ).reduce((s, l) => s + l.amount, 0)
}

function makeFmt(cur: string) { return (n: number) => cur + n.toFixed(2) }
function uid() { return Math.random().toString(36).slice(2, 10) }

// ─── Shared UI components ─────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(17,17,17,0.55)" }}>
      <div className={`w-full border-2 border-black ${wide ? "max-w-3xl" : "max-w-lg"}`}
        style={{ backgroundColor: "#F2ECD9", maxHeight: "92vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between border-b-2 border-black px-6 py-4 sticky top-0" style={{ backgroundColor: "#F2ECD9", zIndex: 1 }}>
          <h3 className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="hover:text-red-700 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={`mb-4 ${half ? "w-1/2" : ""}`}>
      <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full border border-black px-3 py-2 text-sm bg-transparent outline-none focus:border-red-700 transition-colors"
const cellInputCls = "w-full border-0 border-b border-black bg-transparent outline-none px-1 py-0.5 text-xs focus:border-red-700 transition-colors"
const selectCls = "border border-black px-2 py-1.5 text-xs bg-transparent outline-none focus:border-red-700 transition-colors"

const BtnPrimary = ({ onClick, children, small, type }: { onClick?: () => void; children: React.ReactNode; small?: boolean; type?: "button" | "submit" }) => (
  <button type={type ?? "button"} onClick={onClick} className={`bg-black text-white hover:bg-red-700 transition-colors font-bold tracking-widest uppercase ${small ? "px-2 py-1 text-xs" : "px-4 py-2 text-xs"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{children}</button>
)
const BtnGhost = ({ onClick, children, small }: { onClick: () => void; children: React.ReactNode; small?: boolean }) => (
  <button onClick={onClick} className={`border border-black hover:bg-black hover:text-white transition-colors font-bold tracking-widest uppercase ${small ? "px-2 py-1 text-xs" : "px-4 py-2 text-xs"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{children}</button>
)

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold tracking-widest uppercase mb-3 pt-2 border-t border-black" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{children}</div>
  )
}

// ─── Papers checkbox dialog ───────────────────────────────────────────────────

function PapersDialog({ papers, selected, onSave, onClose, currency }: {
  papers: Paper[]; selected: string[]; onSave: (ids: string[]) => void; onClose: () => void; currency: string
}) {
  const fmt = makeFmt(currency)
  const [ids, setIds] = useState<string[]>(selected)
  function toggle(id: string) { setIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]) }
  return (
    <Modal title="Select Newspapers" onClose={onClose}>
      <div className="flex flex-col gap-2 mb-6">
        {papers.map(p => (
          <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
            <div onClick={() => toggle(p.id)} className={`w-4 h-4 border border-black flex items-center justify-center transition-colors flex-shrink-0 ${ids.includes(p.id) ? "bg-black" : "group-hover:bg-stone-200"}`}>
              {ids.includes(p.id) && <Check size={10} color="#F2ECD9" />}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{p.name}</span>
                <span className="block text-xs" style={{ color: "#5A5240" }}>{scheduleLabel(p)}</span>
              </div>
              <span className="text-xs ml-3 flex-shrink-0" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{fmt(p.basePrice)}/issue</span>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <BtnPrimary onClick={() => { onSave(ids); onClose() }}>Apply</BtnPrimary>
      </div>
    </Modal>
  )
}

// ─── Paper Form (add / edit) ─────────────────────────────────────────────────

const BLANK_PAPER: Omit<Paper, "id"> = {
  name: "", basePrice: 0, schedule: "daily",
  scheduleDays: [], scheduleDayOfMonth: 1, scheduleMonth: 1,
  priceExceptions: [], monthlyPrices: [],
}

function PaperFormModal({ initial, onSave, onClose, currency }: {
  initial: Paper | null
  onSave: (p: Paper) => void
  onClose: () => void
  currency: string
}) {
  const cur = currency || "₹"
  const [form, setForm] = useState<Omit<Paper, "id">>(initial ? { ...initial } : { ...BLANK_PAPER })
  const [excForm, setExcForm] = useState({ label: "", type: "day_of_week" as "day_of_week" | "specific_date", dayOfWeek: 0, specificDate: "", price: "" })
  const [mpForm, setMpForm] = useState({ yearMonth: todayYM(), price: "" })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }

  function toggleDay(d: number) {
    set("scheduleDays", form.scheduleDays.includes(d) ? form.scheduleDays.filter(x => x !== d) : [...form.scheduleDays, d])
  }

  function addException() {
    if (!excForm.label || !excForm.price) return
    const exc: PriceException = {
      id: uid(), label: excForm.label, type: excForm.type,
      dayOfWeek: excForm.type === "day_of_week" ? excForm.dayOfWeek : undefined,
      specificDate: excForm.type === "specific_date" ? excForm.specificDate : undefined,
      price: parseFloat(excForm.price) || 0,
    }
    set("priceExceptions", [...form.priceExceptions, exc])
    setExcForm({ label: "", type: "day_of_week", dayOfWeek: 0, specificDate: "", price: "" })
  }

  function removeException(id: string) { set("priceExceptions", form.priceExceptions.filter(e => e.id !== id)) }

  function addMonthlyPrice() {
    if (!mpForm.yearMonth || !mpForm.price) return
    const price = parseFloat(mpForm.price) || 0
    const existing = form.monthlyPrices.find(x => x.yearMonth === mpForm.yearMonth)
    if (existing) {
      set("monthlyPrices", form.monthlyPrices.map(x => x.yearMonth === mpForm.yearMonth ? { ...x, price } : x))
    } else {
      set("monthlyPrices", [...form.monthlyPrices, { yearMonth: mpForm.yearMonth, price }])
    }
    setMpForm(f => ({ ...f, price: "" }))
  }

  function removeMonthlyPrice(ym: string) { set("monthlyPrices", form.monthlyPrices.filter(x => x.yearMonth !== ym)) }

  function save() {
    if (!form.name.trim()) return
    onSave({ id: initial?.id ?? uid(), ...form })
    onClose()
  }

  const sortedMP = [...form.monthlyPrices].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))

  return (
    <Modal title={initial ? "Edit Publication" : "Add Publication"} onClose={onClose} wide>
      {/* Name */}
      <Field label="Publication Name">
        <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. The Morning Post" />
      </Field>

      {/* Schedule */}
      <SectionHead>Delivery Schedule</SectionHead>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["daily","weekdays","weekends","sundays","specific","monthly","annual"] as Schedule[]).map(s => (
          <label key={s} className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => set("schedule", s)} className={`w-3.5 h-3.5 rounded-full border border-black flex-shrink-0 flex items-center justify-center ${form.schedule === s ? "bg-black" : ""}`}>
              {form.schedule === s && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className="text-xs" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              {s === "daily" ? "Daily (every day)" : s === "weekdays" ? "Weekdays (Mon–Fri)" : s === "weekends" ? "Weekends (Sat–Sun)" : s === "sundays" ? "Sundays only" : s === "specific" ? "Specific days of week" : s === "monthly" ? "Once a month" : "Once a year (annual)"}
            </span>
          </label>
        ))}
      </div>

      {form.schedule === "specific" && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {DOW_NAMES.map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              className="px-2 py-1 text-xs border border-black transition-colors font-bold"
              style={{ fontFamily: "'Libre Franklin', sans-serif", backgroundColor: form.scheduleDays.includes(i) ? "#111111" : "transparent", color: form.scheduleDays.includes(i) ? "#F2ECD9" : "#111111" }}>
              {d}
            </button>
          ))}
        </div>
      )}
      {form.schedule === "monthly" && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs" style={{ color: "#5A5240" }}>Day of month:</span>
          <input type="number" min={1} max={31} className="border border-black px-2 py-1 text-sm w-16 bg-transparent outline-none focus:border-red-700"
            style={{ fontFamily: "'DM Mono', monospace" }}
            value={form.scheduleDayOfMonth} onChange={e => set("scheduleDayOfMonth", parseInt(e.target.value) || 1)} />
        </div>
      )}
      {form.schedule === "annual" && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs" style={{ color: "#5A5240" }}>Month:</span>
          <select className={selectCls} value={form.scheduleMonth} onChange={e => set("scheduleMonth", parseInt(e.target.value))}>
            {MONTH_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <span className="text-xs" style={{ color: "#5A5240" }}>Day:</span>
          <input type="number" min={1} max={31} className="border border-black px-2 py-1 text-sm w-16 bg-transparent outline-none"
            style={{ fontFamily: "'DM Mono', monospace" }}
            value={form.scheduleDayOfMonth} onChange={e => set("scheduleDayOfMonth", parseInt(e.target.value) || 1)} />
        </div>
      )}

      {/* Base price */}
      <SectionHead>Pricing</SectionHead>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Base Price / Issue</label>
          <div className="flex">
            <span className="border border-r-0 border-black px-3 py-2 text-sm" style={{ fontFamily: "'DM Mono', monospace", backgroundColor: "#D9D1BC" }}>{cur}</span>
            <input type="number" step="0.01" className={inputCls + " border-l-0 w-28"} value={form.basePrice || ""} onChange={e => set("basePrice", parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div className="text-xs mt-4 pt-1" style={{ color: "#5A5240" }}>
          This is the default per-delivery price.<br />Override it per month or add day/date exceptions below.
        </div>
      </div>

      {/* Monthly price overrides */}
      <div className="mb-4">
        <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Monthly Price Overrides</div>
        <div className="flex gap-2 items-end mb-2 flex-wrap">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Month</label>
            <input type="month" className="border border-black px-2 py-1.5 text-xs bg-transparent outline-none focus:border-red-700"
              value={mpForm.yearMonth} onChange={e => setMpForm(f => ({ ...f, yearMonth: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Price / Issue</label>
            <div className="flex">
              <span className="border border-r-0 border-black px-2 py-1.5 text-xs" style={{ backgroundColor: "#D9D1BC" }}>{cur}</span>
              <input type="number" step="0.01" placeholder="0.00" className="border border-black border-l-0 px-2 py-1.5 text-xs w-24 bg-transparent outline-none"
                value={mpForm.price} onChange={e => setMpForm(f => ({ ...f, price: e.target.value }))} />
            </div>
          </div>
          <BtnPrimary onClick={addMonthlyPrice} small>Add Override</BtnPrimary>
        </div>
        {sortedMP.length > 0 && (
          <div className="border border-black">
            {sortedMP.map((mp, i) => {
              const [y, m] = mp.yearMonth.split("-")
              return (
                <div key={mp.yearMonth} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-black last:border-b-0"
                  style={{ backgroundColor: i % 2 === 1 ? "#EDE7D4" : "transparent" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>{MONTH_SHORT[parseInt(m)-1]} {y}</span>
                  <span className="font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{cur}{mp.price.toFixed(2)}/issue</span>
                  <button onClick={() => removeMonthlyPrice(mp.yearMonth)} className="hover:text-red-700 ml-4"><X size={12} /></button>
                </div>
              )
            })}
          </div>
        )}
        {sortedMP.length === 0 && <p className="text-xs" style={{ color: "#5A5240" }}>No overrides yet — base price applies all year.</p>}
      </div>

      {/* Price exceptions */}
      <div className="mb-6">
        <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Price Exceptions</div>
        <p className="text-xs mb-2" style={{ color: "#5A5240" }}>Special editions, holiday rates, weekend surcharges — any day/date that deviates from the base or monthly price.</p>
        <div className="flex gap-2 items-end flex-wrap mb-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Type</label>
            <select className={selectCls} value={excForm.type} onChange={e => setExcForm(f => ({ ...f, type: e.target.value as "day_of_week" | "specific_date" }))}>
              <option value="day_of_week">Every [day of week]</option>
              <option value="specific_date">Specific date</option>
            </select>
          </div>
          {excForm.type === "day_of_week" ? (
            <div>
              <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Day</label>
              <select className={selectCls} value={excForm.dayOfWeek} onChange={e => setExcForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}>
                {DOW_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Date</label>
              <input type="date" className={selectCls} value={excForm.specificDate} onChange={e => setExcForm(f => ({ ...f, specificDate: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Exception Price</label>
            <div className="flex">
              <span className="border border-r-0 border-black px-2 py-1.5 text-xs" style={{ backgroundColor: "#D9D1BC" }}>{cur}</span>
              <input type="number" step="0.01" placeholder="0.00" className="border border-black border-l-0 px-2 py-1.5 text-xs w-24 bg-transparent outline-none"
                value={excForm.price} onChange={e => setExcForm(f => ({ ...f, price: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#5A5240" }}>Label</label>
            <input className={selectCls} placeholder="e.g. Sunday Edition" value={excForm.label}
              onChange={e => setExcForm(f => ({ ...f, label: e.target.value }))} style={{ minWidth: 140 }} />
          </div>
          <BtnPrimary onClick={addException} small>Add</BtnPrimary>
        </div>
        {form.priceExceptions.length > 0 && (
          <div className="border border-black">
            {form.priceExceptions.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-black last:border-b-0"
                style={{ backgroundColor: i % 2 === 1 ? "#EDE7D4" : "transparent" }}>
                <span className="font-semibold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{e.label}</span>
                <span style={{ color: "#5A5240" }}>
                  {e.type === "day_of_week" ? `Every ${DOW_NAMES[e.dayOfWeek ?? 0]}` : e.specificDate}
                </span>
                <span className="font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{cur}{e.price.toFixed(2)}</span>
                <button onClick={() => removeException(e.id)} className="hover:text-red-700 ml-4"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        {form.priceExceptions.length === 0 && <p className="text-xs" style={{ color: "#5A5240" }}>No exceptions yet.</p>}
      </div>

      <div className="flex justify-end gap-3 border-t border-black pt-4">
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <BtnPrimary onClick={save}>Save Publication</BtnPrimary>
      </div>
    </Modal>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ residents, papers, bills, boys, currency }: {
  residents: Resident[]; papers: Paper[]; bills: Bill[]; boys: DeliveryBoy[]; currency: string
}) {
  const fmt = makeFmt(currency)
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [selected, setSelected] = useState<number | null>(today.getDate())

  const numDays = daysInMonth(month, year)
  const firstDay = firstDayOfMonth(month, year)
  const monthBills = bills.filter(b => b.month === month && b.year === year)
  const totalBilled = monthBills.reduce((s, b) => s + b.total, 0)
  const totalPaid = monthBills.filter(b => b.paid).reduce((s, b) => s + b.total, 0)

  function prev() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)]

  const selectedDayResidents = selected
    ? residents.filter(r => {
      const rPapers = r.paperIds.map(pid => papers.find(p => p.id === pid)!).filter(Boolean)
      return rPapers.some(p => getDeliveryDays(p, month, year).some(dd => dd.getDate() === selected))
    })
    : []

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prev} className="p-2 border border-black hover:bg-black hover:text-white transition-colors"><ChevronLeft size={14} /></button>
          <div className="text-center">
            <div className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{MONTHS[month - 1]}</div>
            <div className="text-xs tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{year}</div>
          </div>
          <button onClick={next} className="p-2 border border-black hover:bg-black hover:text-white transition-colors"><ChevronRight size={14} /></button>
        </div>
        <div className="grid grid-cols-3 border-t-2 border-l-2 border-black mb-4">
          {[{ label: "Subscribers", val: residents.length.toString() }, { label: "Month Billed", val: fmt(totalBilled) }, { label: "Collected", val: fmt(totalPaid) }].map(s => (
            <div key={s.label} className="border-b-2 border-r-2 border-black px-4 py-3">
              <div className="text-xs tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{s.label}</div>
              <div className="text-lg font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t-2 border-l-2 border-black">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="border-b-2 border-r-2 border-black px-2 py-1 text-center text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()
            const isSel = day === selected
            // Count residents with deliveries on this day
            const delCount = day ? residents.filter(r =>
              r.paperIds.some(pid => {
                const p = papers.find(x => x.id === pid)
                return p && getDeliveryDays(p, month, year).some(d2 => d2.getDate() === day)
              })
            ).length : 0
            return (
              <div key={i} onClick={() => day && setSelected(day)}
                className="border-b-2 border-r-2 border-black px-2 py-2 min-h-[52px] cursor-pointer transition-colors"
                style={{ backgroundColor: isSel ? "#111111" : isToday ? "#EDE7D4" : "transparent", color: isSel ? "#F2ECD9" : "#111111" }}>
                {day && (
                  <>
                    <div className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{String(day).padStart(2, "0")}</div>
                    {delCount > 0 && (
                      <div className="mt-1 flex gap-0.5 flex-wrap">
                        {Array.from({ length: Math.min(delCount, 4) }).map((_, k) => (
                          <div key={k} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSel ? "#F2ECD9" : "#BF1E1E" }} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day panel */}
      <div className="w-72 flex-shrink-0 border-2 border-black" style={{ backgroundColor: "#EDE7D4" }}>
        <div className="border-b-2 border-black px-5 py-4">
          <div className="text-xs tracking-widest uppercase font-bold mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>
            {selected ? `${MONTHS[month - 1]} ${selected}, ${year}` : "Select a day"}
          </div>
          <div className="text-lg font-black" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Delivery Schedule</div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
          {selectedDayResidents.length === 0
            ? <div className="px-5 py-6 text-sm" style={{ color: "#5A5240" }}>No deliveries scheduled.</div>
            : selectedDayResidents
                .sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99))
                .map(r => {
                  const ym = yearMonth(year, month)
                  const rPapers = r.paperIds.map(pid => papers.find(p => p.id === pid)!).filter(Boolean)
                    .filter(p => selected && getDeliveryDays(p, month, year).some(d => d.getDate() === selected))
                  const bill = monthBills.find(b => b.residentId === r.id)
                  const boy = boys.find(b => b.id === r.deliveryBoyId)
                  return (
                    <div key={r.id} className="border-b border-black px-5 py-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold" style={{ fontFamily: "'DM Mono', monospace", color: "#BF1E1E" }}>#{r.routeOrder}</span>
                            <span className="text-sm font-bold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{r.name}</span>
                          </div>
                          <div className="text-xs" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>{r.unit}</div>
                        </div>
                        {bill && <span className={`text-xs px-1.5 py-0.5 font-bold ${bill.paid ? "bg-black text-white" : "border border-black"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{bill.paid ? "PAID" : "DUE"}</span>}
                      </div>
                      {boy && <div className="flex items-center gap-1 mb-2 text-xs" style={{ color: "#BF1E1E", fontFamily: "'Libre Franklin', sans-serif" }}><Bike size={10} /> {boy.name}</div>}
                      <div className="flex flex-col gap-0.5">
                        {rPapers.map(p => {
                          const dayPrice = selected ? priceOnDay(p, new Date(year, month - 1, selected), ym) : p.basePrice
                          const isException = selected && (
                            p.priceExceptions.some(e => e.type === "day_of_week" && e.dayOfWeek === new Date(year, month - 1, selected).getDay()) ||
                            p.priceExceptions.some(e => e.type === "specific_date" && e.specificDate === `${year}-${String(month).padStart(2,"0")}-${String(selected).padStart(2,"0")}`)
                          )
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span style={{ color: "#5A5240" }}>• {p.name}</span>
                              <span className="flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                                {isException && <AlertTriangle size={9} style={{ color: "#BF1E1E" }} />}
                                {fmt(dayPrice)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
          }
        </div>
      </div>
    </div>
  )
}

// ─── Residents View ───────────────────────────────────────────────────────────

function ResidentsView({ residents, setResidents, papers, boys, currency }: {
  residents: Resident[]
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>
  papers: Paper[]
  boys: DeliveryBoy[]
  currency: string
}) {
  const fmt = makeFmt(currency)
  const [filterBoy, setFilterBoy] = useState("")
  const [filterPaper, setFilterPaper] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState<Resident[]>([])
  const [papersDialogFor, setPapersDialogFor] = useState<string | null>(null)

  function enterEdit() { setDrafts(residents.map(r => ({ ...r }))); setEditMode(true) }
  function saveEdit() { setResidents(drafts); setEditMode(false) }
  function cancelEdit() { setEditMode(false); setDrafts([]) }
  function updateDraft(id: string, changes: Partial<Resident>) {
    setDrafts(ds => ds.map(d => d.id === id ? { ...d, ...changes } : d))
  }
  function addRow() {
    const maxRoute = drafts.reduce((m, d) => Math.max(m, d.routeOrder ?? 0), 0)
    setDrafts(ds => [...ds, { id: uid(), routeOrder: maxRoute + 1, name: "", unit: "", address: "", phone: "", paperIds: [], deliveryBoyId: undefined }])
  }
  function deleteRow(id: string) { setDrafts(ds => ds.filter(d => d.id !== id)) }
  function deleteResident(id: string) {
    if (confirm("Remove this resident?")) setResidents(rs => rs.filter(r => r.id !== id))
  }

  const viewList = residents.filter(r => {
    if (filterBoy && r.deliveryBoyId !== filterBoy) return false
    if (filterPaper && !r.paperIds.includes(filterPaper)) return false
    return true
  }).sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999))

  const displayList = editMode ? drafts : viewList

  function monthlyFor(r: Resident) {
    const today = new Date()
    return calcBill(r, papers, today.getMonth() + 1, today.getFullYear()).reduce((s, l) => s + l.amount, 0)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Residents</div>
          <div className="text-xs tracking-widest" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>{residents.length} registered</div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button onClick={addRow} className="flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold tracking-widest uppercase hover:bg-black hover:text-white transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
                <Plus size={11} /> Add Row
              </button>
              <button onClick={cancelEdit} className="flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold tracking-widest uppercase transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#BF1E1E" }}>
                <XCircle size={13} /> Cancel
              </button>
              <button onClick={saveEdit} className="flex items-center gap-1.5 bg-black text-white px-3 py-2 text-xs font-bold tracking-widest uppercase hover:bg-green-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
                <Save size={13} /> Save All
              </button>
            </>
          ) : (
            <button onClick={enterEdit} className="flex items-center gap-2 border-2 border-black px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-black hover:text-white transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              <TableProperties size={13} /> Edit Mode
            </button>
          )}
        </div>
      </div>

      {/* Filters — view mode only */}
      {!editMode && (
        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Filter:</span>
          <select className={selectCls} value={filterBoy} onChange={e => { setFilterBoy(e.target.value); setFilterPaper("") }}>
            <option value="">All Delivery Boys</option>
            {boys.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="text-xs" style={{ color: "#5A5240" }}>or</span>
          <select className={selectCls} value={filterPaper} onChange={e => { setFilterPaper(e.target.value); setFilterBoy("") }}>
            <option value="">All Papers</option>
            {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(filterBoy || filterPaper) && (
            <button onClick={() => { setFilterBoy(""); setFilterPaper("") }} className="text-xs underline" style={{ color: "#BF1E1E" }}>Clear</button>
          )}
          <span className="text-xs ml-auto" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>{displayList.length} shown · sorted by route order</span>
        </div>
      )}

      {editMode && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 border border-black" style={{ backgroundColor: "#EDE7D4" }}>
          <TableProperties size={13} style={{ color: "#BF1E1E" }} />
          <span className="text-xs font-bold" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>EDIT MODE — click any cell to edit. Click Papers "Edit" to open newspaper selection dialog.</span>
        </div>
      )}

      {/* Table — columns: Route | Unit | Name | Address | Phone | Papers | Delivery Boy | Monthly | Del */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 980 }}>
          <div className="grid border-b-2 border-l-2 border-r-2 border-t-2 border-black"
            style={{ gridTemplateColumns: "60px 80px 130px 130px 120px 1fr 140px 90px 44px", backgroundColor: "#111111", color: "#F2ECD9" }}>
            {["Route","Unit","Name","Address","Phone","Papers","Delivery Boy","Monthly",""].map((h, i) => (
              <div key={i} className="px-2 py-2 text-xs font-bold tracking-widest uppercase border-r border-white/20 last:border-r-0" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{h}</div>
            ))}
          </div>

          {displayList.length === 0 && (
            <div className="border-b-2 border-l-2 border-r-2 border-black px-4 py-6 text-sm text-center" style={{ color: "#5A5240" }}>
              {editMode ? "No rows — click Add Row to begin." : "No residents match the current filter."}
            </div>
          )}

          {displayList.map((r, idx) => {
            const rPapers = r.paperIds.map(pid => papers.find(p => p.id === pid)!).filter(Boolean)
            const boy = boys.find(b => b.id === r.deliveryBoyId)
            const monthly = monthlyFor(r)
            const rowBg = editMode ? (idx % 2 === 1 ? "#E5DFC8" : "#EDE7D4") : (idx % 2 === 1 ? "#EDE7D4" : "transparent")

            return (
              <div key={r.id} className="grid border-b-2 border-l-2 border-r-2 border-black"
                style={{ gridTemplateColumns: "60px 80px 130px 130px 120px 1fr 140px 90px 44px", backgroundColor: rowBg }}>

                {/* Route Order */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode
                    ? <input type="number" className={cellInputCls + " text-center"} value={r.routeOrder} onChange={e => updateDraft(r.id, { routeOrder: parseInt(e.target.value) || 0 })} style={{ fontFamily: "'DM Mono', monospace" }} />
                    : <span className="text-xs font-bold text-center w-full" style={{ fontFamily: "'DM Mono', monospace", color: "#BF1E1E" }}>#{r.routeOrder}</span>}
                </div>
                {/* Unit */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode
                    ? <input className={cellInputCls} value={r.unit} onChange={e => updateDraft(r.id, { unit: e.target.value })} style={{ fontFamily: "'DM Mono', monospace" }} />
                    : <span className="text-xs font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{r.unit}</span>}
                </div>
                {/* Name */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode
                    ? <input className={cellInputCls} value={r.name} onChange={e => updateDraft(r.id, { name: e.target.value })} style={{ fontFamily: "'Libre Franklin', sans-serif" }} />
                    : <span className="text-sm font-semibold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{r.name}</span>}
                </div>
                {/* Address */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode
                    ? <input className={cellInputCls} value={r.address} onChange={e => updateDraft(r.id, { address: e.target.value })} />
                    : <span className="text-xs" style={{ color: "#5A5240" }}>{r.address}</span>}
                </div>
                {/* Phone */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode
                    ? <input className={cellInputCls} value={r.phone} onChange={e => updateDraft(r.id, { phone: e.target.value })} style={{ fontFamily: "'DM Mono', monospace" }} />
                    : <span className="text-xs" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{r.phone}</span>}
                </div>
                {/* Papers */}
                <div className="px-2 py-2 border-r border-black flex items-center gap-1 flex-wrap min-h-[36px]">
                  {rPapers.map(p => (
                    <span key={p.id} className="border border-black px-1 py-0.5 text-xs leading-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{p.name}</span>
                  ))}
                  {rPapers.length === 0 && !editMode && <span className="text-xs" style={{ color: "#5A5240" }}>—</span>}
                  {editMode && (
                    <button onClick={() => setPapersDialogFor(r.id)}
                      className="ml-auto flex items-center gap-0.5 border border-black px-1.5 py-0.5 text-xs hover:bg-black hover:text-white transition-colors flex-shrink-0"
                      style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
                      <Pencil size={9} /> Edit
                    </button>
                  )}
                </div>
                {/* Delivery Boy */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  {editMode ? (
                    <select className="w-full border-0 border-b border-black bg-transparent text-xs outline-none focus:border-red-700"
                      value={r.deliveryBoyId ?? ""} onChange={e => updateDraft(r.id, { deliveryBoyId: e.target.value || undefined })}>
                      <option value="">— None</option>
                      {boys.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  ) : (
                    boy
                      ? <span className="flex items-center gap-1 text-xs" style={{ fontFamily: "'Libre Franklin', sans-serif" }}><Bike size={11} style={{ color: "#BF1E1E" }} /> {boy.name}</span>
                      : <span className="text-xs" style={{ color: "#5A5240" }}>—</span>
                  )}
                </div>
                {/* Monthly */}
                <div className="px-2 py-2 border-r border-black flex items-center">
                  <span className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(monthly)}</span>
                </div>
                {/* Delete */}
                <div className="px-2 py-2 flex items-center justify-center">
                  <button onClick={() => editMode ? deleteRow(r.id) : deleteResident(r.id)} className="hover:text-red-700 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {papersDialogFor && (
        <PapersDialog
          papers={papers}
          currency={currency}
          selected={drafts.find(d => d.id === papersDialogFor)?.paperIds ?? []}
          onSave={ids => updateDraft(papersDialogFor, { paperIds: ids })}
          onClose={() => setPapersDialogFor(null)}
        />
      )}
    </div>
  )
}

// ─── Bills View ───────────────────────────────────────────────────────────────

function BillsView({ bills, setBills, residents, papers, currency }: {
  bills: Bill[]; setBills: React.Dispatch<React.SetStateAction<Bill[]>>; residents: Resident[]; papers: Paper[]; currency: string
}) {
  const fmt = makeFmt(currency)
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [detail, setDetail] = useState<Bill | null>(null)

  const monthBills = bills.filter(b => b.month === month && b.year === year)
  const total = monthBills.reduce((s, b) => s + b.total, 0)
  const paid = monthBills.filter(b => b.paid).reduce((s, b) => s + b.total, 0)
  const outstanding = total - paid

  function generateBills() {
    const existing = bills.filter(b => b.month === month && b.year === year).map(b => b.residentId)
    const newBills: Bill[] = residents
      .filter(r => r.paperIds.length > 0 && !existing.includes(r.id))
      .map(r => {
        const lines = calcBill(r, papers, month, year)
        return { id: uid(), residentId: r.id, month, year, lineItems: lines, total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, paid: false, generatedOn: new Date().toISOString().split("T")[0] }
      })
    setBills(bs => [...bs, ...newBills])
  }

  function markPaid(id: string) { setBills(bs => bs.map(b => b.id === id ? { ...b, paid: true, paidDate: new Date().toISOString().split("T")[0] } : b)) }
  function markUnpaid(id: string) { setBills(bs => bs.map(b => b.id === id ? { ...b, paid: false, paidDate: undefined } : b)) }
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const residentName = (id: string) => residents.find(r => r.id === id)?.name ?? "Unknown"
  const residentUnit = (id: string) => residents.find(r => r.id === id)?.unit ?? "—"

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Monthly Billing</div>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={prevMonth} className="p-0.5 hover:text-red-700 transition-colors"><ChevronLeft size={14} /></button>
            <span className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>{MONTHS[month - 1]} {year}</span>
            <button onClick={nextMonth} className="p-0.5 hover:text-red-700 transition-colors"><ChevronRight size={14} /></button>
          </div>
        </div>
        <button onClick={generateBills} className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-red-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
          <FileText size={12} /> Generate Bills
        </button>
      </div>
      <div className="grid grid-cols-4 border-t-2 border-l-2 border-black mb-5">
        {[
          { label: "Bills Generated", val: monthBills.length.toString(), sub: "this month" },
          { label: "Total Billed", val: fmt(total), sub: "gross amount" },
          { label: "Collected", val: fmt(paid), sub: `${monthBills.filter(b => b.paid).length} paid` },
          { label: "Outstanding", val: fmt(outstanding), sub: `${monthBills.filter(b => !b.paid).length} pending`, red: outstanding > 0 },
        ].map(s => (
          <div key={s.label} className="border-b-2 border-r-2 border-black px-4 py-4">
            <div className="text-xs tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{s.label}</div>
            <div className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: s.red ? "#BF1E1E" : "#111111" }}>{s.val}</div>
            <div className="text-xs mt-0.5" style={{ color: "#5A5240" }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {monthBills.length === 0 ? (
        <div className="border-2 border-dashed border-black px-8 py-12 text-center">
          <ReceiptText size={32} className="mx-auto mb-3" style={{ color: "#5A5240" }} />
          <div className="text-sm font-bold mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>No bills for {MONTHS[month - 1]} {year}</div>
          <div className="text-xs" style={{ color: "#5A5240" }}>Click "Generate Bills" to create bills for all subscribers.</div>
        </div>
      ) : (
        <div className="border-t-2 border-l-2 border-black">
          <div className="grid grid-cols-12 border-b-2 border-r-2 border-black" style={{ backgroundColor: "#111111", color: "#F2ECD9" }}>
            {["Unit","Resident","Papers","Amount","Status","Paid Date",""].map((h, i) => (
              <div key={i} className={`px-3 py-2 text-xs font-bold tracking-widest uppercase border-r border-white/20 ${i===0?"col-span-1":i===1?"col-span-2":i===2?"col-span-3":i===3?"col-span-2":i===4?"col-span-1":i===5?"col-span-2":"col-span-1"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{h}</div>
            ))}
          </div>
          {monthBills.map((b, idx) => (
            <div key={b.id} className="grid grid-cols-12 border-b-2 border-r-2 border-black hover:bg-stone-100 transition-colors cursor-pointer" style={{ backgroundColor: idx % 2 === 1 ? "#EDE7D4" : "transparent" }} onClick={() => setDetail(b)}>
              <div className="col-span-1 px-3 py-3 text-xs font-bold border-r border-black" style={{ fontFamily: "'DM Mono', monospace" }}>{residentUnit(b.residentId)}</div>
              <div className="col-span-2 px-3 py-3 text-sm font-semibold border-r border-black" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{residentName(b.residentId)}</div>
              <div className="col-span-3 px-3 py-3 text-xs border-r border-black flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                {b.lineItems.map((l, i) => <span key={i} className="border border-black px-1 py-0.5">{l.name}</span>)}
              </div>
              <div className="col-span-2 px-3 py-3 text-sm font-bold border-r border-black" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(b.total)}</div>
              <div className="col-span-1 px-3 py-3 border-r border-black" onClick={e => e.stopPropagation()}>
                {b.paid ? <span className="flex items-center gap-1 text-xs font-bold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}><CircleCheck size={12} className="text-green-700" /> PAID</span>
                        : <span className="flex items-center gap-1 text-xs font-bold text-amber-700" style={{ fontFamily: "'Libre Franklin', sans-serif" }}><Clock size={12} /> DUE</span>}
              </div>
              <div className="col-span-2 px-3 py-3 text-xs border-r border-black" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{b.paidDate ?? "—"}</div>
              <div className="col-span-1 px-3 py-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {b.paid
                  ? <button onClick={() => markUnpaid(b.id)} className="text-xs border border-black px-1.5 py-0.5 hover:bg-black hover:text-white transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Undo</button>
                  : <button onClick={() => markPaid(b.id)} className="text-xs bg-black text-white px-1.5 py-0.5 hover:bg-green-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Pay</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {detail && (
        <Modal title={`Bill — ${residentName(detail.residentId)}`} onClose={() => setDetail(null)}>
          <div className="mb-4 flex justify-between text-xs" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>
            <span>Unit: {residentUnit(detail.residentId)}</span>
            <span>{MONTHS[detail.month - 1]} {detail.year}</span>
          </div>
          <div className="border-t-2 border-l-2 border-black mb-4">
            <div className="grid grid-cols-12 border-b-2 border-r-2 border-black" style={{ backgroundColor: "#111111", color: "#F2ECD9" }}>
              {["Publication","Issues","Schedule","Amount"].map((h, i) => (
                <div key={i} className={`px-2 py-1.5 text-xs font-bold tracking-widest uppercase border-r border-white/20 ${i===0?"col-span-4":i===1?"col-span-2":i===2?"col-span-3":"col-span-3"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{h}</div>
              ))}
            </div>
            {detail.lineItems.map((l, i) => (
              <div key={i} className="grid grid-cols-12 border-b-2 border-r-2 border-black">
                <div className="col-span-4 px-2 py-2 text-xs font-semibold border-r border-black" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{l.name}</div>
                <div className="col-span-2 px-2 py-2 text-xs border-r border-black text-center" style={{ fontFamily: "'DM Mono', monospace" }}>{l.qty}</div>
                <div className="col-span-3 px-2 py-2 text-xs border-r border-black" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>{l.unitDesc}</div>
                <div className="col-span-3 px-2 py-2 text-xs font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(l.amount)}</div>
              </div>
            ))}
            <div className="grid grid-cols-12 border-r-2 border-black" style={{ backgroundColor: "#111111", color: "#F2ECD9" }}>
              <div className="col-span-9 px-2 py-2 text-xs font-bold tracking-widest uppercase border-r border-white/20 text-right" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Total</div>
              <div className="col-span-3 px-2 py-2 text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(detail.total)}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>Generated: {detail.generatedOn}</div>
            <div className="flex gap-3">
              {detail.paid
                ? <BtnGhost onClick={() => { markUnpaid(detail.id); setDetail(d => d ? { ...d, paid: false, paidDate: undefined } : d) }}>Mark Unpaid</BtnGhost>
                : <BtnPrimary onClick={() => { markPaid(detail.id); setDetail(d => d ? { ...d, paid: true, paidDate: new Date().toISOString().split("T")[0] } : d) }}>Mark as Paid</BtnPrimary>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsView({ currency, setCurrency, papers, setPapers, residents, boys, setBoys }: {
  currency: string; setCurrency: (c: string) => void
  papers: Paper[]; setPapers: React.Dispatch<React.SetStateAction<Paper[]>>
  residents: Resident[]; boys: DeliveryBoy[]; setBoys: React.Dispatch<React.SetStateAction<DeliveryBoy[]>>
}) {
  const fmt = makeFmt(currency)

  // Papers
  const [paperFormTarget, setPaperFormTarget] = useState<Paper | null | "new">(null)
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function onDragStart(idx: number) { dragIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx) }
  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault(); const from = dragIdx.current
    if (from === null || from === idx) { setOverIdx(null); return }
    setPapers(ps => { const a = [...ps]; const [it] = a.splice(from, 1); a.splice(idx, 0, it); return a })
    dragIdx.current = null; setOverIdx(null)
  }
  function onDragEnd() { dragIdx.current = null; setOverIdx(null) }
  function savePaper(p: Paper) { setPapers(ps => ps.some(x => x.id === p.id) ? ps.map(x => x.id === p.id ? p : x) : [...ps, p]) }
  function delPaper(id: string) { if (confirm("Delete this newspaper?")) setPapers(ps => ps.filter(p => p.id !== id)) }

  // Boys
  const [editingBoyId, setEditingBoyId] = useState<string | null>(null)
  const [addingBoy, setAddingBoy] = useState(false)
  const [boyForm, setBoyForm] = useState({ name: "", phone: "", area: "" })
  function openAddBoy() { setBoyForm({ name: "", phone: "", area: "" }); setAddingBoy(true); setEditingBoyId(null) }
  function openEditBoy(b: DeliveryBoy) { setBoyForm({ name: b.name, phone: b.phone, area: b.area }); setEditingBoyId(b.id); setAddingBoy(false) }
  function saveBoy() {
    if (editingBoyId) setBoys(bs => bs.map(b => b.id === editingBoyId ? { ...b, ...boyForm } : b))
    else setBoys(bs => [...bs, { id: uid(), ...boyForm }])
    setAddingBoy(false); setEditingBoyId(null)
  }
  function delBoy(id: string) { if (confirm("Remove this delivery boy?")) setBoys(bs => bs.filter(b => b.id !== id)) }

  const PRESETS = [{ sym: "₹", label: "Rupee" }, { sym: "$", label: "Dollar" }, { sym: "€", label: "Euro" }, { sym: "£", label: "Pound" }]

  const today = new Date()
  const currentYM = yearMonth(today.getFullYear(), today.getMonth() + 1)

  return (
    <div className="max-w-4xl">
      <div className="text-2xl font-black tracking-tight mb-6" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Settings</div>

      {/* Currency */}
      <section className="mb-10">
        <div className="border-b-2 border-black mb-4 pb-1">
          <div className="text-sm font-black tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Currency Unit</div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.sym} onClick={() => setCurrency(p.sym)}
              className="flex items-center gap-2 border-2 px-4 py-3 text-sm font-bold transition-colors"
              style={{ fontFamily: "'DM Mono', monospace", borderColor: "#111111", backgroundColor: currency === p.sym ? "#111111" : "transparent", color: currency === p.sym ? "#F2ECD9" : "#111111" }}>
              <span className="text-xl">{p.sym}</span>
              <span className="text-xs tracking-widest" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{p.label}</span>
            </button>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#5A5240" }}>Custom:</span>
            <input className="border border-black px-2 py-2 w-16 text-center text-lg outline-none focus:border-red-700 bg-transparent"
              style={{ fontFamily: "'DM Mono', monospace" }} value={currency} maxLength={3} onChange={e => setCurrency(e.target.value)} />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#5A5240" }}>All amounts across the app will display with this symbol.</p>
      </section>

      {/* Delivery Boys */}
      <section className="mb-10">
        <div className="border-b-2 border-black mb-4 pb-1 flex items-center justify-between">
          <div className="text-sm font-black tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Delivery Boys</div>
          {!addingBoy && !editingBoyId && (
            <button onClick={openAddBoy} className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 text-xs font-bold tracking-widest uppercase hover:bg-red-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              <Plus size={11} /> Add Boy
            </button>
          )}
        </div>
        {(addingBoy || editingBoyId) && (
          <div className="border-2 border-black p-4 mb-4" style={{ backgroundColor: "#EDE7D4" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{editingBoyId ? "Edit" : "New"} Delivery Boy</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Full Name"><input className={inputCls} value={boyForm.name} onChange={e => setBoyForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Phone"><input className={inputCls} value={boyForm.phone} onChange={e => setBoyForm(f => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="Area / Route"><input className={inputCls} value={boyForm.area} onChange={e => setBoyForm(f => ({ ...f, area: e.target.value }))} /></Field>
            </div>
            <div className="flex gap-2">
              <BtnPrimary onClick={saveBoy}>Save</BtnPrimary>
              <BtnGhost onClick={() => { setAddingBoy(false); setEditingBoyId(null) }}>Cancel</BtnGhost>
            </div>
          </div>
        )}
        <div className="border-t-2 border-l-2 border-black">
          <div className="grid grid-cols-12 border-b-2 border-r-2 border-black" style={{ backgroundColor: "#111111", color: "#F2ECD9" }}>
            {["Name","Phone","Area / Route","Residents",""].map((h, i) => (
              <div key={i} className={`px-3 py-2 text-xs font-bold tracking-widest uppercase border-r border-white/20 ${i===0?"col-span-4":i===1?"col-span-3":i===2?"col-span-3":i===3?"col-span-1":"col-span-1"}`} style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{h}</div>
            ))}
          </div>
          {boys.length === 0
            ? <div className="border-b-2 border-r-2 border-black px-4 py-6 text-sm text-center" style={{ color: "#5A5240" }}>No delivery boys yet.</div>
            : boys.map((b, idx) => {
              const cnt = residents.filter(r => r.deliveryBoyId === b.id).length
              return (
                <div key={b.id} className="grid grid-cols-12 border-b-2 border-r-2 border-black" style={{ backgroundColor: idx % 2 === 1 ? "#EDE7D4" : "transparent" }}>
                  <div className="col-span-4 px-3 py-3 text-sm font-semibold border-r border-black flex items-center gap-2" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
                    <Bike size={13} style={{ color: "#BF1E1E" }} /> {b.name}
                  </div>
                  <div className="col-span-3 px-3 py-3 text-xs border-r border-black" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{b.phone}</div>
                  <div className="col-span-3 px-3 py-3 text-xs border-r border-black" style={{ color: "#5A5240" }}>{b.area}</div>
                  <div className="col-span-1 px-3 py-3 text-sm font-bold border-r border-black text-center" style={{ fontFamily: "'DM Mono', monospace" }}>{cnt}</div>
                  <div className="col-span-1 px-3 py-3 flex items-center gap-2">
                    <button onClick={() => openEditBoy(b)} className="hover:text-amber-600 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => delBoy(b.id)} className="hover:text-red-700 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })
          }
        </div>
      </section>

      {/* Newspaper Catalog */}
      <section>
        <div className="border-b-2 border-black mb-4 pb-1 flex items-center justify-between">
          <div className="text-sm font-black tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Newspaper Catalog</div>
          <button onClick={() => setPaperFormTarget("new")} className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 text-xs font-bold tracking-widest uppercase hover:bg-red-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
            <Plus size={11} /> Add Publication
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "#5A5240" }}>Drag rows to reorder. Billing uses actual delivery days × per-issue price for each month.</p>
        <div className="border-t-2 border-l-2 border-black">
          {/* Header */}
          <div className="grid border-b-2 border-r-2 border-black" style={{ gridTemplateColumns: "36px 1fr 180px 80px 100px 60px 80px", backgroundColor: "#111111", color: "#F2ECD9" }}>
            <div className="px-2 py-2 border-r border-white/20" />
            {["Publication","Schedule","Base Price","Est. This Mo.","Subs",""].map((h, i) => (
              <div key={i} className="px-3 py-2 text-xs font-bold tracking-widest uppercase border-r border-white/20 last:border-r-0" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{h}</div>
            ))}
          </div>
          {papers.map((p, idx) => {
            const subs = residents.filter(r => r.paperIds.includes(p.id)).length
            const est = estMonthly(p)
            const hasExceptions = p.priceExceptions.length > 0
            const hasMonthlyOverride = p.monthlyPrices.some(mp => mp.yearMonth === currentYM)
            const isDragOver = overIdx === idx
            return (
              <div key={p.id} draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                className="grid border-b-2 border-r-2 border-black transition-all"
                style={{ gridTemplateColumns: "36px 1fr 180px 80px 100px 60px 80px", backgroundColor: isDragOver ? "#C8BFA8" : idx % 2 === 1 ? "#EDE7D4" : "transparent", borderTopColor: isDragOver ? "#BF1E1E" : "", borderTopWidth: isDragOver ? "3px" : "" }}>
                <div className="px-2 py-3 flex items-center justify-center border-r border-black cursor-grab" style={{ color: "#C8BFA8" }}>
                  <GripVertical size={14} />
                </div>
                <div className="px-3 py-3 border-r border-black">
                  <div className="text-sm font-semibold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{p.name}</div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {hasExceptions && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "#BF1E1E", fontFamily: "'Libre Franklin', sans-serif" }}>
                        <AlertTriangle size={9} /> {p.priceExceptions.length} exception{p.priceExceptions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hasMonthlyOverride && (
                      <span className="text-xs" style={{ color: "#5A5240", fontFamily: "'Libre Franklin', sans-serif" }}>
                        · price override this month
                      </span>
                    )}
                    {p.monthlyPrices.length > 0 && !hasMonthlyOverride && (
                      <span className="text-xs" style={{ color: "#5A5240" }}>· {p.monthlyPrices.length} monthly override{p.monthlyPrices.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <div className="px-3 py-3 text-xs border-r border-black flex items-center" style={{ color: "#5A5240" }}>{scheduleLabel(p)}</div>
                <div className="px-3 py-3 text-sm font-bold border-r border-black flex items-center" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(p.basePrice)}</div>
                <div className="px-3 py-3 text-sm border-r border-black flex items-center" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>{fmt(est)}</div>
                <div className="px-3 py-3 text-sm font-bold border-r border-black flex items-center" style={{ fontFamily: "'DM Mono', monospace" }}>{subs}</div>
                <div className="px-3 py-3 flex items-center gap-2">
                  <button onClick={() => setPaperFormTarget(p)} className="hover:text-amber-600 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => delPaper(p.id)} className="hover:text-red-700 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {paperFormTarget !== null && (
        <PaperFormModal
          initial={paperFormTarget === "new" ? null : paperFormTarget}
          currency={currency}
          onSave={savePaper}
          onClose={() => setPaperFormTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Public site nav ──────────────────────────────────────────────────────────

type PublicPage = "home" | "about" | "contact" | "login"

function PublicNav({ page, setPage }: { page: PublicPage; setPage: (p: PublicPage) => void }) {
  return (
    <header className="border-b-2 border-black sticky top-0 z-50" style={{ backgroundColor: "#F2ECD9" }}>
      <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <button onClick={() => setPage("home")} className="text-xl font-black tracking-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
          PRESS<span style={{ color: "#BF1E1E" }}>TRACK</span>
        </button>
        <nav className="flex items-center gap-1">
          {(["home","about","contact"] as PublicPage[]).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className="px-4 py-1.5 text-xs font-bold tracking-widest uppercase transition-colors"
              style={{ fontFamily: "'Libre Franklin', sans-serif", color: page === p ? "#BF1E1E" : "#5A5240", borderBottom: page === p ? "2px solid #BF1E1E" : "2px solid transparent" }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage("login")}
            className="ml-4 px-5 py-2 bg-black text-white text-xs font-bold tracking-widest uppercase hover:bg-red-700 transition-colors"
            style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
            Sign In
          </button>
        </nav>
      </div>
    </header>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ setPage }: { setPage: (p: PublicPage) => void }) {
  return (
    <div style={{ backgroundColor: "#F2ECD9" }}>
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-black" style={{ minHeight: 480 }}>
        <img
          src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1400&h=600&fit=crop&auto=format"
          alt="Stacked newspapers"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "grayscale(40%) contrast(1.1)" }}
        />
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(17,17,17,0.72)" }} />
        <div className="relative max-w-6xl mx-auto px-8 py-24">
          <div className="text-xs tracking-widest font-bold mb-4" style={{ color: "#BF1E1E", fontFamily: "'DM Mono', monospace" }}>— NEWSPAPER MANAGEMENT PLATFORM —</div>
          <h1 className="text-6xl font-black leading-none mb-6" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#F2ECD9" }}>
            PRESS<span style={{ color: "#BF1E1E" }}>TRACK</span>
          </h1>
          <p className="text-lg max-w-xl mb-8 leading-relaxed" style={{ color: "rgba(242,236,217,0.8)", fontFamily: "'Lora', Georgia, serif" }}>
            End-to-end newspaper delivery management. Track subscriptions, schedule routes, manage billing — all from one calendar-centric dashboard.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPage("login")}
              className="px-6 py-3 bg-red-700 text-white text-xs font-black tracking-widest uppercase hover:bg-red-800 transition-colors"
              style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              Sign In to Dashboard →
            </button>
            <button onClick={() => setPage("about")}
              className="px-6 py-3 border-2 border-white/50 text-white text-xs font-bold tracking-widest uppercase hover:border-white transition-colors"
              style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b-2 border-black">
        <div className="max-w-6xl mx-auto grid grid-cols-3" style={{ borderLeft: "2px solid #111" }}>
          {[
            { icon: "📅", title: "Calendar-Centric", desc: "Visualise every delivery day. See which papers go to which residence at a glance, with payment status per month." },
            { icon: "🧾", title: "Smart Billing", desc: "Bills auto-generate based on actual delivery days, schedule exceptions, and per-month price overrides — no manual arithmetic." },
            { icon: "🚴", title: "Route Management", desc: "Assign delivery boys to residences, set route order, and filter the roster by boy or publication in one click." },
          ].map((f, i) => (
            <div key={i} className="border-r-2 border-b-2 border-black px-8 py-10">
              <div className="text-3xl mb-4">{f.icon}</div>
              <div className="text-sm font-black tracking-wide uppercase mb-3" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{f.title}</div>
              <p className="text-sm leading-relaxed" style={{ color: "#5A5240", fontFamily: "'Lora', Georgia, serif" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b-2 border-black" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-4">
          {[
            { val: "500+", label: "Residences managed" },
            { val: "12+", label: "Publications tracked" },
            { val: "₹2L+", label: "Billed monthly" },
            { val: "99.8%", label: "Delivery accuracy" },
          ].map((s, i) => (
            <div key={i} className="px-8 py-8 border-r border-white/10 last:border-r-0">
              <div className="text-3xl font-black mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "#BF1E1E" }}>{s.val}</div>
              <div className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Libre Franklin', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-8 py-20 text-center">
        <div className="text-3xl font-black mb-4" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Ready to modernise your distribution?</div>
        <p className="text-sm mb-8" style={{ color: "#5A5240" }}>Sign in to your dashboard and start managing deliveries today.</p>
        <button onClick={() => setPage("login")}
          className="px-8 py-3 bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-red-700 transition-colors"
          style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
          Go to Dashboard →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black px-8 py-6 flex items-center justify-between" style={{ backgroundColor: "#EDE7D4" }}>
        <div className="text-sm font-black" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>PRESS<span style={{ color: "#BF1E1E" }}>TRACK</span></div>
        <div className="text-xs" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>© {new Date().getFullYear()} PRESSTRACK DELIVERY SYSTEMS</div>
        <div className="flex gap-4">
          {(["about","contact"] as PublicPage[]).map(p => (
            <button key={p} onClick={() => setPage(p)} className="text-xs uppercase tracking-widest hover:text-red-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{p}</button>
          ))}
        </div>
      </footer>
    </div>
  )
}

// ─── About Page ───────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <div style={{ backgroundColor: "#F2ECD9" }}>
      {/* Banner */}
      <section className="border-b-2 border-black px-8 py-16" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest font-bold mb-3" style={{ color: "#BF1E1E", fontFamily: "'DM Mono', monospace" }}>— WHO WE ARE —</div>
          <h1 className="text-5xl font-black" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#F2ECD9" }}>About PressTrack</h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-3 gap-12">
        {/* Story */}
        <div className="col-span-2">
          <h2 className="text-2xl font-black mb-6" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Our Story</h2>
          <p className="text-base leading-relaxed mb-5" style={{ fontFamily: "'Lora', Georgia, serif", color: "#3A3228" }}>
            PressTrack was born out of a simple frustration: managing newspaper subscriptions across a large residential complex meant juggling hand-written ledgers, loose notebooks, and monthly headaches at billing time. Delivery boys had no clear route order. Residents disputed bills. Special editions fell through the cracks.
          </p>
          <p className="text-base leading-relaxed mb-5" style={{ fontFamily: "'Lora', Georgia, serif", color: "#3A3228" }}>
            We built PressTrack to solve exactly that. A calendar-first interface that makes deliveries visible, intelligent billing that accounts for schedule exceptions and per-month price changes, and a resident management system that keeps every subscription, route, and payment in one place.
          </p>
          <p className="text-base leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif", color: "#3A3228" }}>
            Today PressTrack is trusted by housing societies, apartment complexes, and distribution agents across India to manage hundreds of subscriptions with precision.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-0 border-t-2 border-l-2 border-black">
            {[
              { label: "Founded", val: "2019" },
              { label: "Residences served", val: "500+" },
              { label: "Publications supported", val: "50+" },
              { label: "Cities active", val: "12" },
            ].map((s, i) => (
              <div key={i} className="border-b-2 border-r-2 border-black px-5 py-5">
                <div className="text-2xl font-black mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "#BF1E1E" }}>{s.val}</div>
                <div className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Values sidebar */}
        <div>
          <h2 className="text-lg font-black mb-5" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Our Values</h2>
          {[
            { title: "Accuracy First", body: "Every paise in a bill must be traceable to a delivery day and a price on record." },
            { title: "Delivery-Centric", body: "The delivery boy is the backbone of the operation. We build tools that make their route clear and their work traceable." },
            { title: "Simplicity", body: "Complex billing logic under a straightforward interface. No training required." },
          ].map((v, i) => (
            <div key={i} className="border-l-4 border-black pl-4 mb-6">
              <div className="text-sm font-bold mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{v.title}</div>
              <p className="text-xs leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif", color: "#5A5240" }}>{v.body}</p>
            </div>
          ))}

          <div className="border-2 border-black p-5 mt-6" style={{ backgroundColor: "#EDE7D4" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Team</div>
            {[
              { name: "Arjun Sharma", role: "Founder & Product" },
              { name: "Meera Nair", role: "Engineering Lead" },
              { name: "Raj Gupta", role: "Operations" },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-black last:border-b-0 text-xs">
                <span className="font-semibold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{t.name}</span>
                <span style={{ color: "#5A5240" }}>{t.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Page ─────────────────────────────────────────────────────────────

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" })
  const [sent, setSent] = useState(false)
  const inp = "w-full border border-black px-3 py-2.5 text-sm bg-transparent outline-none focus:border-red-700 transition-colors"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setSent(true)
  }

  return (
    <div style={{ backgroundColor: "#F2ECD9" }}>
      <section className="border-b-2 border-black px-8 py-16" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest font-bold mb-3" style={{ color: "#BF1E1E", fontFamily: "'DM Mono', monospace" }}>— GET IN TOUCH —</div>
          <h1 className="text-5xl font-black" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#F2ECD9" }}>Contact Us</h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-3 gap-12">
        {/* Form */}
        <div className="col-span-2">
          {sent ? (
            <div className="border-2 border-black p-10 text-center" style={{ backgroundColor: "#EDE7D4" }}>
              <div className="text-4xl mb-4">✓</div>
              <div className="text-xl font-black mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Message Sent</div>
              <p className="text-sm" style={{ color: "#5A5240" }}>Thanks, {form.name}. We'll get back to you at {form.email} within 24 hours.</p>
              <button onClick={() => { setSent(false); setForm({ name:"",email:"",phone:"",subject:"",message:"" }) }}
                className="mt-6 px-6 py-2 border-2 border-black text-xs font-bold tracking-widest uppercase hover:bg-black hover:text-white transition-colors"
                style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Send Another</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Full Name *</label>
                  <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" required />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Email Address *</label>
                  <input type="email" className={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Phone</label>
                  <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="98XX-XXXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Subject</label>
                  <select className={inp} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                    <option value="">Select a topic</option>
                    <option>General Enquiry</option>
                    <option>Billing Support</option>
                    <option>Technical Issue</option>
                    <option>Onboarding Help</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Message *</label>
                <textarea className={inp} rows={6} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your query in detail…" required />
              </div>
              <button type="submit" className="px-8 py-3 bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-red-700 transition-colors" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
                Send Message →
              </button>
            </form>
          )}
        </div>

        {/* Info sidebar */}
        <div>
          <h2 className="text-lg font-black mb-5" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Contact Information</h2>
          {[
            { icon: "📍", label: "Address", val: "12 Press Colony, MG Road\nBangalore – 560 001" },
            { icon: "📞", label: "Phone", val: "+91 80 4567 8900" },
            { icon: "📧", label: "Email", val: "support@presstrack.in" },
            { icon: "🕐", label: "Hours", val: "Mon–Sat, 9 AM – 6 PM IST" },
          ].map((c, i) => (
            <div key={i} className="flex gap-3 mb-5 pb-5 border-b border-black last:border-b-0">
              <div className="text-lg flex-shrink-0">{c.icon}</div>
              <div>
                <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>{c.label}</div>
                <div className="text-sm whitespace-pre-line" style={{ fontFamily: "'Lora', Georgia, serif" }}>{c.val}</div>
              </div>
            </div>
          ))}
          <div className="border-2 border-black p-4 mt-4" style={{ backgroundColor: "#EDE7D4" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Response Time</div>
            <p className="text-xs" style={{ color: "#5A5240" }}>We typically respond within <strong>24 hours</strong> on working days. For urgent billing issues, call us directly.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [creds, setCreds] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!creds.username || !creds.password) { setError("Please enter both username and password."); return }
    setLoading(true)
    // Simulate auth delay
    setTimeout(() => {
      if (creds.username === "admin" && creds.password === "presstrack") {
        onLogin()
      } else {
        setError("Invalid credentials. Try admin / presstrack")
        setLoading(false)
      }
    }, 700)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F2ECD9" }}>
      {/* Left panel – branding */}
      <div className="hidden md:flex flex-col justify-between w-96 flex-shrink-0 border-r-2 border-black px-10 py-12" style={{ backgroundColor: "#111111" }}>
        <div>
          <div className="text-2xl font-black mb-2" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#F2ECD9" }}>
            PRESS<span style={{ color: "#BF1E1E" }}>TRACK</span>
          </div>
          <div className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>DELIVERY MANAGER</div>
        </div>
        <div>
          <img
            src="https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=600&h=400&fit=crop&auto=format"
            alt="Morning newspaper delivery"
            className="w-full border-2 border-white/10 mb-8"
            style={{ filter: "grayscale(30%)" }}
          />
          <blockquote className="text-sm leading-relaxed italic" style={{ color: "rgba(242,236,217,0.7)", fontFamily: "'Lora', Georgia, serif" }}>
            "Every delivery tracked, every rupee accounted for, every route optimised."
          </blockquote>
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
          © {new Date().getFullYear()} PRESSTRACK SYSTEMS
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ fontFamily: "'DM Mono', monospace", color: "#BF1E1E" }}>— SIGN IN —</div>
            <h1 className="text-3xl font-black" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>Welcome back</h1>
            <p className="text-sm mt-1" style={{ color: "#5A5240", fontFamily: "'Lora', Georgia, serif" }}>Enter your credentials to access the dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1.5" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Username</label>
              <input
                className="w-full border-2 border-black px-4 py-3 text-sm bg-transparent outline-none focus:border-red-700 transition-colors"
                style={{ fontFamily: "'DM Mono', monospace" }}
                placeholder="admin"
                value={creds.username}
                autoComplete="username"
                onChange={e => setCreds(c => ({ ...c, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1.5" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>Password</label>
              <input
                type="password"
                className="w-full border-2 border-black px-4 py-3 text-sm bg-transparent outline-none focus:border-red-700 transition-colors"
                style={{ fontFamily: "'DM Mono', monospace" }}
                placeholder="••••••••"
                value={creds.password}
                autoComplete="current-password"
                onChange={e => setCreds(c => ({ ...c, password: e.target.value }))}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 border border-red-700 px-3 py-2 text-xs" style={{ color: "#BF1E1E", fontFamily: "'Libre Franklin', sans-serif" }}>
                <AlertTriangle size={12} /> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
              style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-black">
            <p className="text-xs text-center" style={{ color: "#5A5240", fontFamily: "'DM Mono', monospace" }}>
              Demo credentials: <strong>admin</strong> / <strong>presstrack</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard (management app) ───────────────────────────────────────────────

type View = "calendar" | "residents" | "bills" | "settings"

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "calendar", label: "Calendar", icon: <CalendarDays size={15} /> },
  { id: "residents", label: "Residents", icon: <Users size={15} /> },
  { id: "bills", label: "Billing", icon: <ReceiptText size={15} /> },
  { id: "settings", label: "Settings", icon: <Settings size={15} /> },
]

function Dashboard({ onLogout, username }: { onLogout: () => void; username: string }) {
  const [view, setView] = useState<View>("calendar")
  const [papers, setPapers] = useState<Paper[]>(seedPapers)
  const [residents, setResidents] = useState<Resident[]>(seedResidents)
  const [boys, setBoys] = useState<DeliveryBoy[]>(seedDeliveryBoys)
  const [bills, setBills] = useState<Bill[]>([])
  const [currency, setCurrency] = useState("₹")

  const today = new Date()

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F2ECD9", fontFamily: "'Lora', Georgia, serif" }}>
      <aside className="w-52 flex-shrink-0 flex flex-col border-r-2 border-black" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-6 border-b-2 border-white/20">
          <div className="text-white text-lg font-black leading-tight" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>PRESS<span style={{ color: "#BF1E1E" }}>TRACK</span></div>
          <div className="text-xs mt-1 tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>DELIVERY MANAGER</div>
        </div>
        <div className="px-5 py-3 border-b-2 border-white/10 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>{username.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-xs font-bold truncate" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Libre Franklin', sans-serif" }}>{username}</span>
        </div>
        <div className="px-5 py-3 border-b-2 border-white/10">
          <div className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
            {today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase()}
          </div>
        </div>
        <nav className="flex flex-col gap-0 py-2 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              className="flex items-center gap-3 px-5 py-3 text-sm text-left transition-colors"
              style={{ fontFamily: "'Libre Franklin', sans-serif", fontWeight: view === n.id ? 700 : 400, backgroundColor: view === n.id ? "#BF1E1E" : "transparent", color: view === n.id ? "#F2ECD9" : "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}>
              {n.icon} {n.label.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="border-t-2 border-white/10 px-5 py-4">
          <div className="text-xs mb-3 font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Libre Franklin', sans-serif" }}>QUICK STATS</div>
          {[
            { label: "Residents", val: residents.length },
            { label: "Papers", val: papers.length },
            { label: "Delivery Boys", val: boys.length },
            { label: "Bills Due", val: bills.filter(b => !b.paid).length },
          ].map(s => (
            <div key={s.label} className="flex justify-between text-xs mb-1.5">
              <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Libre Franklin', sans-serif" }}>{s.label}</span>
              <span className="font-bold" style={{ color: "#F2ECD9", fontFamily: "'DM Mono', monospace" }}>{s.val}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs">
            <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Libre Franklin', sans-serif" }}>Currency</span>
            <span className="font-bold" style={{ color: "#BF1E1E", fontFamily: "'DM Mono', monospace" }}>{currency}</span>
          </div>
          <button onClick={onLogout}
            className="w-full mt-4 py-2 border border-white/20 text-xs font-bold tracking-widest uppercase hover:bg-red-700 hover:border-red-700 transition-colors"
            style={{ fontFamily: "'Libre Franklin', sans-serif", color: "rgba(255,255,255,0.5)" }}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b-2 border-black px-8 py-4 flex items-center justify-between" style={{ backgroundColor: "#F2ECD9" }}>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Libre Franklin', sans-serif", color: "#5A5240" }}>
            {NAV.find(n => n.id === view)?.label}
          </div>
          <div className="text-xs tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "#5A5240" }}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </header>
        <div className="px-8 py-6" style={{ minHeight: "calc(100vh - 57px)" }}>
          {view === "calendar" && <CalendarView residents={residents} papers={papers} bills={bills} boys={boys} currency={currency} />}
          {view === "residents" && <ResidentsView residents={residents} setResidents={setResidents} papers={papers} boys={boys} currency={currency} />}
          {view === "bills" && <BillsView bills={bills} setBills={setBills} residents={residents} papers={papers} currency={currency} />}
          {view === "settings" && <SettingsView currency={currency} setCurrency={setCurrency} papers={papers} setPapers={setPapers} residents={residents} boys={boys} setBoys={setBoys} />}
        </div>
      </main>
    </div>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [publicPage, setPublicPage] = useState<PublicPage>("home")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState("")

  function handleLogin(user: string) {
    setUsername(user)
    setIsLoggedIn(true)
  }

  function handleLogout() {
    setIsLoggedIn(false)
    setUsername("")
    setPublicPage("home")
  }

  if (isLoggedIn) {
    return <Dashboard onLogout={handleLogout} username={username} />
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F2ECD9", fontFamily: "'Lora', Georgia, serif" }}>
      <PublicNav page={publicPage} setPage={setPublicPage} />
      {publicPage === "home"    && <HomePage setPage={setPublicPage} />}
      {publicPage === "about"   && <AboutPage />}
      {publicPage === "contact" && <ContactPage />}
      {publicPage === "login"   && <LoginPage onLogin={() => handleLogin("admin")} />}
    </div>
  )
}
