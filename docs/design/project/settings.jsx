// Settings — extends the Wrapped system from wrapped.jsx + library.jsx.
// Establishes the form-element language: input, toggle, segmented, save bar,
// danger card, destructive modal. Density up, voice down. Reuses WR_TOKENS_LIB.

const ST_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const ST_SANS  = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const ST_MONO  = `"JetBrains Mono", ui-monospace, monospace`;

// Extend base tokens with danger language used only on this page.
function STTokens(theme) {
  const base = window.WR_TOKENS_LIB[theme];
  const danger = theme === 'dark'
    ? { danger: '#d36a58', dangerInk: '#1a0e0a', dangerHairline: 'rgba(211,106,88,0.32)', dangerWash: 'rgba(211,106,88,0.05)' }
    : { danger: '#a8392c', dangerInk: '#fff8eb', dangerHairline: 'rgba(168,57,44,0.28)', dangerWash: 'rgba(168,57,44,0.04)' };
  const scrim = theme === 'dark' ? 'rgba(10,8,7,0.62)' : 'rgba(45,32,18,0.36)';
  return { ...base, ...danger, scrim };
}

const ST_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  external: 'M9 3h4v4M13 3L7 9M11 8v4H3V4h4',
  warn: 'M8 2l6 11H2zM8 6v3M8 11.5v.01',
  check: 'M3 8l3 3 7-7',
  settings: 'M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12.5 9.5l1.5.8-1 1.7-1.7-.6a4 4 0 0 1-1.5.9L9.5 14h-3l-.3-1.7a4 4 0 0 1-1.5-.9l-1.7.6-1-1.7L3.5 9.5a4 4 0 0 1 0-3L2 5.7l1-1.7 1.7.6a4 4 0 0 1 1.5-.9L6.5 2h3l.3 1.7a4 4 0 0 1 1.5.9l1.7-.6 1 1.7L12.5 6.5a4 4 0 0 1 0 3z',
};

