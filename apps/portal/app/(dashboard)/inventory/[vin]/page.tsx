'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Car,
  Clock,
  Gauge,
  Palette,
  DollarSign,
  Hash,
  Truck,
  MapPin,
  AlertTriangle,
  User,
  Calendar,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  StockHero,
  StatusBadge,
  Badge,
  Skeleton,
  ActivityFeedItem,
} from '@rally/ui';
import { useToast } from '@rally/ui';
import {
  useVehicle,
  useActivities,
  type Vehicle,
  type VehicleStatus,
  type VehicleCondition,
  VEHICLE_CONDITION_DISPLAY,
  VEHICLE_TYPE_DISPLAY,
  type VehicleType,
} from '@rally/firebase';
import { useTenantStore } from '@rally/services';

// ---------------------------------------------------------------------------
// Detail Row — reusable key-value row
// ---------------------------------------------------------------------------

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
      <span className="w-28 shrink-0 text-xs text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo Gallery — primary image with thumbnail strip
// ---------------------------------------------------------------------------

function PhotoGallery({
  photos,
  primaryPhotoUrl,
  alt,
  selectedIndex,
  onSelect,
}: {
  photos: string[];
  primaryPhotoUrl: string | undefined;
  alt: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const allPhotos = useMemo(() => {
    if (photos.length === 0 && primaryPhotoUrl) return [primaryPhotoUrl];
    if (photos.length === 0) return [];
    if (primaryPhotoUrl && !photos.includes(primaryPhotoUrl)) {
      return [primaryPhotoUrl, ...photos];
    }
    if (primaryPhotoUrl) {
      const idx = photos.indexOf(primaryPhotoUrl);
      return [primaryPhotoUrl, ...photos.slice(0, idx), ...photos.slice(idx + 1)];
    }
    return photos;
  }, [photos, primaryPhotoUrl]);

  const activeUrl = allPhotos[selectedIndex] ?? allPhotos[0];

  if (allPhotos.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-rally-lg bg-surface-overlay">
        <div className="flex flex-col items-center gap-2">
          <Camera className="h-10 w-10 text-text-tertiary" strokeWidth={1.5} />
          <span className="text-xs text-text-tertiary">No photos available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Primary display */}
      <div className="relative aspect-video w-full overflow-hidden rounded-rally-lg bg-surface-overlay">
        {activeUrl && (
          <img
            src={activeUrl}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Thumbnail strip */}
      {allPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allPhotos.map((url, i) => (
            <button
              key={url}
              onClick={() => onSelect(i)}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-rally transition-all ${
                i === selectedIndex
                  ? 'ring-2 ring-rally-gold ring-offset-2 ring-offset-surface-base'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={url}
                alt={`${alt} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hold Info Banner
// ---------------------------------------------------------------------------

function HoldBanner({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.holdInfo) return null;

  const expiresAt = vehicle.holdInfo.expiresAt;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  return (
    <Card className={isExpired ? 'border-status-error/30' : 'border-status-warning/30'}>
      <CardContent>
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`h-5 w-5 shrink-0 mt-0.5 ${isExpired ? 'text-status-error' : 'text-status-warning'}`}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-primary">
              {isExpired ? 'Hold Expired' : 'Vehicle On Hold'}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              {vehicle.holdInfo.customerName && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {vehicle.holdInfo.customerName}
                </span>
              )}
              {expiresAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Expires {new Date(expiresAt).toLocaleDateString()}
                </span>
              )}
              {vehicle.holdInfo.depositAmount != null && vehicle.holdInfo.depositAmount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${vehicle.holdInfo.depositAmount.toLocaleString()} deposit
                </span>
              )}
            </div>
            {vehicle.holdInfo.notes && (
              <p className="mt-1 text-xs text-text-tertiary">{vehicle.holdInfo.notes}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-36" />
      <div className="flex flex-col gap-2">
        <Skeleton variant="stockHero" />
        <Skeleton className="h-7 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton variant="card" className="aspect-video h-auto w-full" />
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicle Detail Page
// ---------------------------------------------------------------------------

export default function PortalVehicleDetailPage() {
  const params = useParams<{ vin: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  // Photo gallery state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Firestore real-time document listener (tenant-scoped)
  const { data: vehicle, loading, error } = useVehicle(params.vin, dealershipId || undefined);

  // Activity history for this vehicle
  const { activities, loading: activitiesLoading } = useActivities({
    dealershipId,
    limitCount: 20,
  });

  // Filter activities for this specific vehicle
  const vehicleActivities = useMemo(
    () => activities.filter((a) => a.vin === params.vin),
    [activities, params.vin],
  );

  // Surface errors via toast
  useEffect(() => {
    if (error) {
      toast({
        type: 'error',
        title: 'Failed to load vehicle',
        description: error.message,
      });
    }
  }, [error, toast]);

  // Reset photo index when vehicle changes
  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [params.vin]);

  // Navigation
  const goBack = useCallback(() => {
    router.push('/inventory');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Button>
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-text-secondary">
                Vehicle with VIN{' '}
                <span className="font-mono text-rally-gold">{params.vin}</span>{' '}
                not found.
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                It may have been archived or the VIN may be incorrect.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={goBack}
              >
                Back to Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ymm = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const ymmFull = vehicle.trim ? `${ymm} ${vehicle.trim}` : ymm;
  const daysOnLot = vehicle.daysOnLot ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Button>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col gap-2">
        <StockHero stockNumber={vehicle.stockNumber} />
        <h1 className="text-xl font-semibold text-text-primary">{ymmFull}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={vehicle.status as VehicleStatus} />
          {vehicle.isNew ? (
            <Badge variant="gold" size="sm">New</Badge>
          ) : (
            vehicle.condition && (
              <Badge variant="default" size="sm">
                {VEHICLE_CONDITION_DISPLAY[vehicle.condition as VehicleCondition] ?? vehicle.condition}
              </Badge>
            )
          )}
        </div>
      </div>

      {/* Hold Banner (if applicable) */}
      <HoldBanner vehicle={vehicle} />

      {/* Photo Gallery */}
      <Card>
        <CardContent>
          <PhotoGallery
            photos={vehicle.photos ?? []}
            primaryPhotoUrl={vehicle.primaryPhotoUrl}
            alt={`${ymmFull} - Stock ${vehicle.stockNumber}`}
            selectedIndex={selectedPhotoIndex}
            onSelect={setSelectedPhotoIndex}
          />
        </CardContent>
      </Card>

      {/* Vehicle Details */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Vehicle Details</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
            <DetailRow
              icon={Hash}
              label="VIN"
              value={vehicle.vin}
            />
            <DetailRow
              icon={Palette}
              label="Exterior"
              value={vehicle.exteriorColor ?? '--'}
            />
            <DetailRow
              icon={Palette}
              label="Interior"
              value={vehicle.interiorColor ?? '--'}
            />
            <DetailRow
              icon={Gauge}
              label="Mileage"
              value={
                vehicle.mileage != null
                  ? `${vehicle.mileage.toLocaleString()} mi`
                  : '--'
              }
            />
            <DetailRow
              icon={DollarSign}
              label="Internet Price"
              value={
                vehicle.internetPrice != null
                  ? `$${vehicle.internetPrice.toLocaleString()}`
                  : '--'
              }
            />
            {vehicle.msrp != null && (
              <DetailRow
                icon={DollarSign}
                label="MSRP"
                value={`$${vehicle.msrp.toLocaleString()}`}
              />
            )}
            {vehicle.transmission && (
              <DetailRow
                icon={Truck}
                label="Transmission"
                value={vehicle.transmission}
              />
            )}
            {vehicle.type && (
              <DetailRow
                icon={Car}
                label="Type"
                value={VEHICLE_TYPE_DISPLAY[vehicle.type as VehicleType] ?? vehicle.type}
              />
            )}
            <DetailRow
              icon={MapPin}
              label="Location"
              value={
                vehicle.location?.zone
                  ? vehicle.location.zone
                  : vehicle.location?.parkingSpaceId
                    ? `Space ${vehicle.location.parkingSpaceId}`
                    : '--'
              }
            />
            <DetailRow
              icon={Clock}
              label="Days on Lot"
              value={`${daysOnLot} days`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Activity History
            </h2>
            {vehicleActivities.length > 0 && (
              <Badge variant="default" size="sm">
                {vehicleActivities.length} events
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activitiesLoading ? (
            <div className="flex flex-col gap-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton variant="circle" className="h-8 w-8" />
                  <div className="flex-1 flex flex-col gap-1">
                    <Skeleton variant="text" className="h-4 w-3/4" />
                    <Skeleton variant="text" className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : vehicleActivities.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              No activity history for this vehicle.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-surface-border">
              {vehicleActivities.map((activity) => (
                <ActivityFeedItem
                  key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
                  userName={activity.startedByName}
                  vehicleStockNumber={activity.stockNumber}
                  vehicleYMM={activity.yearMakeModel}
                  activity={activity.state}
                  startedAt={activity.startedAt}
                  endedAt={activity.endedAt}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
