import { Registry, Gauge, Counter } from "prom-client";

export const registry = new Registry();

// --- Metrics ---

export const slotLagGauge = new Gauge({
  name: "legacyvault_indexer_slot_lag",
  help: "Difference between network tip and last processed slot",
  registers: [registry]
});

export const lastProcessedSlotGauge = new Gauge({
  name: "legacyvault_indexer_last_processed_slot",
  help: "The last slot processed by the indexer",
  registers: [registry]
});

export const eventsProcessedCounter = new Counter({
  name: "legacyvault_indexer_events_processed_total",
  help: "Total number of events processed",
  labelNames: ["event_name"],
  registers: [registry]
});

export const dbOperationDuration = new Gauge({
  name: "legacyvault_indexer_db_op_duration_seconds",
  help: "Time taken for database operations",
  labelNames: ["operation"],
  registers: [registry]
});
