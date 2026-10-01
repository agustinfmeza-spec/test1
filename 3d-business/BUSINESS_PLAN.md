# X2D Print Venture — Business Case & Living Growth Plan (v2)
*Agus · Rawspeed (automotive photo/cinema) · UTN-FRBA Mecánica · SGS Argentina · Buenos Aires*
*Built on your `x2d_print_venture_context.md` and Growth & Marketing dashboard. v1 (USD placeholders) is superseded.*

---

## 0. Verdict in five lines
1. **The cuota is not the risk.** Your free cash before the printer is ≈ ARS 1,402,257/mo; after the 9 × 395,000 cuota you keep ≈ **ARS 1,007,257/mo with zero business income** (≈ 1,086,552 from month 7 once the Hilux tire cuota ends in ~Apr-27; ≈ 1,481,552 after the last cuota). This is an *opportunity* play, not a *necessity* one.
2. **Your own ramp is credible but slightly rosy.** After adding costs your sheet leaves out (failed prints, nozzle/plate wear, payment fees), the same ramp gives **≈ ARS 203k/mo net at month 7+ (not 245k)**, **~31% of the financing covered by the business over 9 months (not 38%)**, and CAPEX payback at **~month 21 (not ~18)**.
3. **The real constraint is your time and demand**, not money or machine hours: 15 jobs/mo is ~11 h/month of post-processing — tiny. The upside is in widening the funnel (photo accessories + UTN), not in printing more hours.
4. **Moat:** nobody local visibly sells *structural, carbon-fiber-reinforced* parts (Erexit, CNCero etc. are generic PLA/PETG/ABS/nylon), and *you* can film the part on a real car. Tier C (PA6-CF) is 53% of volume by month 7 and ~70% of margin — **protect that mix**.
5. **Biggest early actions:** pre-sell 6–8 jobs through Rawspeed contacts, and fix the Tier C unit economics with real prints in the first 30 days.

---

## 1. Machine fit (what the X2D can and can't do)
From your research: 256×256×260 mm, 300 °C nozzle, **active chamber 65 °C**, dual nozzle with limited dual-material/support capability.

