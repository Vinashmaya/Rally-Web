// Re-export all hooks from @rally/firebase/hooks

export { useAuth } from './useAuth';
export { useDocument, useCollection, useCollectionGroup } from './useFirestore';
export { useVehicles } from './useVehicles';
export { useVehicle } from './useVehicle';
export { useUsers } from './useUsers';
export { useActivities } from './useActivities';
export { useVehicleLists } from './useVehicleLists';
export { useVehicleList } from './useVehicleList';

// Phase 1 hooks — fleet, battery, CRM, admin
export { useFleetVehicles } from './useFleetVehicles';
export { useBatteryReports } from './useBatteryReports';
export { useCrmCustomers } from './useCrmCustomers';
export { useAuditLog } from './useAuditLog';
export { useFeatureFlags } from './useFeatureFlags';
export { useTenants } from './useTenants';
export { useAllUsers } from './useAllUsers';
export { useAllVehicles } from './useAllVehicles';
export { useAllActivities } from './useAllActivities';
export { useNfcTags } from './useNfcTags';
export { useAllVehicleLists } from './useAllVehicleLists';
