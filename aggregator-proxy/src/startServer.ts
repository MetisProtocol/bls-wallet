import runAggregatorProxy from "./runAggregatorProxy";

const AggregatorPort:any=process.env.AGGREGATOR_PROXY_PORT
runAggregatorProxy(
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
