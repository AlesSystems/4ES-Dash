// FriendsEmpty — the "friends list empty/private" state.
// Converts dead-end into useful surface via SteamID compare card.

function FrEmptyHeader({ t }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10, fontFamily: FR_SERIF, fontWeight: 400 }}>
        <span style={{ fontSize: 56, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1 }}>
          Friends<span style={{ fontStyle: 'italic', color: t.ink3 }}>,</span>
        </span>
        <span style={{ fontSize: 22, color: t.ink3, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1 }}>your list is empty</span>
      </div>
      <div style={{ fontFamily: FR_SERIF, fontSize: 16, color: t.ink2, lineHeight: 1.5, maxWidth: 720 }}>
        Either you haven't added anyone on Steam, or your privacy setting is hiding the list. 4ES-Dash reads your friends from your public Steam profile.
      </div>
    </div>
  );
}

function FrEmptyComposition({ t, theme }) {
  return (
    <div style={{
      position: 'relative',
      border: `1px dashed ${t.line2}`,
      borderRadius: 14,
      minHeight: 360,
      padding: '40px 32px 36px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(31,26,20,0.015)',
      marginBottom: 22,
    }}>
      {/* Faint oversized ampersand */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%', transform: 'translate(-50%, -56%)',
        fontFamily: FR_SERIF, fontSize: 440, lineHeight: 1, fontWeight: 400,
        color: t.ink, opacity: theme === 'dark' ? 0.045 : 0.06,
        fontStyle: 'italic', letterSpacing: '-0.04em',
        pointerEvents: 'none', userSelect: 'none',
      }}>&amp;</div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 540 }}>
        <div style={{
          fontFamily: FR_SERIF, fontSize: 38, color: t.ink, fontWeight: 400,
          letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14,
        }}>
          No friends to <span style={{ fontStyle: 'italic', color: t.ink2 }}>show yet</span>.
        </div>
        <div style={{
          fontFamily: FR_SERIF, fontSize: 16, color: t.ink2, lineHeight: 1.55,
          marginBottom: 20,
        }}>
          Your Steam friends list is empty, or your privacy settings hide it from the public profile we read.
        </div>
        <div style={{
          fontFamily: FR_MONO, fontSize: 11, color: t.ink3,
          letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', border: `1px solid ${t.line2}`, borderRadius: 999, background: t.bg,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.warn }} />
          Steam → Settings → Privacy → Friends list = <span style={{ color: t.ink, fontWeight: 500 }}>Public</span>
        </div>
      </div>
    </div>
  );
}

function FrCompareByIdCard({ t }) {
  return (
    <div style={{
      border: `1px solid ${t.line}`, borderRadius: 12, background: t.panel,
      padding: '24px 28px 22px', position: 'relative', overflow: 'hidden',
    }}>
      {/* warm wash in the corner — small visual rhythm with the rest of the system */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%',
        background: `${t.accent}14`, filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, position: 'relative' }}>
        <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FR_SANS, fontWeight: 500 }}>
          Or compare by ID
        </div>
        <span style={{ flex: 1, height: 1, background: t.line }} />
      </div>

      <div style={{ position: 'relative', marginTop: 14 }}>
        <div style={{
          fontFamily: FR_SERIF, fontSize: 26, color: t.ink, fontWeight: 400,
          letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8, maxWidth: 600,
        }}>
          You don't need a friend in common to compare libraries.
        </div>
        <div style={{
          fontFamily: FR_SERIF, fontSize: 15, color: t.ink2, lineHeight: 1.5,
          marginBottom: 22, maxWidth: 620,
        }}>
          Paste any SteamID or vanity URL — if the profile is public, we'll line up the libraries side-by-side.
        </div>

        {/* Input + button */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginBottom: 12 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', background: t.bg, border: `1px solid ${t.line2}`, borderRadius: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.line2 }} />
            <span style={{ fontFamily: FR_MONO, fontSize: 13, color: t.ink3, fontStyle: 'italic', flex: 1 }}>
              76561198000000000 <span style={{ color: t.line2 }}>or</span> steamcommunity.com/id/yourfriend
            </span>
            <span style={{ fontFamily: FR_MONO, fontSize: 10, color: t.ink3, padding: '2px 7px', border: `1px solid ${t.line2}`, borderRadius: 4, letterSpacing: '0.04em' }}>↵</span>
          </div>
          <span style={{
            padding: '0 22px', background: t.accent, color: t.accentInk, borderRadius: 8,
            fontSize: 13, fontWeight: 500, fontFamily: FR_SANS,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Compare <FRIcon d={FR_ICONS.arrowRight} size={12} />
          </span>
        </div>

        <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
          public profiles only · private libraries return no data
        </div>
      </div>

      {/* Examples row */}
      <div style={{
        marginTop: 22, paddingTop: 18, borderTop: `1px solid ${t.line}`,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: FR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>Recent compares</span>
        {['gabe', 'forsen', 'JerseyVince'].map(p => (
          <span key={p} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 11px 5px 6px', border: `1px solid ${t.line2}`, borderRadius: 999,
            fontFamily: FR_SANS, fontSize: 12, color: t.ink2,
          }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg, ${t.accent2} 0%, ${t.accent} 100%)`, opacity: 0.6 }} />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function FriendsEmpty({ theme = 'dark' }) {
  const t = FRTokens(theme);
  return (
    <div data-screen-label={`Friends empty · ${theme}`} style={{
      width: 1440, minHeight: 1060, background: t.bgGrad, color: t.ink,
      fontFamily: FR_SANS, fontSize: 14, position: 'relative',
    }}>
      <FRAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <FRSidebar t={t} minHeight={1004} />
        <main style={{ flex: 1, padding: '32px 32px 0', minWidth: 0, position: 'relative' }}>
          <FrEmptyHeader t={t} />
          <FrEmptyComposition t={t} theme={theme} />
          <FrCompareByIdCard t={t} />

          {/* caller pointing at the compare card */}
          <div style={{ position: 'absolute', top: 720, left: -10, pointerEvents: 'none', width: 220 }}>
            <svg width="220" height="80" style={{ overflow: 'visible' }}>
              <path d="M 6 10 C 40 10, 110 50, 216 70" stroke={t.accent2} strokeWidth="0.75" fill="none" />
              <circle cx="216" cy="70" r="2.5" fill={t.accent2} />
            </svg>
            <div style={{ position: 'absolute', left: 0, top: -6, fontFamily: FR_MONO, fontSize: 10, color: t.accent2, letterSpacing: '0.06em', textTransform: 'uppercase', width: 180, lineHeight: 1.5 }}>
              empty → useful
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: FR_SERIF, fontSize: 11, marginTop: 2 }}>
                paste a SteamID; the page still works
              </div>
            </div>
          </div>

          <div style={{ height: 80 }} />
        </main>
      </div>
      <FRSpecStrip t={t} extra="Empty · friends-list-private/empty · SteamID compare card converts the dead-end" />
    </div>
  );
}

Object.assign(window, { FriendsEmpty });
