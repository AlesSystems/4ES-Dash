// Settings page — assembles all sections + state variants (default, dirty, modal).

function SecAccount({ t }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={1} id="account" title="Account" subtitle="Your Steam connection and identity." />
      <div style={{ marginTop: 16 }}>
        <Row t={t}
          label="Steam ID"
          helper="Your 17-digit Steam ID. This cannot be changed."
          control={<ReadOnlyValue t={t} mono>76561198047382910</ReadOnlyValue>}
        />
        <Row t={t}
          label="Vanity URL"
          helper={<span>Used to resolve <span style={{ fontFamily: ST_MONO, fontSize: 12, color: t.ink2 }}>steamcommunity.com/id/&lt;vanity&gt;</span>. Sourced from your Steam profile.</span>}
          control={<ReadOnlyValue t={t} mono>altanesmer</ReadOnlyValue>}
        />
        <Row t={t}
          label="Profile visibility"
          helper="4ES-Dash can only read data your Steam profile makes public."
          control={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                height: 40, padding: '0 14px',
                background: t.panel, border: `1px solid ${t.line}`, borderRadius: 6,
                fontFamily: ST_SANS, fontSize: 14, color: t.ink,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.up }} />
                Public
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: ST_SANS, fontSize: 13, color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>
                Manage on Steam <STIcon d={ST_ICONS.external} size={11} />
              </span>
            </div>
          }
        />
        <Row t={t}
          label="Re-sync from Steam"
          helper="Pulls fresh profile, owned games, and recent playtime. Snapshots are unaffected."
          control={<BtnSecondary t={t}>Re-sync now</BtnSecondary>}
          status="Last synced 4 minutes ago"
        />
      </div>
    </section>
  );
}

function SecAppearance({ t, dirty }) {
  // dirty.theme: if set, that value is the "edited" active label
  const themeActive = dirty && dirty.theme ? dirty.theme : 'Dark';
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={2} id="appearance" title="Appearance" subtitle="How 4ES-Dash looks. Choices persist on this device." />
      <div style={{ marginTop: 16 }}>
        <Row t={t}
          dirty={!!(dirty && dirty.theme)}
          label="Theme"
          helper="Light mode is paper-warm. Dark mode is the default."
          control={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <Segmented t={t} options={['System', 'Light', 'Dark']} active={themeActive} />
              {dirty && dirty.theme && (
                <span style={{ fontFamily: ST_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  preview after save
                </span>
              )}
            </div>
          }
        />
        <Row t={t}
          label="Reduce motion"
          helper="Disables non-essential animations. Defaults to your system setting."
          control={<Segmented t={t} options={['System', 'Off', 'On']} active="System" />}
        />
        <Row t={t}
          label="Density"
          helper="Comfortable adds breathing room. Compact fits more on screen."
          control={<Segmented t={t} options={['Comfortable', 'Compact']} active="Comfortable" />}
        />
        <Row t={t}
          label="Number formatting"
          helper="Affects how large hour counts are displayed across the app."
          control={<Segmented t={t} options={['1,234.5 h', '1.2k h']} active="1,234.5 h" />}
        />
      </div>
    </section>
  );
}

function SecData({ t }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={3} id="data" title="Data & sync" subtitle="Snapshots, caching, and how often 4ES-Dash talks to Steam." />
      <div style={{ marginTop: 16 }}>
        <Row t={t}
          label="Nightly snapshot"
          helper="Captures playtime and achievement counts for trend charts."
          control={<ReadOnlyValue t={t}>Daily at <span style={{ fontFamily: ST_MONO, color: t.ink, paddingLeft: 4 }}>04:00 UTC</span></ReadOnlyValue>}
          status="Next run in 12 hours"
        />
        <Row t={t}
          label="Cache refresh"
          helper="Pulls fresh data for the current session. Does not affect snapshots."
          control={<BtnSecondary t={t}>Refresh cached data</BtnSecondary>}
          status="Cache age: 4 minutes"
        />
        <Row t={t}
          label="Snapshot history"
          helper="Days of historical data stored. Older snapshots are kept."
          control={<ReadOnlyValue t={t} mono>87 days · 12.4 MB on disk</ReadOnlyValue>}
        />
        <Row t={t}
          label="Force re-fetch"
          helper="Bypasses the cache and re-pulls every endpoint from Steam. Use sparingly — counts against your Steam API rate limit."
          control={<BtnGhost t={t}>Force re-fetch all</BtnGhost>}
        />
      </div>
    </section>
  );
}

