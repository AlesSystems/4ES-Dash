import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';

export interface GameTileProps {
  name: string;
  headerUrl: string;
  playtimeMinutes: number;
}

export function GameTile({ name, headerUrl, playtimeMinutes }: GameTileProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* Enforce a 2:1 box so the loaded image matches loading.tsx's skeleton — no CLS. */}
      <div className="relative aspect-[2/1] w-full">
        <Image
          src={headerUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p className="text-body font-medium text-text-1 truncate">{name}</p>
        <p className="text-caption text-text-3 tabular-nums">{formatHours(playtimeMinutes)}</p>
      </div>
    </div>
  );
}
