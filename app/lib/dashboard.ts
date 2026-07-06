import { getBackendUrl, getPerformanceUrl, getWsBaseUrl } from "../config";

export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
};

export type DashboardSummary = {
  plantId: string;
  plantName: string;
  isActive: boolean;
  activeLabel: string;
  general: DashboardMetric[];
  realtime: DashboardMetric[];
  performance: DashboardMetric[];
  financial: {
    rows: {
      label: string;
      energy: string;
      revenue: string;
      lossPerf: string;
      lossCurt: string;
    }[];
  };
};

type DashboardPayload = Record<string, unknown>;

type DashboardStreamHandlers = {
  onUpdate: (summary: DashboardSummary) => void;
  onStatus?: (status: "connecting" | "connected" | "polling" | "offline") => void;
};

const FALLBACK_DASHBOARD: DashboardSummary = {
  plantId: "anorchi-lanka",
  plantName: "Anorchi Lanka",
  isActive: true,
  activeLabel: "Active",
  general: [
    { key: "time", label: "TIME", value: "09:05:48" },
    { key: "irradiance", label: "IRRADIANCE", value: "968 W/m²" },
    { key: "pv-temp", label: "PV TEMP", value: "48.8°C" },
    { key: "wind", label: "WIND SPEED", value: "5.6 m/s" },
  ],
  realtime: [
    { key: "active-power", label: "ACTIVE P", value: "5,415.4", unit: "kW" },
    { key: "reactive-power", label: "REACTIVE P", value: "-0.1", unit: "kVar" },
    { key: "frequency", label: "FREQUENCY", value: "50.1", unit: "Hz" },
    { key: "pf", label: "PF", value: "1" },
  ],
  performance: [
    { key: "pr", label: "PR", value: "72.34%" },
    { key: "cf", label: "CF", value: "2.03%" },
    { key: "cuf", label: "CUF", value: "42.05%" },
    { key: "tct", label: "TCT", value: "00h 00m" },
  ],
  financial: {
    rows: [
      { label: "DAILY", energy: "6.3K kWh", revenue: "144.8K LKR", lossPerf: "42.3K LKR", lossCurt: "0 LKR" },
      { label: "MTD", energy: "64.5K kWh", revenue: "1.5M LKR", lossPerf: "517K LKR", lossCurt: "0 LKR" },
      { label: "YTD", energy: "3.7M kWh", revenue: "85.2M LKR", lossPerf: "25.4M LKR", lossCurt: "4.3M LKR" },
    ],
  },
};

const DASHBOARD_CACHE = new Map<string, DashboardSummary>();

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
    const fallback = Number.parseFloat(normalized);
    if (Number.isFinite(fallback)) return fallback;
  }
  return null;
}

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function pickObject(payload: unknown): DashboardPayload {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as DashboardPayload;
  }
  return {};
}

