// FriendsPopulated — the social surface for the dashboard.
// Header → stat strip → controls → Now playing → list (3 col @1440) + activity feed.

function FrHeader({ t }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12, fontFamily: FR_SERIF, fontWeight: 400 }}>
        <span style={{ fontSize: 56, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1 }}>
          Friends<span style={{ fontStyle: 'italic', color: t.ink3 }}>,</span>
        </span>
        <span style={{ fontSize: 22, color: t.ink3, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1 }}>3 online, 2 in-game right now</span>
      </div>
      <div style={{ fontSize: 13, color: t.ink2, fontFamily: FR_MONO, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 12 }}>
        <span>47 friends</span>
        <span style={{ color: t.line2 }}>·</span>
        <span>3 online</span>
        <span style={{ color: t.line2 }}>·</span>
        <span>2 in-game</span>
      </div>
      {/* Stat strip — relational, not competitive */}
      <div style={{
        display: 'flex', gap: 36, padding: '14px 0 0',
        borderTop: `1px solid ${t.line}`, marginTop: 14,
        fontFamily: FR_SANS, fontSize: 13,
      }}>
        {[
          ['Played with', '14', 'friends in 90 days'],
          ['Hours together', '612.4', 'all time'],
          ['Most played with', 'kael', '47.2 h'],
        ].map(([k, v, tail]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{k}</span>
            <span style={{ fontFamily: FR_MONO, fontSize: 14, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            <span style={{ color: t.ink3, fontSize: 12 }}>{tail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrControlsBar({ t }) {
  return (
    <div style={{
      background: t.bg, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`,
      padding: '14px 0', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: t.panel, border: `1px solid ${t.line2}`, borderRadius: 8,
        width: 280, color: t.ink3,
      }}>
        <FRIcon d={FR_ICONS.search} size={14} />
        <span style={{ fontSize: 13, flex: 1, fontStyle: 'italic', fontFamily: FR_SERIF }}>Search friends</span>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        {['Status', 'Played with', 'Owns game'].map(label => (
          <span key={label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 11px 7px 13px',
            color: t.ink2, borderRadius: 999, border: `1px solid ${t.line2}`,
            fontFamily: FR_SANS, fontSize: 13, lineHeight: 1,
          }}>
            <span>{label}</span>
            <FRIcon d={FR_ICONS.chevron} size={12} sw={1.6} />
          </span>
        ))}
      </div>

      {/* Sort */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '7px 12px',
        border: `1px solid ${t.line2}`, borderRadius: 8,
        fontFamily: FR_SANS, fontSize: 13, color: t.ink2,
      }}>
        <span style={{ color: t.ink3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sort</span>
        <span style={{ color: t.ink, fontWeight: 500 }}>Online first</span>
        <FRIcon d={FR_ICONS.chevron} size={12} sw={1.6} />
      </div>
    </div>
  );
}

// ---------- Now playing strip ----------
function FrNowPlayingCard({ f, t }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      border: `1px solid ${t.line2}`, borderRadius: 10,
      background: t.panel, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      {/* ambient color wash from game tone */}
      {f.sessionTone && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 110,
          background: `linear-gradient(270deg, ${f.sessionTone}44 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
      )}
      <FrAvatar persona={f.persona} size={56} t={t} />
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 19, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 5 }}>{f.persona}</div>
        {f.status === 'in-game' ? (
          <div style={{ fontFamily: FR_SANS, fontSize: 12, color: t.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, boxShadow: `0 0 0 2px ${t.accent}22` }} />
            <span><span style={{ color: t.ink, fontWeight: 500 }}>In {f.game}</span> · <span style={{ fontFamily: FR_MONO, fontVariantNumeric: 'tabular-nums' }}>{f.session} session</span></span>
          </div>
        ) : (
          <div style={{ fontFamily: FR_SANS, fontSize: 12, color: t.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.up, boxShadow: `0 0 0 2px ${t.up}22` }} />
            <span>Online <span style={{ color: t.ink3 }}>· last played {f.lastPlay}</span></span>
          </div>
        )}
      </div>
      <span style={{
        position: 'relative',
        padding: '7px 11px', border: `1px solid ${t.line2}`, borderRadius: 7,
        fontFamily: FR_SANS, fontSize: 12, color: t.ink, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 5, background: t.bg,
      }}>
        Compare <FRIcon d={FR_ICONS.arrowUpRight} size={11} sw={1.6} />
      </span>
    </div>
  );
}

function FrNowPlaying({ t }) {
  const F = window.FRIENDS;
  // First 3: kael (in-game), pixelmonk (in-game), voss.exe (online)
  const cards = [F[0], F[1], F[2]];
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
          Now <span style={{ fontStyle: 'italic' }}>playing</span>
          <span style={{ fontFamily: FR_MONO, fontSize: 12, color: t.ink3, marginLeft: 12, fontStyle: 'normal' }}>2 in-game · 1 online</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {cards.map(f => <FrNowPlayingCard key={f.persona} f={f} t={t} />)}
      </div>
    </div>
  );
}

// ---------- Friend tile ----------
function FrFriendTile({ f, t, hovered }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 10, border: `1px solid ${hovered ? t.line2 : t.line}`,
      background: hovered ? t.panel2 : t.panel,
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
      transform: hovered ? 'translateY(-1px)' : 'none', transition: 'transform .2s',
    }}>
      <FrAvatar persona={f.persona} size={56} t={t} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 19, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15, marginBottom: 5 }}>
          {f.persona}
        </div>
        <div style={{ marginBottom: 8, minHeight: 16 }}>
          <FrStatus status={f.status} game={f.game} lastSeen={f.lastSeen} t={t} />
        </div>
        <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span><span style={{ color: t.ink2, fontWeight: 500 }}>{f.hours.toFixed(1)} h</span> together</span>
          <span style={{ color: t.line2 }}>·</span>
          <span>{f.shared} shared</span>
          <span style={{ color: t.line2 }}>·</span>
          <span>since {f.since}</span>
        </div>
      </div>
      <span style={{
        padding: '7px 11px', border: `1px solid ${t.line2}`, borderRadius: 7,
        fontFamily: FR_SANS, fontSize: 12, color: t.ink2, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        background: hovered ? t.bg : 'transparent',
      }}>
        Compare <FRIcon d={FR_ICONS.arrowUpRight} size={11} sw={1.6} />
      </span>
    </div>
  );
}

