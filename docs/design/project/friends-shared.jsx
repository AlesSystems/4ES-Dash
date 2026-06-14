// Friends — shared chrome, tokens, avatars, status, fixtures.
// Extends the Wrapped system from wrapped.jsx + library.jsx.
// Reuses window.WR_TOKENS_LIB for palette continuity.

const FR_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const FR_SANS = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const FR_MONO = `"JetBrains Mono", ui-monospace, monospace`;

function FRTokens(theme) {
  const base = window.WR_TOKENS_LIB[theme];
  // Extend with status colors + warn
  const warn = theme === 'dark' ? '#d9a84a' : '#a87a18';
  return {
    ...base,
    warn,
    // Compare two-color convention: you=cool (accent2), them=warm (accent)
    youColor: base.accent2,
    themColor: base.accent,
    youFill: theme === 'dark' ? 'rgba(126,155,168,0.18)' : 'rgba(62,85,98,0.14)',
    themFill: theme === 'dark' ? 'rgba(232,160,92,0.22)' : 'rgba(184,84,31,0.16)',
  };
}

// ============ ICONS ============
const FR_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  chevron: 'M4 6l4 4 4-4',
  chevronR: 'M6 4l4 4-4 4',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  arrowUpRight: 'M5 11L11 5M6 5h5v5',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  play: 'M4 3v10l9-5z',
  check: 'M3 8l3 3 7-7',
  plus: 'M8 3v10M3 8h10',
  dot: 'M8 7.5h.01',
  x: 'M4 4l8 8M12 4l-8 8',
};