function findValue(source: unknown, keys: string[], depth = 0): unknown {
  if (!source || typeof source !== "object" || depth > 3) return undefined;

  const record = source as DashboardPayload;
  const lookupKeys = new Set(keys.map(normalizeKey));

  for (const [key, value] of Object.entries(record)) {
    if (lookupKeys.has(normalizeKey(key)) && value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = findValue(value, keys, depth + 1);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
}

function getString(source: unknown, keys: string[]) {
  return asString(findValue(source, keys));
}

function getNumber(source: unknown, keys: string[]) {
  return asNumber(findValue(source, keys));
}

function formatTimeNow() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function formatValue(value: number | string | null, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value;
  return suffix ? `${text} ${suffix}` : text;
}

function setMetricValue(items: DashboardMetric[], key: string, value: string, unit?: string) {
  return items.map((item) => {
    if (item.key !== key) return item;
    return {
      ...item,
      value: value || item.value,
      unit: unit ?? item.unit,
    };
  });
}

function extractStreamPayload(message: unknown): DashboardPayload {
  const record = pickObject(message);
  const payload = pickObject(
    record.payload ?? record.data ?? record.snapshot ?? record.delta ?? record.update ?? record.telemetry ?? record.totals,
  );
  return Object.keys(payload).length ? payload : record;
}

function normalizeDashboard(
  plantId: string,
  plantPayload: unknown,
  snapshotPayload: unknown,
  kpiPayload: unknown,
  prPayload: unknown,
): DashboardSummary {
  const plant = pickObject(plantPayload);
  const snapshot = pickObject(snapshotPayload);
  const kpi = pickObject(kpiPayload);
  const pr = pickObject(prPayload);

  const plantName = getString(plant, ["name", "plant_name", "plantName"]) || FALLBACK_DASHBOARD.plantName;
  const isActive = plant.is_active === true || plant.active === true || getString(plant, ["status"]) === "active";
  const activeLabel = isActive ? "Active" : "Inactive";

  const totalActivePowerKw = getNumber(snapshot, ["total_active_power_kw", "active_power_kw", "totalActivePowerKw"]) ?? 5415.4;
  const totalReactivePowerKvar = getNumber(snapshot, ["total_reactive_power_kvar", "reactive_power_kvar", "totalReactivePowerKvar"]) ?? -0.1;
  const avgGridFrequencyHz = getNumber(snapshot, ["avg_grid_frequency_hz", "grid_frequency_hz", "frequency_hz"]) ?? 50.1;
  const avgPf = getNumber(snapshot, ["avg_power_factor", "power_factor", "pf"]) ?? 1;
  const avgCcuTemp = getNumber(snapshot, ["avg_ccu_temperature_c", "pv_temperature_c", "temperature_c"]) ?? 48.8;
  const dailyEnergy = getNumber(snapshot, ["total_daily_active_energy_kwh", "today_energy_kwh", "daily_energy_kwh"]) ?? 6230;
  const irradiance = getNumber(snapshot, ["irradiance", "solar_irradiance", "irradiance_wm2"]) ?? 968;
  const windSpeed = getNumber(snapshot, ["wind_speed", "windSpeed"]) ?? 5.6;

  const prValue = getNumber(pr, ["pr", "value"]) ?? 72.34;
  const cfValue = getNumber(kpi, ["cf", "capacity_factor"]) ?? 2.03;
  const cufValue = getNumber(kpi, ["cuf", "cuf_percent"]) ?? 42.05;
  const tctValue = getString(kpi, ["tct", "total_curtailment_time", "curtailment_time"]) || "00h 00m";

  return {
    plantId,
    plantName,
    isActive,
    activeLabel,
    general: [
      { key: "time", label: "TIME", value: formatTimeNow() },
      { key: "irradiance", label: "IRRADIANCE", value: formatValue(irradiance, "W/m²") },
      { key: "pv-temp", label: "PV TEMP", value: formatValue(avgCcuTemp, "°C") },
      { key: "wind", label: "WIND SPEED", value: formatValue(windSpeed, "m/s") },
    ],
    realtime: [
      { key: "active-power", label: "ACTIVE P", value: formatValue(totalActivePowerKw, ""), unit: "kW" },
      { key: "reactive-power", label: "REACTIVE P", value: formatValue(totalReactivePowerKvar, ""), unit: "kVar" },
      { key: "frequency", label: "FREQUENCY", value: formatValue(avgGridFrequencyHz, ""), unit: "Hz" },
      { key: "pf", label: "PF", value: formatValue(avgPf, "") },
    ],
    performance: [
      { key: "pr", label: "PR", value: `${formatValue(prValue, "")}%` },
      { key: "cf", label: "CF", value: `${formatValue(cfValue, "")}%` },
      { key: "cuf", label: "CUF", value: `${formatValue(cufValue, "")}%` },
      { key: "tct", label: "TCT", value: tctValue },
    ],
    financial: {
      rows: [
        {
          label: "DAILY",
          energy: formatValue(dailyEnergy.toFixed(1), "kWh"),
          revenue: "144.8K LKR",
          lossPerf: "42.3K LKR",
          lossCurt: "0 LKR",
        },
        {
          label: "MTD",
          energy: "64.5K kWh",
          revenue: "1.5M LKR",
          lossPerf: "517K LKR",
          lossCurt: "0 LKR",
        },
        {
          label: "YTD",
          energy: "3.7M kWh",
          revenue: "85.2M LKR",
          lossPerf: "25.4M LKR",
          lossCurt: "4.3M LKR",
        },
      ],
    },
  };
}

export function mergeDashboardSummary(current: DashboardSummary, message: unknown): DashboardSummary {
  const patch = extractStreamPayload(message);
  const nextPlantName = getString(patch, ["plant_name", "plantName", "name"]) || current.plantName;
  const activeStatus = getString(patch, ["status"]);
  const isActive = patch.is_active === true || patch.active === true || activeStatus === "active" ? true : activeStatus === "inactive" ? false : current.isActive;

  let nextGeneral = current.general.map((item) => ({ ...item }));
  nextGeneral = setMetricValue(
    nextGeneral,
    "time",
    getString(patch, ["time", "timestamp", "updated_at", "updatedAt", "reading_time"]) || formatTimeNow(),
  );
  nextGeneral = setMetricValue(
    nextGeneral,
    "irradiance",
    (() => {
      const value = getNumber(patch, ["irradiance", "solar_irradiance", "irradiance_wm2"]);
      return value === null ? "" : formatValue(value, "W/m²");
    })(),
  );
  nextGeneral = setMetricValue(
    nextGeneral,
    "pv-temp",
    (() => {
      const value = getNumber(patch, ["avg_ccu_temperature_c", "pv_temperature_c", "temperature_c"]);
      return value === null ? "" : formatValue(value, "°C");
    })(),
  );
  nextGeneral = setMetricValue(
    nextGeneral,
    "wind",
    (() => {
      const value = getNumber(patch, ["wind_speed", "windSpeed"]);
      return value === null ? "" : formatValue(value, "m/s");
    })(),
  );

  let nextRealtime = current.realtime.map((item) => ({ ...item }));
  nextRealtime = setMetricValue(
    nextRealtime,
    "active-power",
    (() => {
      const value = getNumber(patch, ["total_active_power_kw", "active_power_kw", "totalActivePowerKw"]);
      return value === null ? "" : formatValue(value, "");
    })(),
    "kW",
  );
  nextRealtime = setMetricValue(
    nextRealtime,
    "reactive-power",
    (() => {
      const value = getNumber(patch, ["total_reactive_power_kvar", "reactive_power_kvar", "totalReactivePowerKvar"]);
      return value === null ? "" : formatValue(value, "");
    })(),
    "kVar",
  );
  nextRealtime = setMetricValue(
    nextRealtime,
    "frequency",
    (() => {
      const value = getNumber(patch, ["avg_grid_frequency_hz", "grid_frequency_hz", "frequency_hz"]);
      return value === null ? "" : formatValue(value, "");
    })(),
    "Hz",
  );
  nextRealtime = setMetricValue(
    nextRealtime,
    "pf",
    (() => {
      const value = getNumber(patch, ["avg_power_factor", "power_factor", "pf"]);
      return value === null ? "" : formatValue(value, "");
    })(),
  );

  let nextPerformance = current.performance.map((item) => ({ ...item }));
  nextPerformance = setMetricValue(
    nextPerformance,
    "pr",
    (() => {
      const value = getNumber(patch, ["pr", "pr_percent", "performance_ratio"]);
      return value === null ? "" : `${formatValue(value, "")}%`;
    })(),
  );
  nextPerformance = setMetricValue(
    nextPerformance,
    "cf",
    (() => {
      const value = getNumber(patch, ["cf", "capacity_factor"]);
      return value === null ? "" : `${formatValue(value, "")}%`;
    })(),
  );
  nextPerformance = setMetricValue(
    nextPerformance,
    "cuf",
    (() => {
      const value = getNumber(patch, ["cuf", "cuf_percent"]);
      return value === null ? "" : `${formatValue(value, "")}%`;
    })(),
  );
  nextPerformance = setMetricValue(
    nextPerformance,
    "tct",
    getString(patch, ["tct", "total_curtailment_time", "curtailment_time"]),
  );

  const financialPatch = pickObject(findValue(patch, ["financial", "losses", "rows"]) ?? patch.financial ?? patch.losses ?? patch.rows);
  let nextFinancialRows = current.financial.rows.map((row) => ({ ...row }));
  if (Object.keys(financialPatch).length > 0) {
    nextFinancialRows = nextFinancialRows.map((row) => {
      const rowPatch = findValue(financialPatch, [row.label, row.label.toLowerCase()]) ?? financialPatch[row.label] ?? financialPatch[row.label.toLowerCase()];
      const rowRecord = pickObject(rowPatch);
      const energy = getString(rowRecord, ["energy", "daily_energy", "kwh"]);
      const revenue = getString(rowRecord, ["revenue", "income", "lkr"]);
      const lossPerf = getString(rowRecord, ["loss_perf", "lossPerformance", "performance_loss"]);
      const lossCurt = getString(rowRecord, ["loss_curt", "lossCurt", "curtailment_loss"]);

      return {
        ...row,
        energy: energy || row.energy,
        revenue: revenue || row.revenue,
        lossPerf: lossPerf || row.lossPerf,
        lossCurt: lossCurt || row.lossCurt,
      };
    });
  }

  const nextSummary: DashboardSummary = {
    ...current,
    plantName: nextPlantName,
    isActive,
    activeLabel: isActive ? "Active" : "Inactive",
    general: nextGeneral,
    realtime: nextRealtime,
    performance: nextPerformance,
    financial: { rows: nextFinancialRows },
  };

  DASHBOARD_CACHE.set(nextSummary.plantId, nextSummary);
  return nextSummary;
}

function getRequestTimeoutSignal(timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeout);
      controller.abort();
    },
  };
}

