'use client';

// Domain hook: single vehicle list document listener by ID
// Path: vehicleLists/{listId}

import { useDocument } from './useFirestore';
import type { VehicleList } from '../types/list';

interface UseVehicleListReturn {
  data: VehicleList | null;
  loading: boolean;
  error: Error | null;
}

export function useVehicleList(listId: string | undefined): UseVehicleListReturn {
  const path = listId ? `vehicleLists/${listId}` : '';
  return useDocument<VehicleList>(path);
}
