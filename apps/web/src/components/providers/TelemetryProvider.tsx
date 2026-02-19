"use client";

import { useEffect } from "react";
import { initTelemetry } from "@/lib/telemetry";

export function TelemetryProvider() {
  useEffect(() => {
    initTelemetry();
  }, []);

  return null;
}