function SecNotifications({ t, dirty }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={4} id="notifications" title="Notifications" subtitle="Optional. Off by default. Browser notifications only — no email, no push." />
      <div style={{ marginTop: 16 }}>
        <Row t={t}
          dirty={!!(dirty && dirty.achievements)}
          label="Achievement unlocks"
          helper="Notify when a new achievement is detected during a snapshot."
          control={<Toggle t={t} on={dirty && dirty.achievements ? true : false} />}
        />
        <Row t={t}
          label="Backlog reminders"
          helper="A weekly summary of how long your oldest unplayed game has been waiting."
          control={<Toggle t={t} on={false} />}
        />
        <Row t={t}
          label="Weekly recap"
          helper="A short Monday summary of last week's hours and unlocks."
          control={<Toggle t={t} on={true} />}
        />
      </div>
    </section>
  );
}

function SecPrivacy({ t }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={5} id="privacy" title="Privacy" subtitle="4ES-Dash is single-user and runs locally. Nothing is shared until you share it." />
      <div style={{ marginTop: 16 }}>
        <Row t={t}
          label="Anonymize exports"
          helper="Replace your persona name and SteamID with a placeholder in exported files."
          control={<Toggle t={t} on={false} />}
        />
        <Row t={t}
          label="Telemetry"
          helper="4ES-Dash collects no telemetry. This setting exists for clarity."
          control={
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 40, padding: '0 14px',
              background: 'transparent', border: `1px solid ${t.line}`, borderRadius: 6,
              fontFamily: ST_SANS, fontSize: 14, color: t.ink2,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.ink3 }} />
              Disabled · <span style={{ fontFamily: ST_MONO, fontSize: 12, color: t.ink3 }}>always</span>
            </span>
          }
        />
      </div>
    </section>
  );
}

function SecExport({ t }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={6} id="export" title="Export" subtitle="Take your data with you." />
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <BtnSecondary t={t}>Export library as JSON</BtnSecondary>
          <BtnSecondary t={t}>Export library as CSV</BtnSecondary>
          <BtnSecondary t={t}>Export Year in Review as PDF</BtnSecondary>
        </div>
        <div style={{ marginTop: 14, fontFamily: ST_SANS, fontSize: 13, color: t.ink3, lineHeight: 1.5 }}>
          Exports include only public Steam data and your locally captured snapshots.
        </div>
      </div>
    </section>
  );
}