// ---------- Activity feed ----------
function FrActivityGlyph({ kind, t }) {
  const m = {
    play:  { d: FR_ICONS.play,  color: t.accent },
    ach:   { d: FR_ICONS.check, color: t.up },
    add:   { d: FR_ICONS.plus,  color: t.accent2 },
    mile:  { d: FR_ICONS.dot,   color: t.ink3 },
  }[kind] || { d: FR_ICONS.dot, color: t.ink3 };
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 5,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: m.color, background: `${m.color}1f`, flex: '0 0 auto',
    }}>
      <FRIcon d={m.d} size={10} sw={2} />
    </span>
  );
}

function FrActivityRow({ a, t }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '14px 0', borderTop: `1px solid ${t.line}` }}>
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <FrAvatar persona={a.persona} size={32} t={t} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <FrActivityGlyph kind={a.kind} t={t} />
          <span style={{ fontFamily: FR_SANS, fontSize: 12, color: t.ink2, fontWeight: 500, textTransform: 'capitalize' }}>{a.kind === 'mile' ? 'milestone' : a.kind === 'ach' ? 'achievement' : a.kind}</span>
        </div>
        <div style={{ fontFamily: FR_SERIF, fontSize: 14, color: t.ink, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 500 }}>{a.persona}</span>
          {' '}<span style={{ color: t.ink2 }}>{a.verb}</span>{' '}
          <span style={{ fontStyle: 'italic' }}>{a.obj}</span>
          {a.objIn && <span style={{ color: t.ink2 }}> in <span style={{ fontStyle: 'italic', color: t.ink }}>{a.objIn}</span></span>}
          {a.detail && <span style={{ color: t.ink2, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 12 }}> ({a.detail})</span>}
          {a.tail && <span style={{ color: t.ink2 }}> {a.tail}</span>}
        </div>
        <div style={{ marginTop: 4, fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>{a.when}</div>
      </div>
    </div>
  );
}

