"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdminData,
  AdminUser,
  AdminPickupRequest,
  AdminRoute,
  AdminNotificationEvent,
  AdminDriver,
  AdminPickupCycle,
  AdminSubscription,
  AdminReferral,
  AdminPartner,
  AdminZone,
  AdminWaitlistEntry,
  WorkspaceSection,
} from "./admin-types";

/**
 * Which API endpoints each admin tab actually needs.
 *
 * Rather than fetching all 11 endpoints on mount, each tab declares
 * which data slices it requires. Data is fetched lazily on first
 * tab visit and cached for the session.
 */
const TAB_DEPENDENCIES: Record<WorkspaceSection, (keyof AdminData)[]> = {
  overview: ["users", "waitlist", "pickupRequests", "routes", "pickupCycles", "subscriptions", "zones"],
  people: ["users", "waitlist", "zones"],
  billing: ["subscriptions"],
  network: ["zones", "partners"],
  pickups: ["pickupCycles", "zones"],
  logistics: ["routes", "drivers", "pickupCycles", "zones"],
  growth: ["referrals"],
  communication: ["users", "zones", "notificationEvents"],
};

/**
 * How to fetch each data slice.
 */
const FETCHERS: Record<keyof AdminData, { url: string; key: string }> = {
  users: { url: "/api/admin/users", key: "users" },
  waitlist: { url: "/api/admin/waitlist", key: "waitlist" },
  pickupRequests: { url: "/api/admin/pickup-requests", key: "pickupRequests" },
  routes: { url: "/api/admin/routes", key: "routes" },
  drivers: { url: "/api/admin/drivers", key: "drivers" },
  pickupCycles: { url: "/api/admin/pickup-cycles", key: "pickupCycles" },
  subscriptions: { url: "/api/admin/subscriptions", key: "subscriptions" },
  referrals: { url: "/api/admin/referrals", key: "referrals" },
  zones: { url: "/api/admin/zones", key: "zones" },
  partners: { url: "/api/admin/partners", key: "partners" },
  notificationEvents: { url: "/api/admin/notifications", key: "notificationEvents" },
};

type LoadedSlices = Set<keyof AdminData>;

export function useAdminData(activeSection: WorkspaceSection) {
  const [data, setData] = useState<AdminData>({
    users: [],
    waitlist: [],
    pickupRequests: [],
    routes: [],
    notificationEvents: [],
    drivers: [],
    pickupCycles: [],
    subscriptions: [],
    referrals: [],
    partners: [],
    zones: [],
  });

  const loadedRef = useRef<LoadedSlices>(new Set());
  const loadingRef = useRef<Set<keyof AdminData>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch a single data slice and merge into state.
   */
  const fetchSlice = useCallback(async (sliceKey: keyof AdminData) => {
    if (loadingRef.current.has(sliceKey)) return; // Already in-flight
    loadingRef.current.add(sliceKey);

    const { url, key } = FETCHERS[sliceKey];
    try {
      const response = await fetch(url);
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? `Failed to load ${sliceKey}`);
        return;
      }
      const sliceData = json[key] ?? json.data ?? [];
      setData((prev) => ({ ...prev, [sliceKey]: sliceData }));
      loadedRef.current.add(sliceKey);
    } catch (err) {
      setError(`Failed to load ${sliceKey}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      loadingRef.current.delete(sliceKey);
    }
  }, []);

  /**
   * Ensure all data slices required by the active tab are loaded.
   */
  const ensureTabData = useCallback(
    async (section: WorkspaceSection) => {
      const needed = TAB_DEPENDENCIES[section] ?? [];
      const missing = needed.filter((key) => !loadedRef.current.has(key) && !loadingRef.current.has(key));

      if (missing.length === 0) return;

      setLoading(true);
      await Promise.all(missing.map(fetchSlice));
      setLoading(false);
    },
    [fetchSlice],
  );

  /**
   * Force-refresh specific data slices (call after mutations).
   */
  const refreshSlices = useCallback(
    async (...sliceKeys: (keyof AdminData)[]) => {
      // Clear loaded status so they get re-fetched
      for (const key of sliceKeys) {
        loadedRef.current.delete(key);
      }
      setLoading(true);
      await Promise.all(sliceKeys.map(fetchSlice));
      setLoading(false);
    },
    [fetchSlice],
  );

  /**
   * Force-refresh all currently loaded slices.
   * This is the migration path from `loadAll()` — use sparingly.
   */
  const refreshAll = useCallback(async () => {
    const loaded = Array.from(loadedRef.current);
    if (loaded.length === 0) return;
    for (const key of loaded) {
      loadedRef.current.delete(key);
    }
    setLoading(true);
    await Promise.all(loaded.map(fetchSlice));
    setLoading(false);
  }, [fetchSlice]);

  /**
   * Legacy compatibility: load everything at once.
   * Used during migration — individual tabs should use ensureTabData instead.
   */
  const loadAll = useCallback(async () => {
    const allKeys = Object.keys(FETCHERS) as (keyof AdminData)[];
    for (const key of allKeys) {
      loadedRef.current.delete(key);
    }
    setLoading(true);
    await Promise.all(allKeys.map(fetchSlice));
    setLoading(false);
  }, [fetchSlice]);

  // Auto-load data for the active section
  useEffect(() => {
    ensureTabData(activeSection);
  }, [activeSection, ensureTabData]);

  return {
    data,
    setData,
    loading,
    error,
    loadAll,
    refreshSlices,
    refreshAll,
    ensureTabData,
  };
}
