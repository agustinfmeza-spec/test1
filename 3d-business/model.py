"""Financial model for the X2D side-hustle. Edit ASSUMPTIONS, run `python3 model.py`.
Outputs: schedule.csv (monthly) and a markdown summary on stdout.
All money in USD unless suffixed _ars; ARS converted at FX (assumed, update monthly)."""
import csv

A = dict(
    fx=1500,                 # ARS per USD used to price (ASSUMPTION - update)
    cuota_ars=395_000, n_cuotas=9,
    start="2026-11",
    starter_stock_usd=350,   # filament, tools, packaging bought before month 1
    monotributo_ars=45_000,  # monthly (ASSUMPTION - check ARCA/AFIP current table)
    packaging_pct=0.04, fail_rate=0.08, wear_usd_per_hr=0.15, power_usd_per_hr=0.03,
    fee={"direct": 0.03, "marketplace": 0.18},   # IG/WhatsApp+MP transfer vs Mercado Libre
    capacity_hrs=200,        # realistic print hours/month for a side hustle (job + night classes)
    owner_draw_pct=0.0,      # reinvest everything until cuotas are covered
)

# channel: avg ticket USD, filament USD/order, print hrs/order, share sold via marketplace
CH = {
    "photo": dict(ticket=18, mat=1.2, hrs=1.8, mkt=0.5),
    "auto":  dict(ticket=30, mat=2.6, hrs=3.0, mkt=0.5),
    "b2b_utn": dict(ticket=60, mat=3.0, hrs=5.0, mkt=0.0),   # students/teams/small shops
}
# orders per month, months 1..12 (A = base). Conservative = x0.6, optimistic = x1.4
BASE = {
    "photo":   [8, 12, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34],
    "auto":    [2,  5,  8, 12, 16, 20, 24, 28, 32, 36, 40, 44],
    "b2b_utn": [1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12],
}
SCEN = {"conservative": 0.6, "base": 1.0, "optimistic": 1.4}
ADS = [10, 15, 20, 30, 30, 40, 40, 50, 50, 50, 60, 60]  # USD/month marketing (photo content is free)

def run(mult):
    cuota = A["cuota_ars"] / A["fx"]
    mono = A["monotributo_ars"] / A["fx"]
    cash = -A["starter_stock_usd"]
    rows = []
    for m in range(12):
        rev = cogs = fees = hrs = 0.0
        want = sum(BASE[k][m] * mult * c["hrs"] for k, c in CH.items())
        clamp = min(1.0, A["capacity_hrs"] / want)   # one printer cannot exceed capacity
        for k, c in CH.items():
            n = BASE[k][m] * mult * clamp
            r = n * c["ticket"]
            h = n * c["hrs"]
            rev += r
            hrs += h
            fees += r * (c["mkt"] * A["fee"]["marketplace"] + (1 - c["mkt"]) * A["fee"]["direct"])
            cogs += n * c["mat"] * (1 + A["fail_rate"]) + h * (A["wear_usd_per_hr"] + A["power_usd_per_hr"])
            cogs += r * A["packaging_pct"]
        opex = mono + ADS[m]
        contrib = rev - cogs - fees
        net_pre = contrib - opex
        pay = cuota if m < A["n_cuotas"] else 0
        cash += net_pre - pay
        rows.append(dict(month=m + 1, revenue=rev, cogs=cogs, fees=fees, opex=opex,
                         net_before_cuota=net_pre, cuota=pay, net_after_cuota=net_pre - pay,
                         cum_cash=cash, print_hrs=hrs, util=hrs / A["capacity_hrs"]))
    return rows

if __name__ == "__main__":
    cuota = A["cuota_ars"] / A["fx"]
    print(f"Cuota = ARS {A['cuota_ars']:,} = USD {cuota:,.0f} @ {A['fx']}; total ARS {A['cuota_ars']*A['n_cuotas']:,}\n")
    for s, mult in SCEN.items():
        rows = run(mult)
        with open(f"schedule_{s}.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader()
            for r in rows: w.writerow({k: round(v, 2) for k, v in r.items()})
        first = next((r["month"] for r in rows if r["net_before_cuota"] >= cuota), None)
        be = next((r["month"] for r in rows if r["cum_cash"] >= 0), None)
        print(f"## {s} (x{mult})  | cuota covered by profit from month {first} | cumulative cash >= 0 from month {be}")
        print("| M | Rev | COGS | Fees | Opex | Net pre-cuota | Cuota | Net | Cum cash | Hrs | Util |")
        print("|--|--|--|--|--|--|--|--|--|--|--|")
        for r in rows:
            print(f"| {r['month']} | {r['revenue']:.0f} | {r['cogs']:.0f} | {r['fees']:.0f} | {r['opex']:.0f} | {r['net_before_cuota']:.0f} | {r['cuota']:.0f} | {r['net_after_cuota']:.0f} | {r['cum_cash']:.0f} | {r['print_hrs']:.0f} | {r['util']:.0%} |")
        print()
