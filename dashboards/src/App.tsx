import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MarketPulse } from "./pages/MarketPulse";
import { ProtocolOverview } from "./pages/ProtocolOverview";
import { DecisionMarkets } from "./pages/DecisionMarkets";
import { SpotFees } from "./pages/SpotFees";
import { Holders } from "./pages/Holders";
import { Treasury } from "./pages/Treasury";
import { ChainComparison } from "./pages/ChainComparison";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MarketPulse />} />
          <Route path="/protocol" element={<ProtocolOverview />} />
          <Route path="/decision-markets" element={<DecisionMarkets />} />
          <Route path="/spot-fees" element={<SpotFees />} />
          <Route path="/holders" element={<Holders />} />
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/chains" element={<ChainComparison />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
