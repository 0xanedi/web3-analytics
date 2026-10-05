import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="page-head rise rise-1">
      <div className="page-head__eyebrow">ERR · 404</div>
      <h1 className="page-head__title">
        Page not <em>found</em>
      </h1>
      <p className="page-head__desc">
        This ledger page does not exist. Return to the <Link to="/">Market Pulse</Link>.
      </p>
    </div>
  );
}
