# Taller 3D Buenos Aires — Business Case & Living Growth Plan
*Bambu Lab X2D Combo · side hustle · automotive + photography + UTN network*

> **Read this first — what I assumed.** I could not open the shared chat (the link returned only Anthropic's site footer), so this plan uses assumptions you should correct. Anything marked **(VERIFY)** is a number or fact I'm not certain of.
> - Purchase: 9 cuotas × ARS 395,000 = **ARS 3,555,000** (your "~3.6M"). Start **Nov 2026**.
> - FX used for pricing: **ARS 1,500/USD** (placeholder). Change it in `model.py` monthly.
> - You work a day job + UTN classes at night → **~200 productive print-hours/month** is the cap, not 24/7.
> - Marketing comes from your photography (content is free; your time is the cost).
> - Printer specs: X2D is Bambu's enclosed, dual-nozzle line. **(VERIFY)** exact build volume, max nozzle/chamber temps and which materials are officially supported before promising customers anything (esp. PA-CF / PC).

---

## 1. The business in one paragraph
A **micro-manufacturer of small, high-fit, low-volume parts** that nobody in Buenos Aires stocks: (a) camera/photo accessories you understand better than most makers, (b) model-specific interior/trim/accessory parts for Argentine-market cars (incl. discontinued classics), and (c) rapid prototyping/short-run parts for UTN students, teams and small workshops. The edge: you design for fit, you photograph the product well, and you have a built-in distribution network (classmates, professors, car groups, photo community).

**Rule #1 — the printer must pay for itself:** the cuota is **≈ USD 263/month**. Break-even needs only **~21 orders/month at ~USD 15 contribution each** — about 5 a week. Everything in Phase 1 is designed to hit that number by month 2–3.

---

## 2. Unit economics (why it works)
Filament is cheap relative to price; the real constraints are **your time and demand**, not material.

| Item | Assumption |
|---|---|
| Filament USD/kg | PLA ~20 · PETG ~22 · ASA ~30 · TPU ~30 · PA-CF ~70 **(VERIFY local prices)** |
| Failed-print waste | 8% |
| Wear + power | ~USD 0.18 per print-hour |
| Packaging | 4% of revenue |
| Fees | Direct (Instagram/WhatsApp + Mercado Pago transfer) ~3% · Mercado Libre ~18% blended |
| Monotributo | ARS 45,000/mo **(VERIFY current ARCA table & category limits)** |
| Ads | USD 10 → 60/mo |

Channel averages: **Photo** ticket $18 / 1.8 h · **Auto** $30 / 3 h · **B2B-UTN** $60 / 5 h.

**Pricing formula:** `price = max( materials×3 + print-hours×USD 4 + design-time share , market comparable −10% )`. Price in **USD-linked ARS** and re-index monthly — your cuota is fixed in nominal ARS, so inflation *helps* you if prices follow FX/CPI.

---

## 3. Financial projection (from `model.py`, USD)
Three scenarios (orders ×0.6 / ×1.0 / ×1.4), capped at 200 print-hours/month.

| | Conservative | **Base** | Optimistic |
|---|---|---|---|
| Profit covers cuota from | month 3 | **month 2** | month 2 |
| Cumulative cash ≥ 0 (cuotas + starter stock recovered) | month 6 | **month 4** | month 3 |
| Month-12 revenue | ~1,590 | **~2,095 (capacity-capped)** | ~2,095 |
| Month-12 net before owner pay | ~1,150 | **~1,545** | ~1,545 |
| Cumulative cash end of month 12 | ~4,700 | **~9,400** | ~11,600 |

**Base case, first 9 months (the reimbursement of each cuota):**

| M | Revenue | Net pre-cuota | Cuota | Net after cuota | Cum. cash | Print-h (util.) |
|--|--|--|--|--|--|--|
| 1 | 264 | 166 | 263 | −97 | −447 | 25 (13%) |
| 2 | 486 | 335 | 263 | +72 | −375 | 47 (23%) |
| 3 | 708 | 504 | 263 | +240 | −135 | 68 (34%) |
| 4 | 924 | 662 | 263 | +399 | +264 | 88 (44%) |
| 6 | 1,356 | 989 | 263 | +726 | +1,557 | 130 (65%) |
| 9 | 2,004 | 1,484 | 263 | +1,221 | +4,724 | 191 (96%) |

**Honest caveats**
- Numbers exclude your time (~10–15 h/week) and taxes beyond monotributo. They are a *plan*, not a forecast. **Demand is the only big unknown**; the conservative case (0.6×) still repays everything by month 6.
- Months 1–2 will likely need ~USD 450 of your own cash to cover cuotas + starter stock. Don't treat early profit as guaranteed — pre-sell to make it real (Phase 0).
- Base case hits **capacity at month ~9–10** → that is the signal to raise prices ~15% or buy printer #2 (use profit, not another loan).
- **Stress test:** if sales are only 25% of base, you need to top up ≈ USD 150–200/month from salary for 9 months. Decide now whether you accept that worst case.

---

## 4. Product catalog by material
Design for **small, fit-critical, hard-to-find** parts. Margins are best where the buyer can't just print it (no printer) or can't design it.

### Photography accessories (start here — your credibility + free content)
| Product | Material | Price (USD) | Notes |
|---|---|---|---|
| Cold-shoe/arm/mount kits | PETG | 12 | Batch plates of 10–20 |
| 35mm / 120 film-scanning holders (matched to common scanners/copy stands) | PLA→PETG | 18 | Film revival is strong; high perceived value |
| Flash grids, snoots, gel holders for Godox/Yongnuo-style flashes | PETG | 15 | Sells with your own portfolio shots |
| Custom lens hoods/lens-cap holders/rear caps for legacy lenses | ASA/PETG | 14 | Vintage-lens adapters niche |
| Arca-type plates / L-brackets / cage clamps | PETG; **PA-CF for load-bearing** | 25 | Test load, state limits |
| Product-photo turntable parts, macro rails, small stands | PLA/PETG | 20–40 | Sells to ecommerce sellers |
| TPU lens-hood/bumper/strap-lug protectors | TPU 95A | 10 | |

### Automotive (Phase 2 main growth engine)
| Product | Material | Price (USD) | Notes |
|---|---|---|---|
| Interior trim-clip & retainer kits (by model) | ASA/PETG | 10 | High volume, low risk, repeat buyers |
| Model-specific phone mounts (vent/dash) | ASA | 22 | Search "soporte [modelo]" on ML — fit beats generic |
| Vent/blank/switch-hole covers, button caps, ashtray/console organizers | ASA | 15–45 | Dual-nozzle/AMS → two-tone finish |
| Classic-car knobs, bezels, dash trims (Fiat 128, R12, Falcon, Torino, Peugeot 504-type classics) **(pick models via owner clubs)** | ASA/ABS | 35 | Restoration community pays for discontinued trim |
| Gauge pods, plate frames, key-fob shells, custom badges | ASA / PETG | 20–45 | Multi-color badges are an easy upsell |
| Engine-bay brackets, air-duct clips, heat-exposed holders | **PA-CF / PAHT-CF / PC** only | 40+ | Only if the machine's verified supports it; test thermally |
| Reverse-engineered one-off replacement parts | ASA/PA-CF | quote | Design fee + print |

**Safety/legal guardrails:** don't print safety-critical parts (brake, steering, seatbelt, airbag, structural). Don't copy brand logos/trademarked emblems — produce your own design or "compatible with" labeling. Add a short "uso bajo responsabilidad del usuario / no apto para componentes de seguridad" notice.

### UTN & B2B
- **Student projects**: thesis models, enclosures for electronics (Electrónica/Electromecánica), mechanisms (Mecánica), jigs and fixtures.
- **Student racing/engineering teams** (Formula SAE/Baja-type; **VERIFY which exist at your faculty**): brackets, ducts, sensor mounts, dashboard housings, prototypes before machining — offer sponsor-style pricing + logo on their car (photography included!).
- **Professors/labs**: teaching models, fixtures; ask the Secretaría de Extensión / incubator about an official supplier arrangement **(VERIFY)**.
- **Small workshops/mecánicos/tuners**: custom tools, organizers, replacement trim.

### Material cheat-sheet
| Material | Use | Careful with |
|---|---|---|
| PLA/PLA+ | Prototypes, photo accessories, indoor | Soft in a hot car (~55 °C) — never for dashboard use |
| PETG | General functional, cold shoes, covers | Stringing; moderate heat |
| ASA/ABS | **Interior/exterior car parts**, UV & heat | Needs enclosure (X2D has one); fumes → ventilation |
| TPU 95A | Gaskets, bumpers, grips | Slower; AMS use varies |
| PA-CF / PAHT-CF / PA6-GF | Brackets, load-bearing, higher heat | Must be dry; abrasive → hardened nozzle |
| PC / PC-CF | Highest heat/strength | Hard to print; **(VERIFY)** support |
| PVA / support | Complex geometry | Costly; use sparingly |

---

## 5. Growth schedule (ever-growing roadmap)
**Phase 0 — Before the printer arrives (Oct–Nov 2026)**
1. Register Monotributo; open Mercado Pago business profile; decide brand name + Instagram handle (@yourbrand.3d).
2. Pick **3 hero products per channel**; design/test them (you can order a few test parts or use a friend's printer).
3. Shoot product mockups & behind-the-scenes content with your camera; build a one-page catalog (Tiendanube/Linktree + WhatsApp Business).
4. **Pre-sell**: post "preventa" in UTN groups, photography communities, and 2–3 car clubs. Goal: **10 pre-orders** to cover cuota #1.
5. Open a simple spreadsheet (use `model.py` outputs): orders, hours, material, cash.

**Phase 1 — "Pay the printer" (Months 1–3)**
- Focus: photo accessories + auto clips/phone mounts. Sell direct via Instagram/WhatsApp; list top 5 on Mercado Libre.
- KPIs: ≥ 21 orders/month by M3; cuota covered by profit; failed prints < 8%.
- Content cadence: 3 Reels/week + 1 portfolio post.

**Phase 2 — Niche & trust (Months 4–6)**
- Own one car niche (e.g., one classic model or a popular local model, like one popular Argentine hatchback) with a full catalog of fit parts; join owner groups.
- Launch UTN service: price list, 48h quote, turnaround. Sponsor one student team.
- Add dual-color/dual-material premium line; collect reviews.

**Phase 3 — Systemize (Months 7–9)**
- Standard SKUs with saved slicer profiles, stock of best-sellers (make-to-stock for top 10).
- Raise prices ~10–15% where you're sold-out; keep a waiting list.
- Open Mercado Libre Pro/Shops, B2B price tier, referral code for students.

**Phase 4 — Reinvest (Months 10–12 and beyond)**
- Cuotas finished → ~USD 260/month freed up.
- Decide: **printer #2** (a cheaper single-material machine for PLA/PETG volume) *only if* utilization > 85% for 2 months, **or** a resin printer/3D scanner for detail/reverse engineering, **or** build a small CNC/vacuum-cast accessory line.
- Move toward product *families* (your own design line) instead of one-off jobs; consider a Thingiverse/Printables/Cults revenue stream for STL sales (zero marginal cost).

**Growth loop (repeat monthly):** review sales → kill bottom 20% SKUs → double down on top 20% → add 2 new SKUs → update FX/prices → shoot new content.

---

## 6. Weekly scheduler (job + night classes)
The printer works while you don't. Load it before leaving and when you're back; batch every task type to a fixed slot.

| Day | Morning (before work) | Evening | Night / notes |
|---|---|---|---|
| Mon | Start long print (8–10h) | Classes (UTN) | Remote-check, **no** new work |
| Tue | Remove parts, load 2nd batch | Classes | Overnight print |
| Wed | Post-process 30 min | Classes | Content editing (30 min) |
| Thu | Load batch | Classes | Reply to inquiries |
| Fri | Remove parts, pack orders | Light evening: design 1–2 h | Overnight batch |
| Sat | **Design/CAD block (3–4 h)** + photo shoot of new products | Dispatch orders (Correo/Andreani/moto-mensajería) | |
| Sun | Maintenance (nozzle/plate/drying) 30 min; plan week | **Weekly review (30 min)** | Queue Monday prints |

Capacity math: ~200 print-h/month ≈ 6–7 h/day average, comfortably achievable with overnight + all-day weekday runs. Time cost ≈ 10–15 h/week.

**Rules to protect your studies/job:** ≤ 2 custom quotes per day; "turnaround 3–5 días hábiles"; no promises during exam weeks (block 2 weeks each cuatrimestre; pre-print stock before).

---

## 7. Cuota-by-cuota reimbursement tracker
Fill the **Actual** columns each month. Target = cuota (ARS 395,000) + opex + material.

| # | Month | Cuota (ARS) | ≈ USD @1500 | Min. orders needed | Actual orders | Actual net (ARS) | Covered? |
|---|---|---|---|---|---|---|---|
| 1 | Nov-26 | 395,000 | 263 | 21 (pre-sales) | | | |
| 2 | Dec-26 | 395,000 | 263 | 21 | | | |
| 3 | Jan-27 | 395,000 | 263 | 21 | | | |
| 4 | Feb-27 | 395,000 | 263 | 21 | | | |
| 5 | Mar-27 | 395,000 | 263 | 21 | | | |
| 6 | Apr-27 | 395,000 | 263 | 21 | | | |
| 7 | May-27 | 395,000 | 263 | 21 | | | |
| 8 | Jun-27 | 395,000 | 263 | 21 | | | |
| 9 | Jul-27 | 395,000 | 263 | 21 | | | |

Tip: transfer the cuota amount into a separate Mercado Pago "reserva" account the day you get paid, so the cuota is never at risk from spending on filament.

---

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Demand slower than plan | Pre-sell; B2B-UTN has the highest ticket; cap ads |
| Peso volatility | USD-linked pricing, monthly re-index |
| Customs/filament price swings | Keep 1–2 months of stock of the 3 best sellers' materials |
| Liability for car parts | Non-safety only, disclaimers, test heat/UV, keep records |
| Burnout | Fixed schedule above, capacity cap |
| Copyright/trademark | Own designs; no brand logos |
| Printer failure/warranty | Keep invoice; maintenance Sunday routine; spare nozzle |

---

## 9. How to use this "living system"
- `model.py` — edit assumptions at the top, run `python3 model.py`; it rewrites `schedule_*.csv` for conservative/base/optimistic.
- Each month: update FX, actual orders, actual material cost; compare to base case; adjust Phase tasks.
- Next steps I can build if useful: a printable catalog/price sheet, a Notion/Sheets tracker, an Instagram 30-day content calendar, or a model that accepts your real quotes.
