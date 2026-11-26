/**
 * realtime publishes and handles no events: it forwards NOTIFYs on the `realtime` channel (not the event log)
 * and owns no data (docs/azure/prd.md, "Realtime").
 */
export const events = {
  publishes: [],
  handles: [],
} as const;