function FRIcon({ d, size = 16, sw = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ============ AVATARS ============
// Invented, non-photographic. Each persona has an .av spec:
//   kind: 'gradient' | 'letterform' | 'geometric' | 'duotone'
//   from, to: hues
//   letter: optional initial (display serif italic)
//
// At small sizes the letter scales with the avatar; gradients reduce to a
// solid disc with a single highlight.

const FR_AVATARS = {
  // YOU (Altan) — cool slate radial (the "you" color)
  altan:       { kind: 'gradient',   from: '#7e9ba8', to: '#2a3a48', letter: null },
  // The nine friends in fixture order
  kael:        { kind: 'gradient',   from: '#f0b66a', to: '#7a2d20', letter: null },
  pixelmonk:   { kind: 'geometric',  from: '#3a4a78', to: '#5fb5b8', letter: null },
  'voss.exe':  { kind: 'letterform', from: '#e8a05c', to: '#8a4318', letter: 'v' },
  salt_breeze: { kind: 'letterform', from: '#8ebbc4', to: '#3a5868', letter: 's' },
  qubit:       { kind: 'gradient',   from: '#a380c4', to: '#3f2a55', letter: null },
  derelict:    { kind: 'duotone',    from: '#a5a380', to: '#4a4a30', letter: null },
  nyx:         { kind: 'letterform', from: '#7a6cb5', to: '#1f1a3a', letter: 'n' },
  mara:        { kind: 'letterform', from: '#e8a8a0', to: '#7a3838', letter: 'm' },
  osprey:      { kind: 'letterform', from: '#d09060', to: '#5a3018', letter: 'o' },
};

function FrAvatar({ persona, size = 64, t }) {
  const a = FR_AVATARS[persona] || FR_AVATARS.altan;
  const id = `av-${persona}-${size}`.replace(/[^a-z0-9-]/gi, '');
  const letterSize = Math.round(size * 0.62);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', borderRadius: '50%', flex: '0 0 auto' }}>
      <defs>
        {a.kind === 'gradient' && (
          <radialGradient id={id} cx="0.32" cy="0.28" r="0.95">
            <stop offset="0%" stopColor={a.from} />
            <stop offset="100%" stopColor={a.to} />
          </radialGradient>
        )}
        {(a.kind === 'letterform' || a.kind === 'duotone') && (
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a.from} />
            <stop offset="100%" stopColor={a.to} />
          </linearGradient>
        )}
        {a.kind === 'geometric' && (
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a.from} />
            <stop offset="100%" stopColor={a.to} />
          </linearGradient>
        )}
        <clipPath id={`${id}-clip`}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width="64" height="64" fill={`url(#${id})`} />

        {a.kind === 'geometric' && (
          <g>
            {/* off-center geometric: half-disc + dot */}
            <path d="M0 0 L64 0 L64 64 L0 64 Z" fill={a.from} />
            <circle cx="42" cy="22" r="30" fill={a.to} opacity="0.9" />
            <circle cx="20" cy="46" r="6" fill={a.from} opacity="0.5" />
          </g>
        )}

        {a.kind === 'duotone' && (
          <g>
            {/* horizontal split — abstract horizon */}
            <rect x="0" y="0" width="64" height="34" fill={a.from} opacity="0.95" />
            <rect x="0" y="34" width="64" height="30" fill={a.to} />
            <circle cx="44" cy="22" r="7" fill={a.from} opacity="0.7" />
          </g>
        )}

        {a.kind === 'gradient' && (
          // subtle ring highlight
          <circle cx="22" cy="20" r="18" fill="white" opacity="0.08" />
        )}

        {a.letter && (
          <text
            x="32" y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={FR_SERIF}
            fontStyle="italic"
            fontWeight="400"
            fontSize={letterSize}
            fill="white"
            opacity="0.92"
            style={{ letterSpacing: '-0.04em' }}
          >{a.letter}</text>
        )}
      </g>
      {/* hairline ring for AA on warm backgrounds */}
      <circle cx="32" cy="32" r="31.5" fill="none" stroke={t.line2} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

// ============ STATUS ============
// Color + label (never color alone).
//   online, in-game, looking, away, offline

function FrStatus({ status, game, lastSeen, t, size = 'md' }) {
  const small = size === 'sm';
  const fontSize = small ? 11 : 12;
  const dot = (color) => (
    <span style={{
      width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: '50%',
      background: color, flex: '0 0 auto',
      boxShadow: status === 'online' || status === 'in-game' ? `0 0 0 2px ${color}22` : 'none',
    }} />
  );

  if (status === 'in-game') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6, fontFamily: FR_SANS, fontSize, color: t.ink, fontWeight: 500 }}>
        {dot(t.accent)}
        <span><span style={{ color: t.ink2, fontWeight: 400 }}>In</span> {game}</span>
      </span>
    );
  }
  if (status === 'online') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6, fontFamily: FR_SANS, fontSize, color: t.ink2, fontWeight: 500 }}>
        {dot(t.up)}<span>Online</span>
      </span>
    );
  }
  if (status === 'looking') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6, fontFamily: FR_SANS, fontSize, color: t.ink2, fontWeight: 500 }}>
        {dot(t.warn)}<span>Looking to play</span>
      </span>
    );
  }
  if (status === 'away') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6, fontFamily: FR_SANS, fontSize, color: t.ink3 }}>
        {dot(t.ink3)}<span>Away</span>
      </span>
    );
  }
  // offline
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FR_SANS, fontSize, color: t.ink3 }}>
      Last seen {lastSeen}
    </span>
  );
}

// ============ FIXTURE ============
window.FRIENDS = [
  { persona: 'kael',        status: 'in-game',  game: 'Helldivers 2',     session: '1h 24m',   hours: 47.2,  shared: 32, since: 2018, sessionTone: '#2a4a6b' },
  { persona: 'pixelmonk',   status: 'in-game',  game: 'Counter-Strike 2', session: '22m',      hours: 124.6, shared: 41, since: 2014, sessionTone: '#3a4250' },
  { persona: 'voss.exe',    status: 'online',                          lastPlay: 'Hades II 3h ago', hours: 38.4, shared: 28, since: 2017 },
  { persona: 'salt_breeze', status: 'looking',                                                hours: 9.4,   shared: 14, since: 2021 },
  { persona: 'qubit',       status: 'away',                                                   hours: 31.7,  shared: 22, since: 2018 },
  { persona: 'derelict',    status: 'offline',  lastSeen: '4h ago',                           hours: 67.8,  shared: 38, since: 2016 },
  { persona: 'nyx',         status: 'offline',  lastSeen: 'yesterday',                        hours: 28.6,  shared: 19, since: 2022 },
  { persona: 'mara',        status: 'offline',  lastSeen: '2 days ago',                       hours: 18.1,  shared: 11, since: 2020 },
  { persona: 'osprey',      status: 'offline',  lastSeen: '3 days ago',                       hours: 12.2,  shared: 9,  since: 2019 },
];

