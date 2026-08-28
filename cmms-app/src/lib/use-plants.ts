"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface Plant {
  id: string;
  code: string;
  name: string;
}

export function usePlants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  useEffect(() => {
    apiFetch<Plant[]>("/plants").then(setPlants).catch(() => {});
  }, []);
  return plants;
}
