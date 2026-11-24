// Build-time data access. Pages are statically exported, so these reads run once, during `next build`.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnomalyModel, DataNotices, ExitModel, Exposure, Fact, ForecastModel, Kpi, Manifest, Occupation, Pay, Reconciliation, RetentionModel, Scope, Segment } from "./types";

const DIR = path.join(process.cwd(), "data");
const read = <T,>(file: string): T => JSON.parse(readFileSync(path.join(DIR, file), "utf8")) as T;

export const kpi = (scope = "ALL") => read<Kpi[]>(`kpi/${scope}.json`);
export const pay = (scope = "ALL") => read<Pay[]>(`pay/${scope}.json`);
export const segments = (scope = "ALL") => read<Segment[]>(`segments/${scope}.json`);
export const exposure = (scope = "ALL") => read<Exposure[]>(`exposure/${scope}.json`);
export const scopes = () => read<Scope[]>("scopes.json");
export const occupations = () => read<Occupation[]>("occupation_fy.json");
export const reconciliation = () => read<Reconciliation[]>("reconciliation.json");
export const manifest = () => read<Manifest>("manifest.json");
export const forecastModel = () => read<ForecastModel>("models/forecast.json");
export const anomalyModel = () => read<AnomalyModel>("models/anomaly.json");
export const retentionModel = () => read<RetentionModel>("models/retention.json");
export const exitModel = () => read<ExitModel>("models/exit_model.json");
export const dataNotices = () => read<DataNotices>("data_notices.json");
/** Notices that make a scope-month unreliable; a gap in any department is a gap government-wide. */
export function openNotices(scope = "ALL") {
  return dataNotices().notices.filter((n) => n.status !== "resolved" && (scope === "ALL" || n.scope === scope));
}

const FACTS = () => new Map(read<Fact[]>("facts.json").map((f) => [f.id, f]));
export function facts() {
  const map = FACTS();
  return (id: string): Fact => {
    const f = map.get(id);
    if (!f) throw new Error(`fact ${id} missing from facts.json`);
    return f;
  };
}
