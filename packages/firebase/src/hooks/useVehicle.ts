'use client';

// Domain hook: single vehicle document listener by VIN
// Path: vehicles/{vin}

import { useDocument } from './useFirestore';
import type { Vehicle } from '../types/vehicle';

interface UseVehicleReturn {
  data: Vehicle | null;
  loading: boolean;
  error: Error | null;
}

export function useVehicle(vin: string | undefined): UseVehicleReturn {
  const path = vin ? `vehicles/${vin}` : '';
  return useDocument<Vehicle>(path);
}
