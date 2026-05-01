'use client';

// Cross-tenant vehicle detail (Super Admin only).
//
// Route: /vehicles/[groupId]/[vin]
//
// "groupId" here is the vehicle's dealershipId (the store ID under
// groups/{groupId}/stores/{storeId}). Vehicles live at top-level
// `vehicles/{vin}` and are scoped by `dealershipId`. We pass that to
// `useVehicle` so the listener returns null if the vehicle moved tenants.

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  MapPin,
  Clock,
  Gauge,
  Palette,
  DollarSign,
  Tag,
  Hash,
  Truck,
  CarFront,
  Building2,
  AlertTriangle,
  User,
  Calendar,
  Play,
  ShieldAlert,
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
  EmptyState,
  useToast,
} from '@rally/ui';
import {
  useVehicle,
  VEHICLE_CONDITION_DISPLAY,
  VEHICLE_TYPE_DISPLAY,
  VEHICLE_SUB_STATUS_DISPLAY,
  type Vehicle,
  type VehicleStatus,
  type VehicleCondition,
  type VehicleType,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Detail Row
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
// Photo Gallery
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
      <div className="relative aspect-video w-full overflow-hidden rounded-rally-lg bg-surface-overlay">
        {activeUrl && (
          <Image
            src={activeUrl}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 66vw"
            priority
          />
        )}
      </div>

      {allPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allPhotos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-rally transition-all ${
                i === selectedIndex
                  ? 'ring-2 ring-rally-gold ring-offset-2 ring-offset-surface-base'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={url}
                alt={`${alt} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hold Banner
// ---------------------------------------------------------------------------

function HoldBanner({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.holdInfo) return null;

  const expiresAt = vehicle.holdInfo.expiresAt;
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

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
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-44" />

      <div className="flex flex-col gap-2">
        <Skeleton variant="stockHero" />
        <Skeleton className="h-7 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
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
// Page
// ---------------------------------------------------------------------------

export default function AdminVehicleDetailPage() {
  const params = useParams<{ groupId: string; vin: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const groupId = decodeURIComponent(params.groupId ?? '');
  const vin = decodeURIComponent(params.vin ?? '');

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Real-time, tenant-scoped read. If the doc's dealershipId !== groupId,
  // useVehicle returns null — the empty state below handles it.
  const { data: vehicle, loading, error } = useVehicle(vin || undefined, groupId || undefined);

  useEffect(() => {
    if (error) {
      toast({
        type: 'error',
        title: 'Failed to load vehicle',
        description: error.message,
      });
    }
  }, [error, toast]);

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [vin]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/vehicles')}
          className="self-start gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vehicles
        </Button>

        <EmptyState
          icon={ShieldAlert}
          title="Vehicle not found"
          description={
            vin
              ? `No vehicle with VIN ${vin} belongs to tenant ${groupId}. It may have been archived, moved, or you have the wrong tenant scope.`
              : 'Missing VIN in the URL.'
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/vehicles')}
            >
              Back to all vehicles
            </Button>
          }
        />
      </div>
    );
  }

  const ymm = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const ymmFull = vehicle.trim ? `${ymm} ${vehicle.trim}` : ymm;
  const daysOnLot = vehicle.daysOnLot ?? 0;
  const subStatusLabel = vehicle.subStatus
    ? VEHICLE_SUB_STATUS_DISPLAY[vehicle.subStatus]
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top bar — back + tenant badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/vehicles')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vehicles
        </Button>

        <div className="inline-flex items-center gap-2 rounded-full border border-rally-gold/30 bg-rally-goldMuted/40 px-3 py-1">
          <Building2 className="h-3.5 w-3.5 text-rally-gold" />
          <span className="text-xs font-medium uppercase tracking-wider text-rally-gold">
            Tenant
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-text-primary">
            {vehicle.dealershipId}
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-2">
        <StockHero stockNumber={vehicle.stockNumber} />
        <h1 className="text-xl font-semibold text-text-primary">{ymmFull}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={vehicle.status as VehicleStatus} />
          {subStatusLabel && (
            <Badge variant="default" size="sm">
              {subStatusLabel}
            </Badge>
          )}
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

      {/* Hold banner */}
      <HoldBanner vehicle={vehicle} />

      {/* Photos */}
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

      {/* Details */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Vehicle Details</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
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
            <DetailRow
              icon={Hash}
              label="VIN"
              value={vehicle.vin}
            />
            <DetailRow
              icon={Building2}
              label="Dealership ID"
              value={vehicle.dealershipId}
            />
            {vehicle.condition && (
              <DetailRow
                icon={Tag}
                label="Condition"
                value={VEHICLE_CONDITION_DISPLAY[vehicle.condition as VehicleCondition] ?? vehicle.condition}
              />
            )}
            {vehicle.type && (
              <DetailRow
                icon={CarFront}
                label="Type"
                value={VEHICLE_TYPE_DISPLAY[vehicle.type as VehicleType] ?? vehicle.type}
              />
            )}
            {vehicle.transmission && (
              <DetailRow
                icon={Truck}
                label="Transmission"
                value={vehicle.transmission}
              />
            )}
            <DetailRow
              icon={Play}
              label="Test Drives"
              value={`${vehicle.testDriveCount}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Read-only notice — admin view does not perform tenant-side actions */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-text-tertiary mt-0.5" />
            <p className="text-xs text-text-tertiary">
              Super Admin read-only view. Tenant staff perform inventory actions
              (test drive, hold, status change) from their own portal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
