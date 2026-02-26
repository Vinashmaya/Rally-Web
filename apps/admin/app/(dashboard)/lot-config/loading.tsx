import { Skeleton } from '@rally/ui';

export default function LotConfigLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
      <div className="flex gap-4" style={{ height: 'calc(100vh - 350px)' }}>
        <Skeleton className="flex-1 rounded-lg" />
        <div className="w-80 space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  );
}