function DangerRow({ t, label, helper, action }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: 32, alignItems: 'center',
      padding: '18px 20px',
      borderTop: `1px solid ${t.dangerHairline}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: ST_SANS, fontSize: 14, color: t.ink, fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: ST_SANS, fontSize: 13, color: t.ink3, lineHeight: 1.5, maxWidth: 460 }}>{helper}</div>
      </div>
      <BtnDanger t={t}>{action}</BtnDanger>
    </div>
  );
}

function SecDanger({ t }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionHead t={t} num={7} id="danger" title="Danger zone" subtitle="These actions cannot be undone." />
      <div style={{
        marginTop: 20,
        border: `1px solid ${t.dangerHairline}`,
        background: t.dangerWash,
        borderRadius: 8,
      }}>
        <div style={{
          padding: '12px 20px',
          fontFamily: ST_MONO, fontSize: 10,
          color: t.danger, letterSpacing: '0.16em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <STIcon d={ST_ICONS.warn} size={12} sw={1.6} />
          Irreversible actions
        </div>
        <DangerRow t={t}
          label="Clear cache"
          helper="Removes all cached Steam data. Snapshots are preserved. Next page load will refetch."
          action="Clear cache"
        />
        <DangerRow t={t}
          label="Delete snapshot history"
          helper="Permanently deletes 87 days of captured playtime and achievement snapshots. Trend charts will be empty until new snapshots accumulate."
          action="Delete history"
        />
        <DangerRow t={t}
          label="Disconnect Steam"
          helper="Removes your Steam connection. All local data (snapshots, cache, settings) is deleted from this installation."
          action="Disconnect"
        />
      </div>
    </section>
  );
}

function SecAbout({ t }) {
  const rows = [
    ['Version', <span style={{ fontFamily: ST_MONO, fontVariantNumeric: 'tabular-nums' }}>v0.3.1</span>],
    ['Released', <span>April 28, 2026</span>],
    ['Source', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: ST_MONO }}>github.com/4es-dash/4es-dash</span><STIcon d={ST_ICONS.external} size={11} /></span>],
    ['License', <span style={{ fontFamily: ST_MONO }}>MIT</span>],
  ];
  return (
    <section style={{ marginBottom: 12 }}>
      <SectionHead t={t} num={8} id="about" title="About" subtitle="What you're running." />
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'baseline' }}>
              <span style={{ fontFamily: ST_SANS, fontSize: 13, color: t.ink3 }}>{k}</span>
              <span style={{ fontFamily: ST_SANS, fontSize: 14, color: t.ink2 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 18 }}>
          {['Documentation', 'Report an issue', 'Changelog'].map(l => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ST_SANS, fontSize: 13, color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>
              {l} <STIcon d={ST_ICONS.external} size={11} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----- Save bar -----

function SaveBar({ t, count }) {
  return (
    <div style={{
      position: 'absolute', left: 240, right: 0, bottom: 0,
      height: 64, background: t.bg,
      borderTop: `1px solid ${t.line2}`,
      display: 'flex', alignItems: 'center',
      padding: '0 40px',
      zIndex: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />
        <span style={{ fontFamily: ST_SANS, fontSize: 14, color: t.ink2 }}>
          <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums', fontFamily: ST_MONO, fontSize: 13 }}>{count}</span>
          {'  unsaved changes'}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BtnGhost t={t}>Discard</BtnGhost>
        <BtnPrimary t={t}>Save changes</BtnPrimary>
      </div>
    </div>
  );
}

// ----- Confirmation modal -----

function DeleteModal({ t }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: t.scrim,
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10,
    }}>
      <div style={{
        width: 480, background: t.bg,
        border: `1px solid ${t.line}`, borderRadius: 12,
        boxShadow: t.bg === '#141211'
          ? '0 24px 60px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)'
          : '0 24px 60px rgba(40,28,12,0.22), 0 2px 8px rgba(40,28,12,0.10)',
        padding: '32px 32px 24px',
        position: 'relative',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: t.dangerWash, border: `1px solid ${t.dangerHairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.danger, marginBottom: 18,
        }}>
          <STIcon d={ST_ICONS.warn} size={18} sw={1.6} />
        </div>
        <h3 style={{
          margin: 0, fontFamily: ST_SERIF, fontSize: 24, fontWeight: 400,
          color: t.ink, letterSpacing: '-0.015em', lineHeight: 1.15,
        }}>
          Delete <span style={{ fontVariantNumeric: 'tabular-nums' }}>87</span> days of <span style={{ fontStyle: 'italic', color: t.ink2 }}>snapshot history</span>?
        </h3>
        <p style={{
          marginTop: 14, marginBottom: 0,
          fontFamily: ST_SANS, fontSize: 14, color: t.ink2, lineHeight: 1.55,
        }}>
          This permanently deletes all captured playtime and achievement snapshots. Your trend charts will be empty until new snapshots accumulate.
        </p>

        <div style={{ marginTop: 24 }}>
          <label style={{ display: 'block', fontFamily: ST_SANS, fontSize: 13, color: t.ink3, marginBottom: 8 }}>
            Type <span style={{ fontFamily: ST_MONO, color: t.ink2 }}>"delete"</span> to confirm
          </label>
          <div style={{
            height: 40, padding: '0 12px',
            background: t.panel, border: `1.5px solid ${t.accent}`,
            borderRadius: 6, display: 'flex', alignItems: 'center',
            boxShadow: `0 0 0 3px ${t.accent}22`,
          }}>
            <span style={{ fontFamily: ST_MONO, fontSize: 14, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>delete</span>
            <span style={{ width: 1.5, height: 16, background: t.accent, marginLeft: 1, opacity: 0.9 }} />
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <BtnGhost t={t}>Cancel</BtnGhost>
          <BtnDanger t={t}>Delete history</BtnDanger>
        </div>
        <div style={{
          marginTop: 14, fontFamily: ST_MONO, fontSize: 11,
          color: t.ink3, letterSpacing: '0.08em', textTransform: 'uppercase',
          textAlign: 'right',
        }}>
          This cannot be undone
        </div>
      </div>
    </div>
  );
}