| Capability | Status |
|---|---|
| PLA, PETG, ASA/ABS, TPU | ✅ core |
| PA6-CF / PAHT-CF / PA6-GF | ✅ with hardened nozzle, dry filament (dry-box/AMS drying) |
| **Support for PA/PET** (breakaway) and **Support for ABS** (limonene-soluble) via 2nd nozzle | ✅ use for undercuts you can't design out |
| PLA as support for engineering materials | ❌ invalid (bed & 65 °C chamber exceed PLA's Tg) |
| PC/PC-CF, PPS-CF (H-series territory) | ❌ out of scope — **don't quote parts above PAHT-CF's ~180–200 °C HDT** (e.g. directly on turbo/exhaust) |

**Process rule:** orient and design with heat-set inserts to avoid supports; use the proper support filament only when geometry demands it.
**Confirmed:** the 9 cuotas via Laboratorio3D are interest-free; first cuota is paid in week 1 of Nov-26 (model start month).

---

## 2. Unit economics — your tiers (ARS, context doc §5.2)
| Tier | Material | Cost | Price | Gross margin | Examples |
|---|---|---|---|---|---|
| **A — Consumer/desk** | PLA/PETG | 1,260 | 6,000 | 4,740 (79%) | camera accessories, headset/desk mounts, organizers, cold-shoe kits, film-scan holders |
| **B — Functional/exterior** | ASA/PETG | 3,420 | 15,000 | 11,580 (77%) | trim covers, clips, phone mounts, light brackets for photo gear, enclosures |
| **C — Structural/engineering** | PA6-CF + PA/PET support | 11,330 | 35,000 | 23,670 (68%) | mate mount/extensions, aux-light brackets, motor-bay cable management, camera handles/grips, UTN/SGS tooling |

**Costs your sheet leaves out (v2 adds them):** failed prints 8% of material · nozzle/plate/dryer wear 3% of revenue · payment/platform fees 3% · early-job discounts ~5% (your revenue figures already imply 4–7%). Post-processing time (0.25 / 0.5 / 1 h per A/B/C job at ~ARS 1,000/h) is shown as *opportunity cost*, not cash. Monotributo is not needed (confirmed), so it is set to 0.

**Data reconciliation:** your M3-4, M5-6, M7-9 revenue totals are ~4.5–6.7% below the tier math (133k/253k/358k vs 127k/238k/334k). I treat that as the discount factor. If it isn't, the model is slightly conservative.

---

## 3. Financial projection (`model.py`, ARS, constant pesos)
| Scenario | Jobs/mo at M9 | Net margin/mo (M7+) | Business covers cuotas M1-9 | CAPEX recovered by margin |
|---|---|---|---|---|
| Conservative (0.5× your ramp) | 8 | ≈ 101k | ~16% cumulative by M9 | 41% at M18 |
| **Base (your ramp, costs added)** | 15 | ≈ **203k** | ~31% by M9 | **83% at M18 → ~M21** |
| Base + photo/UTN layers (hypothesis) | 31 | ≈ 290k | ~42% by M9 | 100% at **M17** |

Base case month by month: M1-2 net 27k · M3-4 79k · M5-6 146k · M7-9 203k (vs cuota 395k). Net cash from the business never exceeds the cuota during financing — **your salary carries the cuota; the business pays the printer back over ~18–21 months.** That's fine, and consistent with your own conclusion.

**What moves the number most (in order):** (1) Tier C share of mix · (2) Tier C price vs real cost (verify with first 3 prints) · (3) number of repeat/referral jobs · (4) adding photo/UTN volume · (5) trimming failure rate. Prices are nominal; with ~2–3% monthly inflation and a fixed cuota, indexing prices monthly improves payback (set `infl_monthly` in `model.py`).

**Levers beyond the plan (hypotheses to test, not facts):**
- **Photo/cine accessories for Rawspeed's circle** — rig plates, car-mount adapters, light-stand brackets, handles. Sold in batches at Tier A/B; doubles as content. Model assumes +6→+12 Tier A jobs/mo from M3.
- **UTN student/team jobs** (project enclosures, mechanisms, team prototypes) — model assumes +2→+4 Tier B jobs/mo from M5; ask the Secretaría de Extensión about supplier terms **(VERIFY)**.
- **Hilux SW4 as showcase vehicle** (co-owned — ask Adriana/Sergio; expected to be fine): real-world heat/vibration test bed for Tier C parts and content.

---

## 4. Growth roadmap (ever-growing, 9-month ramp + beyond)
| Phase | When | Goals | KPIs |
|---|---|---|---|
| **0 – Setup** | Before printer arrives | Confirm cuota terms; Rawspeed catalog of 6–9 hero parts (3 per tier); mock-up photos/video; WhatsApp Business + QR quote card; list 20 contacts from track days/meets | 6–8 pre-orders |
| **1 – Proof** (M1-2) | Nov–Dec 26 | 4 jobs/mo (2 A, 2 B) at discount to real contacts; film every print + install; calibrate PA6-CF drying/settings | Tier C test parts on 2 cars; cost-per-job logged |
| **2 – Engineering offer** (M3-4) | Jan–Feb 27 | 8 jobs/mo incl. first Tier C; first "structural parts" content series; join 3 community groups | 2 Tier C jobs/mo; first referrals |
| **3 – Niche ownership** (M5-6) | Mar–Apr 27 | 12 jobs/mo, Tier C = 5; poly-industry outreach starts (2 warm talks/mo via SGS/UTN) | 4–6% IG engagement; 3 repeat customers |
| **4 – Steady state** (M7-9) | May–Jul 27 | 15 jobs/mo (3A/4B/8C); raise Tier C prices if waitlist > 1 week; last cuota in Jul-27 | ≥ 200k net/mo; failure < 8% |
| **5 – Reinvest** (M10+) | Aug 27→ | Cuota ends (+395k/mo cash). Options: 2nd printer only if utilization >85% for 2 months; resin/scanner for reverse engineering; own-design product line; sell STL licenses | CAPEX 50% recovered by M12 (base) |

**Monthly loop:** log jobs → compare with `kpi_tracker.csv` → drop bottom-20% SKUs → add 2 SKUs → film 1 case study → update prices/FX.

**Channels (your targets):** Instagram via @rawspeed.ph (2–3 posts/wk, 4–6% engagement) · 3 WhatsApp/Telegram car groups (1 showcase/mo) · 1–2 track days/meets monthly with sample parts + QR (3–5 conversations each) · SGS/UTN outreach from M5 (2 warm talks/mo).

---

## 5. Materials by use case
| Part | Material | Why |
|---|---|---|
| Mate mount/extension, camera handles/grips | PA6-CF | Cantilever load, vibration, repeated torque |
| Engine-bay cable management | PA6-CF / PAHT-CF near turbo | Sustained under-hood heat |
| Aux-light brackets | PA6-CF (clear-coated) or ASA | Vibration vs UV |
| Exterior trim covers, vent/switch blanks, key-fob shells | ASA | UV + heat inside cabin (PLA fails ~55 °C) |
| Photo accessories (cold-shoe, flash grids, film holders) | PETG; PA6-CF if clamped/load-bearing | Don't over-specify |
| Gaskets, bumpers, lens-hood protectors | TPU 95A | Flexibility |
| Desk organizers, pouches, headset mounts | PLA/PETG | No engineering case |
| Complex geometry in engineering materials | + Support for PA/PET or ABS | Breakaway / limonene-soluble |

**Guardrails:** no safety-critical parts (brakes, steering, seatbelts, airbags, structural chassis); no brand logos/trademarks — own design or "compatible with"; add a "uso bajo responsabilidad del usuario" notice; test and photograph every Tier C part before delivery; keep job records.

---

## 6. Weekly scheduler (SGS job + UTN nights + Rawspeed shoots)
The printer works while you don't — batch every task into fixed slots.

| Day | Morning (pre-SGS) | Evening | Notes |
|---|---|---|---|
| Mon | Load long PA6-CF/ASA print | UTN | Check remotely only |
| Tue | Unload, post-process 20 min, load batch | UTN | Overnight print |
| Wed | Quote replies (15 min) | UTN | Edit one clip for IG (30 min) |
| Thu | Unload/load | UTN | WhatsApp group post if scheduled |
| Fri | Pack & ship orders | Light: CAD 1–2 h | Overnight batch |
| Sat | **CAD/design block 3–4 h** + shoot/film new parts | Meet/track day (1–2×/mo) | Deliver parts |
| Sun | Maintenance: dry filament, plate, nozzle check (30 min) | **Weekly review 30 min** | Queue Monday |

Time budget at 15 jobs/mo: ~11 h post-processing + ~6 h/week design/content/admin. Rules: max 2 custom quotes/day, 3–5 business-day turnaround, no promises during exam weeks (pre-print stock first). Put each cuota amount in a separate Mercado Pago "reserva" at payday.

---

## 7. Cuota tracker (fill monthly; also `kpi_tracker.csv`)
| # | Month | Cuota | Business net (target base) | Actual jobs | Actual net | Cuota paid from |
|---|---|---|---|---|---|---|
| 1 | Nov-26 | 395,000 | 27k | | | salary |
| 2 | Dec-26 | 395,000 | 27k | | | salary |
| 3 | Jan-27 | 395,000 | 79k | | | |
| 4 | Feb-27 | 395,000 | 79k | | | |
| 5 | Mar-27 | 395,000 | 146k | | | |
| 6 | Apr-27 | 395,000 | 146k | | | |
| 7 | May-27 | 395,000 | 203k | | | |
| 8 | Jun-27 | 395,000 | 203k | | | |
| 9 | Jul-27 | 395,000 | 203k | | | |

---

## 8. Risks & open assumptions
| Risk / assumption | Mitigation |
|---|---|
| Tier prices untested vs customers | First 6 jobs = price test; log wins/losses |
| Tier C failure/wear underestimated | Track grams used vs sliced estimate; reserve 3% revenue for wear parts |
| Demand depends on active marketing | Content cadence fixed in scheduler; Rawspeed network first |
| Liability on car parts | Non-safety only; disclaimer; test + record |
| Peso inflation | Index prices monthly; fixed cuota erodes in real terms |
| Burnout (job + UTN + Rawspeed) | Capacity cap, fixed slots, exam-week blackout |
| Post-processing not costed | Track real hours for 60 days; update `post_hours` |

---

## 9. Files
- `model.py` — edit assumptions, run `python3 model.py` (prints reconciliation + scenarios, writes `schedule_*.csv`, `kpi_tracker.csv`).
- `kpi_tracker.csv` — open in Sheets; fill the "actual" columns monthly.
