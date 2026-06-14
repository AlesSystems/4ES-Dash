// Library page — extends the Wrapped system.
// Same palette, type system, chart treatment, app bar, sidebar, decorative voice.
// New components: filter chip (active + inactive), tile, segmented sort, view toggle, empty state.

const LB_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const LB_SANS = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const LB_MONO = `"JetBrains Mono", ui-monospace, monospace`;

// Reuse WR_TOKENS shape; add a couple of tile-specific tokens
function LBTokens(theme) {
  const base = window.WR_TOKENS_LIB[theme];
  return base;
}

window.WR_TOKENS_LIB = {
  dark: {
    bg: '#141211',
    bgGrad: 'linear-gradient(180deg, #181513 0%, #141211 100%)',
    panel: '#1c1816',
    panel2: '#221d1a',
    ink: '#f4ece2',
    ink2: '#c8bdb0',
    ink3: '#8b8278',
    line: '#2c2622',
    line2: '#3a322c',
    accent: '#e8a05c',
    accent2: '#7e9ba8',
    accentInk: '#1a120a',
    up: '#7fbf7a',
    down: '#e07b6a',
    pillMutedBg: 'rgba(244,236,226,0.08)',
    pillMutedInk: '#c8bdb0',
    pillSuccessBg: 'rgba(127,191,122,0.15)',
    pillSuccessInk: '#9ed398',
    tileSurface: '#1c1816',
    tileSurfaceHover: '#221d1a',
  },
  light: {
    bg: '#f4ede1',
    bgGrad: 'linear-gradient(180deg, #f7f0e4 0%, #f1eadd 100%)',
    panel: '#fdf8ed',
    panel2: '#f9f1e1',
    ink: '#1f1a14',
    ink2: '#5a4f42',
    ink3: '#8c7f6e',
    line: '#e3d8c4',
    line2: '#cdc0a8',
    accent: '#b8541f',
    accent2: '#3e5562',
    accentInk: '#fff8eb',
    up: '#2f7a34',
    down: '#a8392c',
    pillMutedBg: 'rgba(31,26,20,0.06)',
    pillMutedInk: '#5a4f42',
    pillSuccessBg: 'rgba(47,122,52,0.13)',
    pillSuccessInk: '#2f7a34',
    tileSurface: '#fdf8ed',
    tileSurfaceHover: '#f9f1e1',
  },
};

const LB_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  chevron: 'M4 6l4 4 4-4',
  chevronR: 'M6 4l4 4-4 4',
  x: 'M4 4l8 8M12 4l-8 8',
  grid: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  list: 'M2 4h12M2 8h12M2 12h12',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  check: 'M3 8l3 3 7-7',
  folder: 'M2 4h4l1.5 2H14v8H2z',
};

