import http from 'http';

import { Bundle } from 'bls-wallet-clients';
import AggregatorProxyCallback from './AggregatorProxyCallback';

export default function runAggregatorProxy(
  bundleTransformer: (clientBundle: Bundle) => Bundle | Promise<Bundle>,
  port?: number,
  hostname?: string,
  listeningListener?: () => void,
) {
  const server = http.createServer(
    AggregatorProxyCallback(bundleTransformer),
  );

  server.listen(port, hostname, listeningListener);

  return server;
}
