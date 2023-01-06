import { runAggregatorProxy } from "../src";
import dotenv from 'dotenv';
dotenv.config();
const AggregatorUrl:any=process.env.AGGREGATOR_URL
const AggregatorPort:any=process.env.AGGREGATOR_PROXY_PORT
console.log("AGGREGATOR_URL:",process.env.AGGREGATOR_URL)
runAggregatorProxy(
  AggregatorUrl,
  async b => {
    console.log('proxying bundle', JSON.stringify(b, null, 2));
    return b;
  },
  AggregatorPort,
  '0.0.0.0',
  () => {
    console.log('Proxying aggregator on port ', AggregatorPort);
  },
);
