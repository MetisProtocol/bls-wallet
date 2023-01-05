import { runAggregatorProxy } from "../src";
import networkConfig from "./config";

runAggregatorProxy(
  networkConfig.upstreamAggregatorUrl,
  async b => {
    console.log('proxying bundle', JSON.stringify(b, null, 2));
    return b;
  },
  networkConfig.port,
  '0.0.0.0',
  () => {
    console.log('Proxying aggregator on port ', networkConfig.port);
  },
);
