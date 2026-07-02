import { getBackendUrl } from "../config";

export type PlantSummary = {
  id: string;
  name: string;
  isActive: boolean;
  capacityMw: number | null;
  todayEnergyKwh: number | null;
  availability: number | null;
  activeAlarms: number | null;
  statusLabel: "Normal" | "Warning" | "Critical";
};

const FALLBACK_PLANTS: PlantSummary[] = [
  {
    id: "anorchi-lanka",
    name: "Anorchi Lanka",
    isActive: true,
    capacityMw: 5.4,
    todayEnergyKwh: 6230,
    availability: null,
    activeAlarms: 0,
    statusLabel: "Warning",
  },
  {
    id: "iris-eco",
    name: "Iris Eco",
    isActive: true,
    capacityMw: 4.9,
    todayEnergyKwh: 4681,
    availability: null,
    activeAlarms: 0,
    statusLabel: "Normal",
  },
  {
    id: "serendib-solar",
    name: "Serendib Solar",
    isActive: true,
    capacityMw: 2.8,
    todayEnergyKwh: 3394,
    availability: null,
    activeAlarms: 0,
    statusLabel: "Normal",
  },
  {
    id: "embillamada",
    name: "Embillamada",
    isActive: true,
    capacityMw: 0.7,
    todayEnergyKwh: 1215,
    availability: null,
    activeAlarms: 0,
    statusLabel: "Normal",
  },
];

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function deriveStatus(isActive: boolean, activeAlarms: number | null, availability: number | null): PlantSummary["statusLabel"] {
  if (!isActive) return "Critical";
  if ((activeAlarms || 0) > 0) return "Warning";
  if (availability !== null && availability < 80) return "Warning";
  return "Normal";
}

function extractPlantsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.plants)) return record.plants;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

function normalizePlant(value: unknown): PlantSummary | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const id = asString(record.id) || asString(record.plant_id) || asString(record.plantId);
  const name = asString(record.name) || asString(record.plant_name) || asString(record.plantName);
  if (!id && !name) return null;

  const isActive = asBoolean(record.is_active ?? record.active ?? record.status === "active" ?? record.status === "online");
  const activeAlarms = asNumber(record.active_alarms ?? record.activeAlarms ?? record.alarms_count ?? record.alarm_count);
  const availability = asNumber(record.availability ?? record.availability_percent ?? record.availabilityPercent);
  const capacityKw = asNumber(record.capacity_kw ?? record.capacityKw ?? record.capacity);
  const todayEnergy = asNumber(
    record.total_daily_active_energy_kwh ??
      record.today_energy_kwh ??
      record.todayEnergyKwh ??
      record.daily_energy_kwh ??
      record.energy_today_kwh,
  );

  const capacityMw = capacityKw === null ? null : capacityKw > 100 ? capacityKw / 1000 : capacityKw;

  return {
    id: id || name,
    name: name || id,
    isActive,
    capacityMw,
    todayEnergyKwh: todayEnergy,
    availability,
    activeAlarms,
    statusLabel: deriveStatus(isActive, activeAlarms, availability),
  };
}

export function formatCapacityMw(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(value >= 10 ? 0 : 1)} MW`;
}

export function formatEnergyKwh(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString()} kWh`;
}

export async function fetchPlantSummaries(token: string): Promise<PlantSummary[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(getBackendUrl("/plants?stats=true"), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return FALLBACK_PLANTS;
    }

    const payload = await response.json().catch(() => null);
    const plants = extractPlantsFromPayload(payload)
      .map(normalizePlant)
      .filter((item): item is PlantSummary => Boolean(item));

    return plants.length ? plants : FALLBACK_PLANTS;
  } catch {
    return FALLBACK_PLANTS;
  }
}

export function getFallbackPlantCount() {
  return FALLBACK_PLANTS.length;
}
