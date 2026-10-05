import { NavLink, Outlet, useLocation } from "react-router-dom";
import { DASHBOARDS, DOCS_URL } from "../lib/config";

const today = new Date();
const issue = `${today.getUTCFullYear()}·${String(today.getUTCMonth() + 1).padStart(2, "0")}·${String(
  today.getUTCDate(),
).padStart(2, "0")}`;

export function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__kicker">
            <span>
              Free-tier data · DefiLlama + Polymarket + Ethplorer · No keys, no paid APIs
            </span>
            <span className="live" aria-hidden="true">
              ● live queries
            </span>
            <span>Vol. 1 — Issue {issue}</span>
          </div>
          <h1 className="masthead__title">
            ON-CHAIN <em>Ledger</em>
          </h1>
          <div className="masthead__sub">
            <span>Dune-grade analytics on public APIs — methodology mirrors a 6-phase BI engagement.</span>
            <span>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                KPI definitions &amp; QA notes →
              </a>
            </span>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="Dashboards">
        <div className="nav__inner">
          {DASHBOARDS.map((d) => (
            <NavLink
              key={d.slug}
              to={d.slug}
              end={d.slug === "/"}
              className={({ isActive }) => (isActive || (d.slug !== "/" && pathname.startsWith(d.slug)) ? "nav__link active" : "nav__link")}
            >
              <span className="sec">{d.section} ·</span>
              {d.name}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="shell">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>On-Chain Ledger — public portfolio build</span>
          <span>Data: api.llama.fi · coins.llama.fi · stablecoins.llama.fi · gamma-api · ethplorer</span>
          <span>
            Queries &amp; methodology:{" "}
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              repo/docs
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