window.FR_ACTIVITY = [
  { kind: 'play',  persona: 'kael',      verb: 'started',  obj: 'Helldivers 2',                  when: '1h ago' },
  { kind: 'ach',   persona: 'pixelmonk', verb: 'unlocked', obj: 'Veteran', objIn: 'Counter-Strike 2', when: '3h ago' },
  { kind: 'add',   persona: 'voss.exe',  verb: 'added',    obj: 'Hades II', tail: 'to their library', when: '5h ago' },
  { kind: 'mile',  persona: 'mara',      verb: 'reached',  obj: '100 hours',  objIn: 'Stardew Valley', when: '8h ago' },
  { kind: 'play',  persona: 'derelict',  verb: 'played',   obj: 'Elden Ring', detail: '3h 12m',     when: '18h ago' },
];

// Compare fixture
window.FR_COMPARE = {
  you:  { persona: 'altan', name: 'Altan',  level: 47, hours: 2847, games: 312, since: 2018 },
  them: { persona: 'kael',  name: 'kael',   level: 32, hours: 1892, games: 187, mutualSince: 2018 },
  sharedCount: 84,
  yourLibPct: 27,
  theirLibPct: 45,
  combinedHours: 1402,
  togetherHours: 47.2,
  shared: [
    { title: 'Counter-Strike 2', you: 612.0, them: 247.2, tone: '#3a4250', art: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=200&h=100&fit=crop' },
    { title: 'RimWorld',         you: 231.0, them: 12.4,  tone: '#4a3a2a', art: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=200&h=100&fit=crop' },
    { title: 'Factorio',         you: 218.4, them: 8.4,   tone: '#3a3a2a', art: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=200&h=100&fit=crop' },
    { title: "Baldur's Gate 3",  you: 142.3, them: 38.4,  tone: '#6b3a2f', art: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=100&fit=crop' },
    { title: 'Stardew Valley',   you: 64.2,  them: 112.0, tone: '#3b5a3b', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=200&h=100&fit=crop' },
    { title: 'Helldivers 2',     you: 47.6,  them: 89.4,  tone: '#2a4a6b', art: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=200&h=100&fit=crop' },
    { title: 'Hades',            you: 56.7,  them: 78.2,  tone: '#5e2a3a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=200&h=100&fit=crop' },
    { title: 'Elden Ring',       you: 89.1,  them: 41.6,  tone: '#5a4828', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=100&fit=crop' },
  ],
  // Genres — share of hours per user (sums roughly to 100)
  genres: [
    { name: 'RPG',       you: 38, them: 31 },
    { name: 'Strategy',  you: 22, them:  9 },
    { name: 'Shooter',   you: 14, them: 34 },
    { name: 'Sim',       you: 12, them:  5 },
    { name: 'Roguelike', you:  8, them: 11 },
    { name: 'Other',     you:  6, them: 10 },
  ],
  // Asymmetric libraries (just 4 each, plus a count)
  inTheirsNotYours: [
    { title: 'Deep Rock Galactic', tone: '#1f3a4a', art: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=300&h=150&fit=crop' },
    { title: 'Hollow Knight',      tone: '#1c2a3a', art: 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?w=300&h=150&fit=crop' },
    { title: 'Inscryption',        tone: '#2a1f1f', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=300&h=150&fit=crop' },
    { title: 'Lethal Company',     tone: '#3a2a1a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=300&h=150&fit=crop' },
  ],
  inYoursNotTheirs: [
    { title: 'Disco Elysium',   tone: '#3a4a4a', art: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=300&h=150&fit=crop' },
    { title: 'Cyberpunk 2077',  tone: '#4a4828', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=300&h=150&fit=crop' },
    { title: 'Subnautica',      tone: '#1f3a4a', art: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=300&h=150&fit=crop' },
    { title: 'Death Stranding', tone: '#2a2e3a', art: 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?w=300&h=150&fit=crop' },
  ],
  moreInTheirs: 23,
  moreInYours: 41,
};

// ============ CHROME ============
function FRAppBar({ t }) {
  const s = window.STEAM;
  return (
    <div style={{
      height: 56, borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
      background: t.bg, position: 'relative', zIndex: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
        </div>
        <span style={{ fontFamily: FR_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
        <span style={{ fontFamily: FR_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, fontFamily: FR_SANS, fontSize: 14 }}>
        {[['Dashboard'], ['Library'], ['Games'], ['Friends', true]].map(([n, active]) => (
          <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
            {n}
            {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
          </span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
        <FRIcon d={FR_ICONS.bell} size={16} />
        <FRIcon d={FR_ICONS.sun} size={16} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
      </div>
    </div>
  );
}

function FRSidebar({ t, minHeight = 1160 }) {
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', minHeight, flex: '0 0 auto' }}>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FR_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          ['dashboard', 'Dashboard', null, false],
          ['library', 'Library', '312', false],
          ['games', 'Recently played', '5', false],
          ['achievements', 'Achievements', '4,128', false],
          ['friends', 'Friends', '47', true],
        ].map(([icon, label, count, active]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
            color: active ? t.ink : t.ink2, background: active ? t.panel : 'transparent',
            fontSize: 14, position: 'relative',
          }}>
            {active && <span style={{ position: 'absolute', left: -18, top: 8, bottom: 8, width: 3, background: t.accent, borderRadius: 2 }} />}
            <FRIcon d={FR_ICONS[icon]} size={16} />
            <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{label}</span>
            {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: FR_MONO }}>{count}</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FR_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Friend lists</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['All', 47], ['Online', 3], ['In-Game', 2], ['Played recently', 14]].map(([l, n]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{l}</span>
            <span style={{ fontSize: 11, color: t.ink3, fontFamily: FR_MONO }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FR_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>This week</div>
      <div style={{ padding: '0 10px', color: t.ink3, fontSize: 12, lineHeight: 1.55, fontFamily: FR_SERIF, fontStyle: 'italic' }}>
        14 of your friends played a game you also own. You shared <span style={{ color: t.ink2, fontStyle: 'normal', fontFamily: FR_MONO, fontSize: 11 }}>11h</span> in co-op this month.
      </div>
    </aside>
  );
}

function FRSpecStrip({ t, extra }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      padding: '12px 32px',
      display: 'flex', gap: 24, flexWrap: 'wrap',
      fontFamily: FR_MONO, fontSize: 10, color: t.ink3,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: t.bg,
    }}>
      <span>body · söhne 14/1.5</span>
      <span>display · source serif 4</span>
      <span>mono · jb mono 12</span>
      <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
      <span>you · <span style={{ color: t.youColor }}>{t.youColor}</span></span>
      <span>them · <span style={{ color: t.themColor }}>{t.themColor}</span></span>
      <span>avatars · invented · gradient + letterform + geometric</span>
      <span style={{ marginLeft: 'auto', color: t.ink2 }}>{extra}</span>
    </div>
  );
}

Object.assign(window, { FRTokens, FR_SERIF, FR_SANS, FR_MONO, FR_ICONS, FRIcon, FrAvatar, FrStatus, FRAppBar, FRSidebar, FRSpecStrip });
