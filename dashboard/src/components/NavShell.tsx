import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/masterclass', label: 'Masterclass', icon: '🎓' },
  { to: '/marketing', label: 'Marketing', icon: '📈' },
  // { to: '/granular-view', label: 'Granular View', icon: '📋' }, // Hidden for now - can re-enable if needed
]

export function NavShell() {
  return (
    <div className="min-h-screen bg-fa-bg">
      <header className="sticky top-0 z-10 border-b border-fa-border bg-fa-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="whitespace-nowrap text-xl font-black italic tracking-tight text-fa-text">
              FREEDOM <span className="text-fa-accent">ACADEMY</span>
            </span>
            <span
              className="whitespace-nowrap rounded-full border border-fa-neon/40 bg-fa-neon/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fa-neon"
              title="Meta Ads, GHL pipeline/attendance, and the two Google Sheets are pulled directly into these JSON files each sync — no BigQuery, no Apps Script. See README."
            >
              Live · Direct Sync
            </span>
          </div>
          <nav className="flex items-center gap-1 rounded-xl border border-fa-border bg-fa-surface p-1">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'border-fa-accent/34 bg-fa-surface-2 text-fa-text'
                    : 'border-transparent text-fa-text-dim hover:text-fa-text')
                }
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
