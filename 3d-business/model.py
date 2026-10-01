"""X2D Print Venture — ARS financial model (constant pesos, no inflation unless set).
Edit ASSUMPTIONS, run `python3 model.py`. Writes schedule_<scenario>.csv + kpi_tracker.csv, prints markdown."""
import csv

A = dict(
    cuota=395_000, n_cuotas=9, start="2026-11",         # start month: VERIFY vs shipping date
    capex=3_555_000,
    free_cash_pre_cuota=1_402_257,                       # from context doc §3.3
    tire_net_cost=79_295, tire_ends_month=6,             # Hilux tire cuota ends ~Apr-27 -> frees cash from M7
    early_discount=0.05,                                 # blended discounts on first jobs/referrals (their sheet implies ~4-7%)
    waste=0.08,                                          # failed prints, % of material cost
    wear=0.03,                                           # hardened nozzle/plates/dryer reserve, % of revenue
    fee=0.03,                                            # payments/platform blended (direct sales ~0-3%)
    monotributo=0,                                       # VERIFY: Rawspeed's existing monotributo may already cover this
    post_hours={"A": 0.25, "B": 0.5, "C": 1.0}, labor_rate=1_000,   # opportunity cost, NOT cash
    infl_monthly=0.0,                                    # price/cost indexation; cuota is fixed in nominal ARS
)
TIER = {"A": (6_000, 1_260), "B": (15_000, 3_420), "C": (35_000, 11_330)}   # (price, cost) from context doc §5.2

def mix(m):  # jobs per tier for month m (1-based) — their ramp, plateau after M9
    if m <= 2: return dict(A=2, B=2, C=0)
    if m <= 4: return dict(A=3, B=3, C=2)
    if m <= 6: return dict(A=3, B=4, C=5)
    return dict(A=3, B=4, C=8)

def layers(m):  # UPSIDE hypotheses not in their plan: photo accessories batches + UTN student jobs
    a = 0 if m < 3 else min(12, 6 + (m - 3))
    b = 0 if m < 5 else min(4, 2 + (m - 5) // 2)
    return dict(A=a, B=b, C=0)

SCEN = {"conservative (0.5x)": (0.5, False), "base (your ramp)": (1.0, False), "base + photo/UTN layers": (1.0, True)}

def run(mult, add_layers, months=18):
    rows, cum_margin, cum_cash = [], 0.0, 0.0
    for m in range(1, months + 1):
        jobs = {t: n * mult for t, n in mix(m).items()}
        if add_layers:
            for t, n in layers(m).items(): jobs[t] += n
        idx = (1 + A["infl_monthly"]) ** (m - 1)
        rev = sum(n * TIER[t][0] for t, n in jobs.items()) * (1 - A["early_discount"]) * idx
        mat = sum(n * TIER[t][1] for t, n in jobs.items()) * idx
        gross = rev - mat
        extra = mat * A["waste"] + rev * (A["wear"] + A["fee"]) + A["monotributo"]
        net = gross - extra
        hrs = sum(n * A["post_hours"][t] for t, n in jobs.items())
        cuota = A["cuota"] if m <= A["n_cuotas"] else 0
        free = A["free_cash_pre_cuota"] + (A["tire_net_cost"] if m > A["tire_ends_month"] else 0)
        personal_buffer = free - cuota                      # without business income
        cum_margin += net
        cum_cash += net - cuota
        rows.append(dict(month=m, jobs=round(sum(jobs.values()), 1), revenue=rev, net_margin=net,
                         cuota=cuota, business_minus_cuota=net - cuota,
                         buffer_without_business=personal_buffer, buffer_with_business=personal_buffer + net,
                         capex_recovered_pct=cum_margin / A["capex"] * 100, postproc_hours=hrs,
                         postproc_opportunity_cost=hrs * A["labor_rate"]))
    return rows

if __name__ == "__main__":
    print("Reconciliation of your sheet's stated ramp vs. tier math (price - cost, no discount):")
    for lbl, m, stated_rev, stated_mar in [("M1-2", 1, 42_000, 32_640), ("M3-4", 3, 127_000, 95_140),
                                           ("M5-6", 5, 238_000, 175_990), ("M7-9", 7, 334_000, 245_260)]:
        j = mix(m); r = sum(n * TIER[t][0] for t, n in j.items()); g = sum(n * (TIER[t][0] - TIER[t][1]) for t, n in j.items())
        print(f"  {lbl}: tier math rev {r:,} / margin {g:,}  vs stated {stated_rev:,} / {stated_mar:,}")
    print()
    for name, (mult, lay) in SCEN.items():
        rows = run(mult, lay)
        fn = "schedule_" + name.split(" (")[0].replace(" + ", "_").replace(" ", "_").replace("/", "_") + ".csv"
        with open(fn, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader()
            for r in rows: w.writerow({k: round(v, 1) for k, v in r.items()})
        pay = next((r["month"] for r in rows if r["capex_recovered_pct"] >= 100), None)
        print(f"## {name}  -> CAPEX recovered by business margin at month: {pay or '>18'}  [{fn}]")
        print("| M | Jobs | Revenue | Net margin | Cuota | Biz - cuota | Buffer w/o biz | CAPEX rec. | Post-proc h |")
        print("|--|--|--|--|--|--|--|--|--|")
        for r in rows:
            if r["month"] in (1, 2, 3, 4, 6, 9, 10, 12, 15, 18):
                print(f"| {r['month']} | {r['jobs']:.0f} | {r['revenue']:,.0f} | {r['net_margin']:,.0f} | {r['cuota']:,.0f} | {r['business_minus_cuota']:,.0f} | {r['buffer_without_business']:,.0f} | {r['capex_recovered_pct']:.0f}% | {r['postproc_hours']:.1f} |")
        print()
    with open("kpi_tracker.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["month", "calendar", "jobs_target", "mix_A/B/C", "revenue_target", "margin_target", "cum_capex_%_target", "jobs_actual", "revenue_actual", "margin_actual", "postproc_hours_actual", "notes"])
        rows = run(1.0, False); y, mo = map(int, A["start"].split("-"))
        for r in rows[:12]:
            mm = (mo - 1 + r["month"] - 1) % 12 + 1; yy = y + (mo - 1 + r["month"] - 1) // 12
            j = mix(r["month"])
            w.writerow([r["month"], f"{yy}-{mm:02d}", round(r["jobs"]), f"{j['A']}/{j['B']}/{j['C']}", round(r["revenue"]), round(r["net_margin"]), round(r["capex_recovered_pct"]), "", "", "", "", ""])
