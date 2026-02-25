'use client';

// Domain hook: single vehicle document listener by VIN
// Path: vehicles/{vin}
// Tenant-scoped: if dealershipId is provided, the hook returns null
// for vehicles that belong to a different dealership.

import { useMemo } from 'react';
import { useDocument } from './useFirestore';
import type { Vehicle } from '../types/vehicle';

interface UseVehicleReturn {
  data: Vehicle | null;
  loading: boolean;
  error: Error | null;
}

export function useVehicle(vin: string | undefined, dealershipId?: string): UseVehicleReturn {
  const path = vin ? `vehicles/${vin}` : '';
  const result = useDocument<Vehicle>(path);

  const scopedData = useMemo(() => {
    if (!result.data || !dealershipId) return result.data;
    return result.data.dealershipId === dealershipId ? result.data : null;
  }, [result.data, dealershipId]);

  return { data: scopedData, loading: result.loading, error: result.error };
}
