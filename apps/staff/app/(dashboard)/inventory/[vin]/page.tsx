'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
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
  Play,
  PauseCircle,
  ArrowRightLeft,
  History,
  ShieldCheck,
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
} from '@rally/ui';
import { useToast } from '@rally/ui';
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
import { usePermissionStore } from '@rally/services';

// ---------------------------------------------------------------------------
// Detail Row — reusable key-value row for vehicle details
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
  // Build the ordered photo array: primary first, then remaining
  const allPhotos = useMemo(() => {
    if (photos.length === 0 && primaryPhotoUrl) return [primaryPhotoUrl];
    if (photos.length === 0) return [];
    // If primary is in the array, put it first; otherwise prepend it
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

      {/* Thumbnail strip */}
      {allPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
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
// Hold Info Banner
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
// Smart Actions Card
// ---------------------------------------------------------------------------

function SmartActions({ vehicle }: { vehicle: Vehicle }) {
  const can = usePermissionStore((s) => s.can);

  const canTestDrive = can('canStartTestDrive');
  const canMarkSold = can('canMarkAsSold');
  const canChangeStatus = can('canChangeAnyStatus');
  const canOverrideHold = can('canOverrideHolds');

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-text-primary">Quick Actions</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Start Test Drive */}
          {canTestDrive && vehicle.status === 'frontline' && (
            <Button variant="primary" size="md" className="gap-2">
              <Play className="h-4 w-4" />
              Start Test Drive
            </Button>
          )}

          {/* Place / Release Hold */}
          {vehicle.status === 'frontline' && (
            vehicle.holdInfo ? (
              canOverrideHold ? (
                <Button variant="secondary" size="md" className="gap-2">
                  <PauseCircle className="h-4 w-4" />
                  Release Hold
                </Button>
              ) : null
            ) : (
              <Button variant="secondary" size="md" className="gap-2">
                <PauseCircle className="h-4 w-4" />
                Place Hold
              </Button>
            )
          )}

          {/* Change Status */}
          {canChangeStatus && (
            <Button variant="ghost" size="md" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Change Status
            </Button>
          )}

          {/* Mark as Sold */}
          {canMarkSold && vehicle.status !== 'sold' && vehicle.status !== 'archived' && (
            <Button variant="ghost" size="md" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Mark as Sold
            </Button>
          )}

          {/* View History — always available */}
          <Button variant="ghost" size="md" className="gap-2">
            <History className="h-4 w-4" />
            View History
          </Button>
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
      {/* Back button placeholder */}
      <Skeleton className="h-8 w-36" />

      {/* Hero section */}
      <div className="flex flex-col gap-2">
        <Skeleton variant="stockHero" />
        <Skeleton className="h-7 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Photo placeholder */}
      <Skeleton variant="card" className="aspect-video h-auto w-full" />

      {/* Details card */}
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

      {/* Actions card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicle Detail Page
// ---------------------------------------------------------------------------

export default function VehicleDetailPage() {
  const params = useParams<{ vin: string }>();
  const router = useRouter();
  const { toast } = useToast();

  // Photo gallery state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Firestore real-time document listener
  const { data: vehicle, loading, error } = useVehicle(params.vin);

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

  // Sub-status label
  const subStatusLabel = vehicle.subStatus
    ? VEHICLE_SUB_STATUS_DISPLAY[vehicle.subStatus]
    : null;

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

      {/* Smart Actions */}
      <SmartActions vehicle={vehicle} />
    </div>
  );
}

