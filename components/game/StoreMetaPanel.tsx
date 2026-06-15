/**
 * StoreMetaPanel — sidebar panel showing store metadata and current price.
 *
 * Props:
 *   metadata  Availability<StoreMetadata>
 *   price     Availability<StorePrice>
 *
 * Degraded state:
 *   - !metadata.available → compact inline "Store metadata unavailable" notice
 *     (UnavailableState with class override to keep it subtle, not full-page)
 *
 * Price degrades silently (no price shown) when !price.available, because
 * the store panel still shows metadata in that case.
 *
 * RSC: pure render, no 'use client'.
 */

import type { Availability } from '@/lib/result';
import type { StoreMetadata, StorePrice } from '@/lib/steam/store-client';
import { UnavailableState } from '@/components/states/UnavailableState';

export interface StoreMetaPanelProps {
  metadata: Availability<StoreMetadata>;
  price: Availability<StorePrice>;
}

// ---------------------------------------------------------------------------
// Chip — small tag for genres / categories
// ---------------------------------------------------------------------------

function Chip({ label }: { label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-sm bg-surface-2 px-2 py-0.5 text-caption text-text-2 border border-border">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Label/value pair
// ---------------------------------------------------------------------------

function MetaRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="text-caption font-medium text-text-3 sm:w-28 sm:shrink-0">{label}</dt>
      <dd className="text-caption text-text-2">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price display
// ---------------------------------------------------------------------------

function PriceDisplay({ price }: { price: Availability<StorePrice> }): JSX.Element | null {
  if (!price.available) {
    return null;
  }
  const display = price.data === null ? 'Free' : price.data.formatted;
  const discount = price.data !== null && price.data.discountPercent > 0;

  return (
    <div className="mt-4 flex items-baseline gap-2">
      <span className="text-h3 font-bold text-text-1 tabular-nums">{display}</span>
      {discount && price.data !== null && (
        <span className="rounded bg-success/20 px-1.5 py-0.5 text-caption font-medium text-success tabular-nums">
          -{price.data.discountPercent}%
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StoreMetaPanel({ metadata, price }: StoreMetaPanelProps): JSX.Element {
  if (!metadata.available) {
    return <UnavailableState reason="metadata-unavailable" className="py-6" />;
  }

  const { shortDescription, genres, categories, developers, publishers, releaseDate, platforms } =
    metadata.data;

  // Build a comma-separated platform string
  const platformList = [
    platforms.windows ? 'Windows' : null,
    platforms.mac ? 'macOS' : null,
    platforms.linux ? 'Linux' : null,
  ]
    .filter((p): p is string => p !== null)
    .join(', ');

  return (
    <section aria-labelledby="store-meta-heading">
      <h2 id="store-meta-heading" className="mb-3 text-h3 font-semibold text-text-1">
        Store info
      </h2>

      {shortDescription.length > 0 && (
        <p className="mb-4 text-body text-text-2 leading-relaxed">{shortDescription}</p>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-caption font-medium text-text-3">Genres</p>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Chip key={g} label={g} />
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-caption font-medium text-text-3">Features</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip key={c} label={c} />
            ))}
          </div>
        </div>
      )}

      {/* Label/value metadata */}
      <dl className="flex flex-col gap-2 border-t border-border pt-4">
        {developers.length > 0 && <MetaRow label="Developer" value={developers.join(', ')} />}
        {publishers.length > 0 && <MetaRow label="Publisher" value={publishers.join(', ')} />}
        {releaseDate !== null && releaseDate.length > 0 && (
          <MetaRow label="Release date" value={releaseDate} />
        )}
        {platformList.length > 0 && <MetaRow label="Platforms" value={platformList} />}
      </dl>

      {/* Price */}
      <PriceDisplay price={price} />
    </section>
  );
}