function STIcon({ d, size = 16, sw = 1.5, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

// ----- App chrome (matches Wrapped / Year in Review) -----

function STAppBar({ t }) {
  const s = window.STEAM;
  return (
    <div style={{
      height: 56, borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
      background: t.bg, position: 'relative', zIndex: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
        </div>
        <span style={{ fontFamily: ST_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
        <span style={{ fontFamily: ST_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, fontFamily: ST_SANS, fontSize: 14 }}>
        {[['Dashboard', true], ['Library'], ['Games'], ['Friends']].map(([n, active]) => (
          <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
            {n}
            {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
          </span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: t.panel, border: `1px solid ${t.line}`, borderRadius: 999, width: 280, color: t.ink3 }}>
        <STIcon d={ST_ICONS.search} size={14} />
        <span style={{ fontSize: 13, flex: 1, fontStyle: 'italic', fontFamily: ST_SERIF }}>Search your library</span>
        <span style={{ fontFamily: ST_MONO, fontSize: 11, padding: '1px 6px', border: `1px solid ${t.line2}`, borderRadius: 4 }}>⌘K</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
        <STIcon d={ST_ICONS.bell} size={16} />
        <STIcon d={ST_ICONS.sun} size={16} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
      </div>
    </div>
  );
}

function STSidebar({ t }) {
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', flexShrink: 0 }}>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: ST_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          ['dashboard', 'Dashboard', null],
          ['library', 'Library', '312'],
          ['games', 'Recently played', '5'],
          ['achievements', 'Achievements', '4,128'],
          ['friends', 'Friends', '48'],
        ].map(([icon, label, count]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
            color: t.ink2, fontSize: 14,
          }}>
            <STIcon d={ST_ICONS[icon]} size={16} />
            <span style={{ flex: 1 }}>{label}</span>
            {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: ST_MONO }}>{count}</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: ST_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Account</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
          color: t.ink, background: t.panel, fontSize: 14, fontWeight: 500, position: 'relative',
        }}>
          <span style={{ position: 'absolute', left: -18, top: 8, bottom: 8, width: 3, background: t.accent, borderRadius: 2 }} />
          <STIcon d={ST_ICONS.settings} size={16} />
          <span style={{ flex: 1 }}>Settings</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: ST_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Collections</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['To finish', 12], ['Co-op queue', 6], ['Cozy', 9], ['Roguelikes', 14]].map(([l, n]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{l}</span>
            <span style={{ fontSize: 11, color: t.ink3, fontFamily: ST_MONO }}>{n}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ----- Left rail: in-page section nav -----

const SECTIONS = [
  ['account', 'Account'],
  ['appearance', 'Appearance'],
  ['data', 'Data & sync'],
  ['notifications', 'Notifications'],
  ['privacy', 'Privacy'],
  ['export', 'Export'],
  ['danger', 'Danger zone'],
  ['about', 'About'],
];

function STLeftRail({ t, active = 'account', danger = false }) {
  return (
    <nav style={{ width: 220, flexShrink: 0, paddingTop: 4 }}>
      <div style={{ fontFamily: ST_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0 0 16px', fontWeight: 500 }}>
        Settings
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {SECTIONS.map(([id, label]) => {
          const isActive = id === active;
          const isDanger = id === 'danger';
          return (
            <a key={id} href={`#${id}`} style={{
              display: 'flex', alignItems: 'center', gap: 0,
              padding: '8px 0 8px 14px',
              color: isActive ? t.ink : (isDanger ? t.ink2 : t.ink2),
              fontSize: 14, fontFamily: ST_SANS,
              fontWeight: isActive ? 500 : 400,
              textDecoration: 'none',
              borderLeft: `2px solid ${isActive ? t.accent : 'transparent'}`,
              marginLeft: -2,
            }}>
              {label}
            </a>
          );
        })}
      </div>
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${t.line}`, fontSize: 12, color: t.ink3, fontFamily: ST_SANS, lineHeight: 1.5 }}>
        Changes apply only to <span style={{ color: t.ink2 }}>this device</span> unless noted.
      </div>
    </nav>
  );
}

// ----- Form elements -----

function ReadOnlyValue({ t, mono, children, suffix }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      height: 40, padding: '0 14px',
      background: t.panel, border: `1px solid ${t.line}`, borderRadius: 6,
      fontFamily: mono ? ST_MONO : ST_SANS, fontSize: 14, color: t.ink2,
      fontVariantNumeric: 'tabular-nums', minWidth: 240,
    }}>
      <span style={{ flex: 1 }}>{children}</span>
      {suffix && <span style={{ color: t.ink3, fontSize: 12, fontFamily: ST_MONO }}>{suffix}</span>}
    </div>
  );
}

function InlineReadOnly({ t, mono, children }) {
  return (
    <span style={{
      fontFamily: mono ? ST_MONO : ST_SANS, fontSize: 14, color: t.ink,
      fontVariantNumeric: 'tabular-nums',
    }}>{children}</span>
  );
}

function Toggle({ t, on }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 999,
      background: on ? t.accent : t.panel2,
      border: `1px solid ${on ? t.accent : t.line2}`,
      position: 'relative', display: 'inline-block',
      transition: 'background .15s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 17 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: on ? '#ffffff' : t.ink3,
        transition: 'left .15s',
      }} />
    </div>
  );
}

function Segmented({ t, options, active }) {
  return (
    <div style={{
      display: 'inline-flex', border: `1px solid ${t.line}`,
      borderRadius: 6, padding: 2, background: t.bg,
    }}>
      {options.map(opt => {
        const isActive = opt === active;
        return (
          <span key={opt} style={{
            padding: '6px 14px',
            fontFamily: ST_SANS, fontSize: 13,
            color: isActive ? t.ink : t.ink2,
            fontWeight: isActive ? 500 : 400,
            background: isActive ? t.panel : 'transparent',
            border: isActive ? `1px solid ${t.line}` : '1px solid transparent',
            borderRadius: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>{opt}</span>
        );
      })}
    </div>
  );
}

function BtnPrimary({ t, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 16px', borderRadius: 6,
      background: t.accent, color: t.accentInk,
      fontFamily: ST_SANS, fontSize: 13, fontWeight: 500,
      border: '1px solid transparent',
    }}>{children}</span>
  );
}

function BtnSecondary({ t, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 14px', borderRadius: 6,
      background: t.panel, color: t.ink,
      fontFamily: ST_SANS, fontSize: 13, fontWeight: 500,
      border: `1px solid ${t.line2}`,
    }}>{children}</span>
  );
}

function BtnGhost({ t, children, external }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 12px', borderRadius: 6,
      background: 'transparent', color: t.ink2,
      fontFamily: ST_SANS, fontSize: 13, fontWeight: 500,
      border: `1px solid ${t.line}`,
    }}>
      {children}
      {external && <STIcon d={ST_ICONS.external} size={12} />}
    </span>
  );
}

function BtnDanger({ t, children, disabled }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 16px', borderRadius: 6,
      background: disabled ? 'transparent' : t.danger,
      color: disabled ? t.ink3 : t.dangerInk,
      fontFamily: ST_SANS, fontSize: 13, fontWeight: 500,
      border: disabled ? `1px solid ${t.line}` : `1px solid ${t.danger}`,
      opacity: disabled ? 0.85 : 1,
    }}>{children}</span>
  );
}

// ----- Setting row -----

function Row({ t, label, helper, control, status, dirty }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: 32, alignItems: 'start',
      padding: '20px 0',
      borderTop: `1px solid ${t.line}`,
    }}>
      <div style={{ minWidth: 0, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {dirty && <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent, flexShrink: 0 }} />}
          <span style={{ fontFamily: ST_SANS, fontSize: 14, color: t.ink, fontWeight: 500 }}>{label}</span>
          {dirty && <span style={{ fontFamily: ST_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>· edited</span>}
        </div>
        <div style={{ fontFamily: ST_SANS, fontSize: 13, color: t.ink3, lineHeight: 1.5, maxWidth: 460 }}>
          {helper}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {control}
        {status && (
          <div style={{ fontFamily: ST_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Section heading -----

function SectionHead({ t, num, title, subtitle, id }) {
  return (
    <div id={id} style={{ paddingTop: 8, paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
        <span style={{ fontFamily: ST_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>
          {String(num).padStart(2, '0')}
        </span>
        <h2 style={{
          margin: 0, fontFamily: ST_SERIF, fontSize: 26, fontWeight: 400,
          color: t.ink, letterSpacing: '-0.015em', lineHeight: 1.1,
        }}>{title}</h2>
      </div>
      <div style={{ fontFamily: ST_SANS, fontSize: 13, color: t.ink3, paddingLeft: 32 }}>
        {subtitle}
      </div>
    </div>
  );
}

Object.assign(window, {
  STTokens, ST_ICONS, ST_SERIF, ST_SANS, ST_MONO,
  STIcon, STAppBar, STSidebar, STLeftRail,
  ReadOnlyValue, InlineReadOnly, Toggle, Segmented,
  BtnPrimary, BtnSecondary, BtnGhost, BtnDanger,
  Row, SectionHead,
});
