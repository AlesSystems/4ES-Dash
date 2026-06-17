/**
 * Cost per hour page — /insights/cost-per-hour
 *
 * RSC. Ranked table of paid games by cost/hour, free games section,
 * exclusion counts, and a persistent disclaimer about store prices.
 */

import { getCostPerHour } from '@/server/repositories/insights/cost-per-hour';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { formatHours } from '@/lib/format/playtime';

export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

/** Format cents as currency using Intl.NumberFormat. */
function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    // Fallback for unknown/invalid currency codes
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function CostPerHourPage() {
  const { result, stale } = await getCostPerHour();
  const { ranked, freeGames, excludedNoPlaytime, excludedNoPrice } = result;

  const isEmpty = ranked.length === 0 && freeGames.length === 0;

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Cost per hour</h1>
        <p className="mt-1 text-sm text-text-3">
          How much you&apos;ve paid per hour of playtime, ranked by most expensive.
        </p>
      </div>

      {stale && <StaleBanner className="mb-4" />}

      {/* PERSISTENT price disclaimer — always visible */}
      <div className="mb-6 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <p className="text-sm text-text-2">
          <strong className="font-medium text-text-1">Note:</strong> Prices reflect current store
          prices, not what you paid. Your actual cost may have been different.
        </p>
      </div>

      {isEmpty ? (
        <EmptyState
          title="No cost data yet"
          description="We need both playtime history and store price data to rank your games."
        />
      ) : (
        <div className="space-y-10">
          {/* Ranked paid games table */}
          {ranked.length > 0 && (
            <section aria-labelledby="ranked-heading">
              <h2 id="ranked-heading" className="mb-4 text-h2 font-semibold text-text-1">
                Paid games
              </h2>

              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      <th className="px-4 py-2.5 text-left text-caption font-medium uppercase tracking-widest text-text-3">
                        Game
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        Playtime
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        Price
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        Cost / hr
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((row) => (
                      <tr key={row.appId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-1">{row.name}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-2">
                          {formatHours(row.playtimeHours * 60)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-2">
                          {formatMoney(row.priceCents, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-1">
                          {formatMoney(row.costPerHourCents, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Free-to-play section */}
          {freeGames.length > 0 && (
            <section aria-labelledby="free-heading">
              <h2 id="free-heading" className="mb-4 text-h2 font-semibold text-text-1">
                Free to play
              </h2>

              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      <th className="px-4 py-2.5 text-left text-caption font-medium uppercase tracking-widest text-text-3">
                        Game
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        Playtime
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {freeGames.map((game) => (
                      <tr key={game.appId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-1">{game.name}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-2">
                          {formatHours(game.playtimeMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Exclusion counts */}
          {(excludedNoPrice > 0 || excludedNoPlaytime > 0) && (
            <div className="space-y-1">
              {excludedNoPrice > 0 && (
                <p className="text-caption text-text-3">
                  {excludedNoPrice} {excludedNoPrice === 1 ? 'game' : 'games'} excluded — price
                  unavailable.
                </p>
              )}
              {excludedNoPlaytime > 0 && (
                <p className="text-caption text-text-3">
                  {excludedNoPlaytime} {excludedNoPlaytime === 1 ? 'game' : 'games'} excluded — zero
                  playtime recorded.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