function LBIcon({ d, size = 16, sw = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// --- Library fixture (12 tiles) ---
const LIB_GAMES = [
  { title: "Baldur's Gate 3",   hours: 142.3, last: 'played today',    pctNum: 78,  ach: '42 of 54',   status: null,          tone: '#6b3a2f', art: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=300&fit=crop' },
  { title: 'Counter-Strike 2',  hours: 612.0, last: 'played 2 days ago', pctNum: 22, ach: '36 of 167', status: null,          tone: '#3a4250', art: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=600&h=300&fit=crop' },
  { title: 'Helldivers 2',      hours: 47.6,  last: 'played 4 days ago', pctNum: 41, ach: '18 of 44',  status: null,          tone: '#2a4a6b', art: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=600&h=300&fit=crop' },
  { title: 'Elden Ring',        hours: 89.1,  last: 'played a week ago', pctNum: 56, ach: '24 of 42',  status: null,          tone: '#5a4828', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=300&fit=crop' },
  { title: 'Factorio',          hours: 218.4, last: 'played 2 weeks ago', pctNum: 88, ach: '36 of 41', status: null,          tone: '#3a3a2a', art: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&h=300&fit=crop' },
  { title: 'Stardew Valley',    hours: 64.2,  last: 'played 3 weeks ago', pctNum: 31, ach: '12 of 40', status: null,          tone: '#3b5a3b', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=600&h=300&fit=crop' },
  { title: 'Hades',             hours: 56.7,  last: 'played 3 months ago', pctNum: 100, ach: '49 of 49', status: 'completed', tone: '#5e2a3a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&h=300&fit=crop' },
  { title: 'RimWorld',          hours: 231.0, last: 'played a month ago', pctNum: 64, ach: '30 of 47',  status: null,          tone: '#4a3a2a', art: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&h=300&fit=crop' },
  { title: 'Disco Elysium',     hours: 38.4,  last: 'played 6 months ago', pctNum: 92, ach: '22 of 24', status: null,          tone: '#3a4a4a', art: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=600&h=300&fit=crop' },
  { title: 'Cyberpunk 2077',    hours: 12.1,  last: 'played a year ago', pctNum: 8, ach: '4 of 57',     status: null,          tone: '#4a4828', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=600&h=300&fit=crop' },
  { title: 'Subnautica',        hours: null,  last: 'never',              pctNum: 0, ach: '0 of 35',    status: 'untouched-2019', tone: '#1f3a4a', art: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=600&h=300&fit=crop' },
  { title: 'Death Stranding',   hours: null,  last: 'never',              pctNum: null, ach: null,      status: 'untouched-2020', tone: '#2a2e3a', art: 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?w=600&h=300&fit=crop' },
];

// ---------------- shared chrome ----------------

function LBAppBar({ t }) {
  const s = window.STEAM;
  return (
    <div style={{
      height: 56, borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
      background: t.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
        </div>
        <span style={{ fontFamily: LB_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
        <span style={{ fontFamily: LB_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, fontFamily: LB_SANS, fontSize: 14 }}>
        {[['Dashboard'], ['Library', true], ['Games'], ['Friends']].map(([n, active]) => (
          <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
            {n}
            {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
          </span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
        <LBIcon d={LB_ICONS.bell} size={16} />
        <LBIcon d={LB_ICONS.sun} size={16} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
      </div>
    </div>
  );
}

function LBSidebar({ t }) {
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', minHeight: 1160 }}>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: LB_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          ['dashboard', 'Dashboard', null, false],
          ['library', 'Library', '312', true],
          ['games', 'Recently played', '5', false],
          ['achievements', 'Achievements', '4,128', false],
          ['friends', 'Friends', '48', false],
        ].map(([icon, label, count, active]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
            color: active ? t.ink : t.ink2, background: active ? t.panel : 'transparent',
            fontSize: 14, position: 'relative',
          }}>
            {active && <span style={{ position: 'absolute', left: -18, top: 8, bottom: 8, width: 3, background: t.accent, borderRadius: 2 }} />}
            <LBIcon d={LB_ICONS[icon]} size={16} />
            <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{label}</span>
            {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: LB_MONO }}>{count}</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: LB_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Collections</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['To finish', 12], ['Co-op queue', 6], ['Cozy', 9], ['Roguelikes', 14]].map(([l, n]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{l}</span>
            <span style={{ fontSize: 11, color: t.ink3, fontFamily: LB_MONO }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: LB_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>This shelf</div>
      <div style={{ padding: '0 10px', color: t.ink3, fontSize: 12, lineHeight: 1.55, fontFamily: LB_SERIF, fontStyle: 'italic' }}>
        178 of your games are untouched. The oldest has been on the shelf since <span style={{ color: t.ink2, fontStyle: 'normal', fontFamily: LB_MONO, fontSize: 11 }}>2019-03-14</span>.
      </div>
    </aside>
  );
}

function LBHeader({ t }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10, fontFamily: LB_SERIF, fontWeight: 400 }}>
            <span style={{ fontSize: 56, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1 }}>
              Library<span style={{ fontStyle: 'italic', color: t.ink3 }}>,</span>
            </span>
            <span style={{ fontSize: 22, color: t.ink3, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1 }}>twelve years in</span>
          </div>
          <div style={{ fontSize: 13, color: t.ink2, fontFamily: LB_MONO, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 12 }}>
            <span>312 games</span>
            <span style={{ color: t.line2 }}>·</span>
            <span>2,847 hours</span>
            <span style={{ color: t.line2 }}>·</span>
            <span>178 unplayed</span>
          </div>
        </div>
      </div>
      {/* Stat strip */}
      <div style={{
        display: 'flex', gap: 28, padding: '14px 0 0',
        borderTop: `1px solid ${t.line}`, marginTop: 14,
        fontFamily: LB_SANS, fontSize: 13,
      }}>
        {[
          ['Completed', '47'],
          ['In progress', '89'],
          ['Untouched', '178'],
          ['Library value', '$4,210'],
        ].map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{k}</span>
            <span style={{ fontFamily: LB_MONO, fontSize: 14, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- controls bar ----------

function LBChip({ label, value, active, t }) {
  if (active) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 6px 6px 12px',
        background: t.accent, color: t.accentInk, borderRadius: 999,
        fontFamily: LB_SANS, fontSize: 13, fontWeight: 500, lineHeight: 1,
        border: `1px solid ${t.accent}`,
      }}>
        <span style={{ opacity: 0.7, fontWeight: 500 }}>{label}:</span>
        <span>{value}</span>
        <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <LBIcon d={LB_ICONS.x} size={9} sw={2} />
        </span>
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px 6px 12px',
      background: 'transparent', color: t.ink2, borderRadius: 999,
      fontFamily: LB_SANS, fontSize: 13, lineHeight: 1,
      border: `1px solid ${t.line2}`,
    }}>
      <span>{label}</span>
      <LBIcon d={LB_ICONS.chevron} size={12} sw={1.6} />
    </span>
  );
}

function LBControlsBar({ t, activeFilters, count, total }) {
  return (
    <div style={{
      position: 'relative',
      background: t.bg,
      borderTop: `1px solid ${t.line}`,
      borderBottom: `1px solid ${t.line}`,
      padding: '14px 0',
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: t.panel, border: `1px solid ${t.line2}`, borderRadius: 8,
          width: 320, color: t.ink3,
        }}>
          <LBIcon d={LB_ICONS.search} size={14} />
          <span style={{ fontSize: 13, flex: 1, fontStyle: 'italic', fontFamily: LB_SERIF }}>Search your library</span>
          <span style={{ fontFamily: LB_MONO, fontSize: 11, padding: '1px 6px', border: `1px solid ${t.line2}`, borderRadius: 4, color: t.ink3 }}>⌘K</span>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {activeFilters.map((f, i) => (
            <LBChip key={`a${i}`} label={f.label} value={f.value} active t={t} />
          ))}
          {['Genre', 'Status', 'Playtime', 'Year owned', 'Achievements'].filter(label => !activeFilters.find(f => f.label === label)).map(label => (
            <LBChip key={label} label={label} t={t} />
          ))}
          {activeFilters.length >= 2 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 10px',
              fontFamily: LB_SANS, fontSize: 12, color: t.ink2, fontWeight: 500,
              borderBottom: `1px solid ${t.line2}`,
              lineHeight: 1, cursor: 'pointer',
            }}>
              Clear all
            </span>
          )}
        </div>

        {/* Sort */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: 'transparent', border: `1px solid ${t.line2}`, borderRadius: 8,
          fontFamily: LB_SANS, fontSize: 13, color: t.ink2,
        }}>
          <span style={{ color: t.ink3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sort</span>
          <span style={{ color: t.ink, fontWeight: 500 }}>Recently played</span>
          <LBIcon d={LB_ICONS.chevron} size={12} sw={1.6} />
        </div>

        {/* View toggle */}
        <div style={{ display: 'inline-flex', padding: 3, background: t.panel, border: `1px solid ${t.line2}`, borderRadius: 8 }}>
          <span style={{ padding: '6px 8px', borderRadius: 5, background: t.ink, color: t.bg, display: 'inline-flex' }}>
            <LBIcon d={LB_ICONS.grid} size={14} />
          </span>
          <span style={{ padding: '6px 8px', borderRadius: 5, color: t.ink3, display: 'inline-flex' }}>
            <LBIcon d={LB_ICONS.list} size={14} />
          </span>
        </div>
      </div>

      {/* count line */}
      <div style={{ marginTop: 12, fontSize: 12, color: t.ink3, fontFamily: LB_MONO, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Showing <span style={{ color: t.ink, fontWeight: 500 }}>{count}</span> of {total}</span>
        {activeFilters.length > 0 && <span style={{ color: t.line2 }}>·</span>}
        {activeFilters.length > 0 && <span>{activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} active</span>}
      </div>
    </div>
  );
}

// ---------- tile ----------

function LBTile({ g, t, theme, hovered }) {
  const isUntouched = g.hours === null;
  const isCompleted = g.pctNum === 100;
  const noAch = g.pctNum === null;
  const barColor = isCompleted ? t.up : t.accent;
  const ownedYear = g.status && g.status.startsWith('untouched-') ? g.status.split('-')[1] : null;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 10,
      border: `1px solid ${hovered ? t.line2 : t.line}`,
      background: hovered ? t.tileSurfaceHover : t.tileSurface,
      overflow: 'hidden',
      transform: hovered ? 'translateY(-2px)' : 'none',
      transition: 'transform .2s',
    }}>
      {/* art */}
      <div style={{
        position: 'relative',
        aspectRatio: '2 / 1',
        background: g.tone,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `url(${g.art}) center/cover`,
          opacity: hovered ? 0.95 : 0.86,
          filter: hovered ? 'saturate(1.06)' : 'none',
          transition: 'opacity .25s, filter .25s',
        }} />
        {/* gradient scrim — top-down, only when a status pill sits on bright art */}
        {g.status && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 50%)`,
            pointerEvents: 'none',
          }} />
        )}
        {/* art-bottom fade into body — the ambient wash bleed */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: -1, height: 14,
          background: `linear-gradient(180deg, transparent 0%, ${g.tone}99 70%, ${g.tone} 100%)`,
          pointerEvents: 'none',
        }} />
        {/* status pill */}
        {g.status === 'completed' && (
          <span style={{
            position: 'absolute', top: 10, right: 10,
            padding: '4px 9px',
            background: t.pillSuccessBg, color: '#ffffff',
            border: `1px solid rgba(255,255,255,0.18)`,
            borderRadius: 999, fontFamily: LB_SANS, fontSize: 11, fontWeight: 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            backdropFilter: 'blur(6px)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <LBIcon d={LB_ICONS.check} size={10} sw={2.2} /> Completed
          </span>
        )}
        {ownedYear && (
          <span style={{
            position: 'absolute', top: 10, right: 10,
            padding: '4px 9px',
            background: 'rgba(0,0,0,0.36)', color: '#f1ebde',
            border: `1px solid rgba(255,255,255,0.16)`,
            borderRadius: 999, fontFamily: LB_SANS, fontSize: 11, fontWeight: 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            backdropFilter: 'blur(6px)',
          }}>
            Untouched · since {ownedYear}
          </span>
        )}
      </div>

      {/* ambient tone wash carried into body */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: 'calc(50% - 8px)', height: 22,
        background: `linear-gradient(180deg, ${g.tone}38 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '14px 16px 16px', position: 'relative' }}>
        {/* title */}
        <div style={{
          fontFamily: LB_SERIF, fontSize: 17, color: t.ink, fontWeight: 500,
          letterSpacing: '-0.01em', lineHeight: 1.2,
          marginBottom: 12,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{g.title}</div>

        {/* hours + last played */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          {isUntouched ? (
            <span style={{ fontFamily: LB_SERIF, fontSize: 22, color: t.ink3, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1 }}>Untouched</span>
          ) : (
            <span style={{ fontFamily: LB_MONO, fontSize: 22, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1, fontWeight: 500 }}>
              {g.hours.toFixed(1)}<span style={{ fontFamily: LB_SERIF, fontSize: 14, color: t.ink3, fontStyle: 'italic', marginLeft: 3, fontWeight: 400 }}>h</span>
            </span>
          )}
          <span style={{ fontFamily: LB_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>{g.last}</span>
        </div>

        {/* achievements */}
        {noAch ? (
          <div style={{ fontFamily: LB_SERIF, fontSize: 12, color: t.ink3, fontStyle: 'italic', height: 16, display: 'flex', alignItems: 'center' }}>
            No achievements
          </div>
        ) : (
          <div>
            <div style={{
              height: 4, borderRadius: 2,
              background: isCompleted ? `${t.up}22` : `${t.accent}1f`,
              overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{ width: `${g.pctNum}%`, height: '100%', background: barColor, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: LB_MONO, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: isCompleted ? t.up : t.ink2, fontWeight: 500 }}>{g.pctNum}%</span>
              <span style={{ color: t.ink3 }}>{g.ach}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Populated frame ----------

function LibraryPopulated({ theme = 'dark' }) {
  const t = LBTokens(theme);
  const activeFilters = [
    { label: 'Status', value: 'In progress' },
    { label: 'Sort', value: 'Recently played' },
  ];
  // Use just two for populated — and one "Sort" treated as a chip isn't right; use two real filters.
  const popFilters = [
    { label: 'Genre', value: 'RPG' },
    { label: 'Status', value: 'In progress' },
  ];

  return (
    <div data-screen-label={`Library populated · ${theme}`} style={{
      width: 1440, minHeight: 1220, background: t.bgGrad, color: t.ink,
      fontFamily: LB_SANS, fontSize: 14, position: 'relative',
    }}>
      <LBAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <LBSidebar t={t} />
        <main style={{ flex: 1, padding: '32px 32px 0', minWidth: 0, position: 'relative' }}>
          <LBHeader t={t} />
          <LBControlsBar t={t} activeFilters={popFilters} count={87} total={312} />

          {/* GRID */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
          }}>
            {LIB_GAMES.map((g, i) => (
              <LBTile key={g.title} g={g} t={t} theme={theme} hovered={i === 0} />
            ))}
          </div>

          {/* Load more */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 0 28px' }}>
            <span style={{
              padding: '10px 22px',
              border: `1px solid ${t.line2}`, borderRadius: 999,
              fontFamily: LB_SANS, fontSize: 13, color: t.ink, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: t.panel,
            }}>
              Load 12 more <LBIcon d={LB_ICONS.chevron} size={12} sw={1.6} />
            </span>
            <span style={{ fontFamily: LB_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>
              12 of 312 · 300 remaining
            </span>
          </div>

          {/* Hover caller pointing to tile #1 */}
          <div style={{ position: 'absolute', top: 470, left: 6, pointerEvents: 'none' }}>
            <svg width="160" height="100" style={{ overflow: 'visible' }}>
              <path d="M 8 60 C 30 60, 70 20, 138 8" stroke={t.accent} strokeWidth="0.75" fill="none" />
              <circle cx="8" cy="60" r="2.5" fill={t.accent} />
            </svg>
            <div style={{ position: 'absolute', left: 0, top: 70, fontFamily: LB_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase', width: 140, lineHeight: 1.5 }}>
              hover state
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: LB_SERIF, fontSize: 11, marginTop: 2 }}>
                lift 2 px · art +6% sat · surface-2
              </div>
            </div>
          </div>

          {/* scrim caller pointing to Hades (tile 7, row 2 col 3) */}
          <div style={{ position: 'absolute', top: 870, right: 270, pointerEvents: 'none' }}>
            <svg width="180" height="80" style={{ overflow: 'visible' }}>
              <path d="M 0 8 C 40 8, 100 40, 178 70" stroke={t.accent2} strokeWidth="0.75" fill="none" />
              <circle cx="178" cy="70" r="2.5" fill={t.accent2} />
            </svg>
            <div style={{ position: 'absolute', left: 0, top: -8, fontFamily: LB_MONO, fontSize: 10, color: t.accent2, letterSpacing: '0.06em', textTransform: 'uppercase', width: 200, lineHeight: 1.5, textAlign: 'left' }}>
              scrim on bright art
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: LB_SERIF, fontSize: 11, marginTop: 2 }}>
                pill stays AA over the image
              </div>
            </div>
          </div>
        </main>
      </div>

      <LBSpecStrip t={t} extra="Tile · 272 × ~272 px · 4 cols at 1440 (3 at 1280)" />
    </div>
  );
}

// ---------- Empty frame ----------

function LibraryEmpty({ theme = 'dark' }) {
  const t = LBTokens(theme);
  const emptyFilters = [
    { label: 'Genre', value: 'Strategy' },
    { label: 'Status', value: 'Untouched' },
    { label: 'Playtime', value: '> 50h' },
  ];
  return (
    <div data-screen-label={`Library empty · ${theme}`} style={{
      width: 1440, minHeight: 1220, background: t.bgGrad, color: t.ink,
      fontFamily: LB_SANS, fontSize: 14, position: 'relative',
    }}>
      <LBAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <LBSidebar t={t} />
        <main style={{ flex: 1, padding: '32px 32px 0', minWidth: 0, position: 'relative' }}>
          <LBHeader t={t} />
          <LBControlsBar t={t} activeFilters={emptyFilters} count={0} total={312} />

          {/* Empty composition occupies the grid area */}
          <div style={{
            position: 'relative',
            border: `1px dashed ${t.line2}`,
            borderRadius: 14,
            minHeight: 540,
            padding: '0 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(31,26,20,0.015)',
          }}>
            {/* Faint oversized 0 in display serif */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%', transform: 'translate(-50%, -54%)',
              fontFamily: LB_SERIF, fontSize: 520, lineHeight: 1, fontWeight: 400,
              color: t.ink, opacity: theme === 'dark' ? 0.04 : 0.05,
              letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none', userSelect: 'none',
            }}>0</div>

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 520 }}>
              <div style={{
                fontFamily: LB_SERIF, fontSize: 38, color: t.ink, fontWeight: 400,
                letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14,
              }}>
                Nothing <span style={{ fontStyle: 'italic', color: t.ink2 }}>matches</span>.
              </div>
              <div style={{
                fontFamily: LB_SERIF, fontSize: 17, color: t.ink2, lineHeight: 1.5,
                marginBottom: 28,
              }}>
                Try removing a filter — <span style={{ color: t.ink, fontStyle: 'italic' }}>Strategy</span> games over <span style={{ fontFamily: LB_MONO, fontSize: 15, fontStyle: 'normal' }}>50 hours</span> that you haven't started yet is a narrow shelf.
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  padding: '10px 18px', background: t.accent, color: t.accentInk,
                  borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: LB_SANS,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>Clear all filters <LBIcon d={LB_ICONS.x} size={11} sw={2} /></span>
                <span style={{
                  padding: '10px 18px', color: t.ink2, fontSize: 13, fontWeight: 500, fontFamily: LB_SANS,
                  borderBottom: `1px solid ${t.line2}`,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  borderRadius: 0,
                }}>Browse all games <LBIcon d={LB_ICONS.chevronR} size={12} sw={1.6} /></span>
              </div>
              <div style={{ marginTop: 26, fontFamily: LB_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
                Showing 0 of 312 games
              </div>
            </div>
          </div>

          {/* spacer to match populated height */}
          <div style={{ height: 240 }} />
        </main>
      </div>

      <LBSpecStrip t={t} extra="Empty state · filter-result, not zero-owned" />
    </div>
  );
}

function LBSpecStrip({ t, extra }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      padding: '12px 32px',
      display: 'flex', gap: 24, flexWrap: 'wrap',
      fontFamily: LB_MONO, fontSize: 10, color: t.ink3,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: t.bg,
    }}>
      <span>body · söhne 14/1.5</span>
      <span>display · source serif 4</span>
      <span>mono · jb mono 12</span>
      <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
      <span>second · <span style={{ color: t.accent2 }}>{t.accent2}</span></span>
      <span>paper · {t.bg}</span>
      <span style={{ marginLeft: 'auto', color: t.ink2 }}>{extra}</span>
    </div>
  );
}

Object.assign(window, { LibraryPopulated, LibraryEmpty });
