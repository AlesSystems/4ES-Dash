import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';

export interface GameTileProps {
  name: string;
  headerUrl: string;
  playtimeMinutes: number;
}

export function GameTile({ name, headerUrl, playtimeMinutes }: GameTileProps): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <Image
        src={headerUrl}
        alt={name}
        width={460}
        height={215}
        sizes="(max-width: 640px) 100vw, 320px"
        className="h-auto w-full object-cover"
      />
      <div className="p-3 flex flex-col gap-0.5">
        <p className="text-body font-medium text-text-1 truncate">{name}</p>
        <p className="text-caption text-text-3 tabular-nums">{formatHours(playtimeMinutes)}</p>
      </div>
    </div>
  );
}
