// W8 consistency check (no dependencies): node site/tests/consistency.mjs
// Asserts, for all three farms, that the dashboard (app.js DB after real-data.js) and the SI engine fixture agree:
// recommended === ranking[0], card water === engine expected water, and the CERES voice names the same winner.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ["ceres-nasa-data.js", "si-data.js", "real-data.js"]) vm.runInContext(fs.readFileSync(path.join(site, f), "utf8"), ctx, { filename: f });
const app = fs.readFileSync(path.join(site, "app.js"), "utf8");
const DB = JSON.parse(app.slice(app.indexOf("const DB = ") + 11, app.indexOf("\n};\ntry {") + 2));
const W = ctx.window;
if (!W.CeresRealData.apply(DB)) throw new Error("real data not applied");
let fail = 0;
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fail++; };
for (const f of DB.FARMS) {
  const fx = W.AGUA_SI_FIXTURES[f.id];
  const top = fx.tradeoffs.ranking[0].id;
  const engTop = fx.compare.strategies.find((s) => s.recommended);
  const card = f.strategies.find((s) => s.recommended);
  check(engTop && engTop.id === top, `${f.id}: engine recommended === ranking[0] (${top})`);
  check(card && card.id === top, `${f.id}: dashboard SUGERIDA === ranking[0] (${card && card.id})`);
  for (const s of f.strategies) {
    const e = fx.compare.strategies.find((x) => x.id === s.id);
    check(e && s.water === Math.round(e.water.expected), `${f.id}/${s.id}: card water ${s.water} === engine ${e && Math.round(e.water.expected)}`);
  }
  check(fx.voice.es.text.includes(engTop.name.es), `${f.id}: CERES voice names ${engTop.name.es}`);
  check(f.ceres.es === fx.voice.es.text, `${f.id}: dashboard CERES card === engine voice`);
  check(f.strategies.length >= 3 && f.strategies.some((s) => s.current), `${f.id}: >= 3 strategies incl. current`);
  check(f.strategies.every((s) => s.why && s.gaps && s.risks && s.evidence && s.benefits), `${f.id}: every card has why/benefits/evidence/gaps/risks`);
}
const alg = DB.FARMS.find((f) => f.id === "algarrobal");
const drip = alg.strategies.find((s) => s.id === "drip"), cur = alg.strategies.find((s) => s.current);
check(drip.recommended && Math.abs(drip.water - 12890) / 12890 < 0.005 && Math.abs(cur.water - 17070) / 17070 < 0.005, `algarrobal: drip + strip cover ${drip.water} vs gravity ${cur.water} (Kepler 12,890 / 17,070)`);
console.log(fail ? `\n${fail} FAILED` : "\nall consistency checks passed");
process.exit(fail ? 1 : 0);