// ----- Annotations (callers) -----

function StickyCaller({ t, x, y }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, pointerEvents: 'none',
      zIndex: 2,
    }}>
      <svg width="160" height="50" style={{ overflow: 'visible' }}>
        <path d="M 8 25 L 150 25" stroke={t.accent} strokeWidth="0.75" fill="none" strokeDasharray="3,3" />
        <circle cx="8" cy="25" r="2.5" fill={t.accent} />
        <path d="M 146 21 L 152 25 L 146 29" stroke={t.accent} strokeWidth="0.75" fill="none" />
      </svg>
      <div style={{
        position: 'absolute', left: 0, top: 32,
        fontFamily: ST_MONO, fontSize: 10, color: t.accent,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        sticks to viewport
        <span style={{ display: 'block', color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: ST_SERIF, fontSize: 11, marginTop: 2 }}>
          while you scroll the main column
        </span>
      </div>
    </div>
  );
}

// ----- Spec strip -----

function SettingsSpecStrip({ t, label, theme }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      padding: '14px 32px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      fontFamily: ST_MONO, fontSize: 10, color: t.ink3,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: t.bg,
    }}>
      <span>body · söhne 14 / 1.5</span>
      <span>mono · jb mono 12</span>
      <span>base · 14 px</span>
      <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
      <span>toggle · {t.panel2} / {t.accent}</span>
      <span>input border · {t.line}</span>
      <span>danger · <span style={{ color: t.danger }}>{t.danger}</span></span>
      <span>modal scrim · {t.scrim}</span>
    </div>
  );
}

// ----- Main page component -----