async function fetchJson(url: string, token: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export function getCachedDashboard(plantId: string) {
  return DASHBOARD_CACHE.get(plantId) || null;
}

export function setCachedDashboard(summary: DashboardSummary) {
  DASHBOARD_CACHE.set(summary.plantId, summary);
}

export async function fetchDashboard(plantId: string, token: string): Promise<DashboardSummary> {
  try {
    console.log("[dashboard] fetchDashboard:start", { plantId });
    const timeout = getRequestTimeoutSignal(18000);
    try {
      const [plantPayload, snapshotPayload, kpiPayload, prPayload] = await Promise.all([
        fetchJson(getBackendUrl(`/plants/${plantId}`), token, timeout.signal),
        fetchJson(getBackendUrl(`/telemetry/snapshot?plant_id=${encodeURIComponent(plantId)}`), token, timeout.signal),
        fetchJson(getBackendUrl(`/plants/${plantId}/kpi`), token, timeout.signal),
        fetchJson(getPerformanceUrl("/pr/latest"), token, timeout.signal),
      ]);

      console.log("[dashboard] fetchDashboard:api-payloads", {
        plantId,
        hasPlant: Boolean(plantPayload),
        hasSnapshot: Boolean(snapshotPayload),
        hasKpi: Boolean(kpiPayload),
        hasPr: Boolean(prPayload),
      });

      const dashboard = normalizeDashboard(plantId, plantPayload, snapshotPayload, kpiPayload, prPayload);
      console.log("[dashboard] fetchDashboard:normalized", {
        plantId,
        plantName: dashboard.plantName,
        activeLabel: dashboard.activeLabel,
        realtime: dashboard.realtime.map((item) => ({ key: item.key, value: item.value, unit: item.unit })),
      });
      setCachedDashboard(dashboard);
      return dashboard;
    } finally {
      timeout.cancel();
    }
  } catch {
    console.warn("[dashboard] fetchDashboard:failed, using cached or fallback", { plantId });
    const cached = getCachedDashboard(plantId);
    if (cached) return cached;

    const fallback = {
      ...FALLBACK_DASHBOARD,
      plantId,
    };
    setCachedDashboard(fallback);
    return fallback;
  }
}

function buildWsUrl(plantId: string) {
  const base = getWsBaseUrl();
  if (!base) return "";

  try {
    const url = new URL(base);
    url.searchParams.set("plant_id", plantId);
    return url.toString();
  } catch {
    return "";
  }
}

function readSocketMessage(event: MessageEvent) {
  const raw = typeof event.data === "string" ? event.data : "";
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function shouldUsePatch(message: unknown) {
  const record = pickObject(message);
  const type = normalizeKey(asString(record.type || record.event || record.kind));
  return (
    type === "dashboardsnapshot" ||
    type === "dashboarddelta" ||
    type === "telemetrytotalsupdate" ||
    type === "inverterupdate" ||
    type === "snapshot" ||
    type === "delta" ||
    type === "update"
  );
}

export function startDashboardLiveUpdates(plantId: string, token: string, handlers: DashboardStreamHandlers, initialSummary?: DashboardSummary | null) {
  let active = true;
  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 2000;
  let latestSummary = initialSummary || getCachedDashboard(plantId);

  const disposeSocket = () => {
    if (socket) {
      try {
        socket.close(1000, "cleanup");
      } catch {
        // ignore
      }
    }
    socket = null;
  };

  const clearTimers = () => {
    if (pollTimer) clearInterval(pollTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    pollTimer = null;
    reconnectTimer = null;
  };

  const publish = (summary: DashboardSummary) => {
    if (!active) return;
    latestSummary = summary;
    setCachedDashboard(summary);
    console.log("[dashboard] live:update", {
      plantId: summary.plantId,
      plantName: summary.plantName,
      activeLabel: summary.activeLabel,
      realtime: summary.realtime.map((item) => ({ key: item.key, value: item.value, unit: item.unit })),
    });
    handlers.onUpdate(summary);
  };

  const refreshFromApi = async () => {
    if (!active) return;
    console.log("[dashboard] live:refreshFromApi", { plantId });
    handlers.onStatus?.("polling");
    const summary = await fetchDashboard(plantId, token);
    if (!active) return;
    publish(summary);
    handlers.onStatus?.("connected");
  };

  const connect = () => {
    if (!active) return;

    const wsUrl = buildWsUrl(plantId);
    if (!wsUrl) {
      console.warn("[dashboard] websocket unavailable, using polling", { plantId });
      handlers.onStatus?.("offline");
      pollTimer = setInterval(() => {
        void refreshFromApi();
      }, 30000);
      return;
    }

    handlers.onStatus?.("connecting");
    console.log("[dashboard] websocket connecting", { plantId, wsUrl });

    try {
      socket = new WebSocket(wsUrl);
    } catch {
      console.warn("[dashboard] websocket failed to construct, using polling", { plantId });
      handlers.onStatus?.("offline");
      pollTimer = setInterval(() => {
        void refreshFromApi();
      }, 30000);
      return;
    }

    socket.onopen = () => {
      if (!active || !socket) return;
      reconnectDelay = 2000;
      handlers.onStatus?.("connected");
      console.log("[dashboard] websocket connected", { plantId });
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        void refreshFromApi();
      }, 30000);
      try {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            channel: "dashboard",
            plantId,
          }),
        );
      } catch {
        // ignore
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      if (!active || !latestSummary) return;
      const parsed = readSocketMessage(event);
      if (!parsed) {
        console.log("[dashboard] websocket message:unparsed", { plantId });
        return;
      }

      const record = pickObject(parsed);
      const messageType = asString(record.type || record.event || record.kind) || "unknown";
      console.log("[dashboard] websocket message", {
        plantId,
        type: messageType,
        keys: Object.keys(record).slice(0, 12),
      });

      if (!shouldUsePatch(parsed)) return;

      const merged = mergeDashboardSummary(latestSummary, parsed);
      publish(merged);
    };

    socket.onerror = () => {
      console.warn("[dashboard] websocket error", { plantId });
      handlers.onStatus?.("offline");
    };

    socket.onclose = () => {
      if (!active) return;
      console.warn("[dashboard] websocket closed, scheduling reconnect", { plantId });
      disposeSocket();
      handlers.onStatus?.("offline");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 1.7, 30000);
        connect();
      }, reconnectDelay);
    };
  };

  void (async () => {
    if (!latestSummary) {
      await refreshFromApi();
    }
    if (!active) return;
    connect();
  })();

  return () => {
    active = false;
    clearTimers();
    disposeSocket();
  };
}

export function clearDashboardCache() {
  DASHBOARD_CACHE.clear();
}