function FrActivityFeed({ t }) {
  const A = window.FR_ACTIVITY;
  return (
    <div style={{ width: 280, flex: '0 0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 20, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
          Recent <span style={{ fontStyle: 'italic' }}>activity</span>
        </div>
        <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, marginTop: 2, letterSpacing: '0.04em' }}>Last 24 hours</div>
      </div>
      <div>
        {A.map((a, i) => <FrActivityRow key={i} a={a} t={t} />)}
      </div>
      <div style={{ padding: '14px 0 0', borderTop: `1px solid ${t.line}` }}>
        <span style={{ fontFamily: FR_SANS, fontSize: 12, color: t.accent, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
          View all activity <FRIcon d={FR_ICONS.arrowRight} size={11} />
        </span>
      </div>
    </div>
  );
}

// ---------- Populated frame ----------
function FriendsPopulated({ theme = 'dark' }) {
  const t = FRTokens(theme);
  const F = window.FRIENDS;
  return (
    <div data-screen-label={`Friends populated · ${theme}`} style={{
      width: 1440, minHeight: 1300, background: t.bgGrad, color: t.ink,
      fontFamily: FR_SANS, fontSize: 14, position: 'relative',
    }}>
      <FRAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <FRSidebar t={t} minHeight={1244} />
        <main style={{ flex: 1, padding: '32px 32px 0', minWidth: 0, position: 'relative' }}>
          <FrHeader t={t} />
          <FrControlsBar t={t} />
          <FrNowPlaying t={t} />

          {/* List + activity */}
          <div style={{ display: 'flex', gap: 28 }}>
            {/* friends grid */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FR_SERIF, fontSize: 20, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
                All <span style={{ fontStyle: 'italic' }}>friends</span>
                <span style={{ fontFamily: FR_MONO, fontSize: 12, color: t.ink3, marginLeft: 12, fontStyle: 'normal' }}>9 of 47 shown</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {F.map((f, i) => <FrFriendTile key={f.persona} f={f} t={t} hovered={i === 0} />)}
              </div>
              <div style={{ padding: '24px 4px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FR_SANS, fontSize: 13, color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>Show all 47 friends</span>
                <span style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>38 more</span>
              </div>
            </div>

            <FrActivityFeed t={t} />
          </div>

          {/* Hover caller pointing to kael tile */}
          <div style={{ position: 'absolute', top: 776, left: 12, pointerEvents: 'none' }}>
            <svg width="160" height="80" style={{ overflow: 'visible' }}>
              <path d="M 6 60 C 28 60, 60 16, 138 6" stroke={t.accent} strokeWidth="0.75" fill="none" />
              <circle cx="6" cy="60" r="2.5" fill={t.accent} />
            </svg>
            <div style={{ position: 'absolute', left: 0, top: 70, fontFamily: FR_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase', width: 160, lineHeight: 1.5 }}>
              hover state
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: FR_SERIF, fontSize: 11, marginTop: 2 }}>
                lift 1 px · surface-2 · compare bg
              </div>
            </div>
          </div>

          {/* status caller pointing to voss (online row) */}
          <div style={{ position: 'absolute', top: 776, right: 320, pointerEvents: 'none' }}>
            <svg width="180" height="80" style={{ overflow: 'visible' }}>
              <path d="M 4 6 C 40 6, 110 50, 176 70" stroke={t.accent2} strokeWidth="0.75" fill="none" />
              <circle cx="176" cy="70" r="2.5" fill={t.accent2} />
            </svg>
            <div style={{ position: 'absolute', left: 0, top: -10, fontFamily: FR_MONO, fontSize: 10, color: t.accent2, letterSpacing: '0.06em', textTransform: 'uppercase', width: 180, lineHeight: 1.5 }}>
              status · dot + label
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: FR_SERIF, fontSize: 11, marginTop: 2 }}>
                color is never the only signal
              </div>
            </div>
          </div>
        </main>
      </div>

      <FRSpecStrip t={t} extra="Friend tile · 64 av · status: dot + label · activity 32 av" />
    </div>
  );
}

Object.assign(window, { FriendsPopulated });
