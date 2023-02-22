import http from 'http';

import { Bundle } from 'bls-wallet-clients';
import AggregatorProxyCallback from './AggregatorProxyCallback';

export default function runAggregatorProxy(
  upstreamAggregatorUrl: string,
  verificationGatewayUrl: string,
  jsonRpcUrl: string,
  port?: number,
  hostname?: string,
  listeningListener?: () => void,
) {
  const server = http.createServer(
    AggregatorProxyCallback(upstreamAggregatorUrl, verificationGatewayUrl, jsonRpcUrl),
  );

  server.listen(port, hostname, listeningListener);

  return server;
}