function SettingsPage({ theme = 'dark', state = 'default' }) {
  const t = STTokens(theme);
  const isDirty = state === 'dirty';
  const isModal = state === 'modal';

  // In the dirty state, the user has flipped the theme (still rendering in current saved theme).
  // dark frame: switched to Light (so Light is shown as active in segmented)
  // light frame: switched to Dark (so Dark is shown as active)
  const dirtyState = isDirty
    ? { theme: theme === 'dark' ? 'Light' : 'Dark', achievements: true }
    : null;

  // Slight bottom padding for save bar
  const bottomPad = isDirty ? 96 : 40;

  // Modal state — focused view: show the page header + danger zone (the section
  // the user clicked from), dimmed, with the modal centered.
  if (isModal) {
    return (
      <div data-screen-label={`Settings · ${theme} · ${state}`} style={{
        width: 1440, background: t.bgGrad, color: t.ink,
        fontFamily: ST_SANS, fontSize: 14, position: 'relative',
        overflow: 'hidden',
      }}>
        <STAppBar t={t} />
        <div style={{ display: 'flex', position: 'relative', height: 980 }}>
          <STSidebar t={t} />
          <main style={{ flex: 1, padding: '36px 40px 40px 40px', position: 'relative' }}>
            <div style={{ marginBottom: 28, maxWidth: 960 }}>
              <div style={{ fontFamily: ST_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
                Settings
              </div>
              <h1 style={{
                margin: 0, fontFamily: ST_SERIF, fontSize: 40, fontWeight: 400,
                color: t.ink, letterSpacing: '-0.022em', lineHeight: 1.05,
              }}>
                Your <span style={{ fontStyle: 'italic', color: t.ink2 }}>preferences</span>.
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 40, position: 'relative' }}>
              <STLeftRail t={t} active="danger" />
              <div style={{ width: 720, flexShrink: 0 }}>
                <SecDanger t={t} />
              </div>
              <div style={{ flex: 1 }} />
            </div>
          </main>
        </div>
        <DeleteModal t={t} />
        <SettingsSpecStrip t={t} theme={theme} />
      </div>
    );
  }

  return (
    <div data-screen-label={`Settings · ${theme} · ${state}`} style={{
      width: 1440, background: t.bgGrad, color: t.ink,
      fontFamily: ST_SANS, fontSize: 14, position: 'relative',
      minHeight: 3650,
    }}>
      <STAppBar t={t} />

      <div style={{ display: 'flex', position: 'relative' }}>
        <STSidebar t={t} />

        {/* Inner content area */}
        <main style={{ flex: 1, padding: `36px 40px ${bottomPad}px 40px`, position: 'relative' }}>
          {/* Page header */}
          <div style={{ marginBottom: 32, maxWidth: 960 }}>
            <div style={{ fontFamily: ST_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
              Settings
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
              <h1 style={{
                margin: 0, fontFamily: ST_SERIF, fontSize: 40, fontWeight: 400,
                color: t.ink, letterSpacing: '-0.022em', lineHeight: 1.05,
              }}>
                Your <span style={{ fontStyle: 'italic', color: t.ink2 }}>preferences</span>.
              </h1>
              <span style={{ fontFamily: ST_MONO, fontSize: 12, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>
                signed in as <span style={{ color: t.ink2 }}>altanesmer</span>
              </span>
            </div>
            <div style={{ marginTop: 14, fontFamily: ST_SERIF, fontStyle: 'italic', fontSize: 17, color: t.ink2, lineHeight: 1.5, maxWidth: 640 }}>
              Once a month, find what you need, change it, close the tab. We kept the page short on opinions.
            </div>
          </div>

          {/* Two-column layout: section nav + main column + right whitespace */}
          <div style={{ display: 'flex', gap: 40, position: 'relative' }}>
            <STLeftRail t={t} active="account" />

            <div style={{ width: 720, flexShrink: 0, position: 'relative' }}>
              <SecAccount t={t} />
              <SecAppearance t={t} dirty={dirtyState} />
              <SecData t={t} />
              <SecNotifications t={t} dirty={dirtyState} />
              <SecPrivacy t={t} />
              <SecExport t={t} />
              <SecDanger t={t} />
              <SecAbout t={t} />
            </div>

            {/* right margin — intentional whitespace */}
            <div style={{ flex: 1 }} />

            {/* Sticky behavior caller — only on default state */}
            {state === 'default' && (
              <StickyCaller t={t} x={-150} y={460} />
            )}
          </div>
        </main>
      </div>

      {/* Save bar overlay */}
      {isDirty && <SaveBar t={t} count={2} />}

      {/* Spec strip */}
      <SettingsSpecStrip t={t} theme={theme} />
    </div>
  );
}

Object.assign(window, { SettingsPage });
