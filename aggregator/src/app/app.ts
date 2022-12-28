import { Application, oakCors, SecretsManager } from "../../deps.ts";

import * as env from "../env.ts";
import EthereumService from "./EthereumService.ts";
import BundleService from "./BundleService.ts";
import BundleRouter from "./BundleRouter.ts";
import AdminRouter from "./AdminRouter.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import createQueryClient from "./createQueryClient.ts";
import Mutex from "../helpers/Mutex.ts";
import Clock from "../helpers/Clock.ts";
import getNetworkConfig from "../helpers/getNetworkConfig.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable from "./BundleTable.ts";
import AggregationStrategy from "./AggregationStrategy.ts";
import AggregationStrategyRouter from "./AggregationStrategyRouter.ts";

const init_postgres_config = () => {
  const secretRegion = env.AWS.SECRET_REGION;
  const secretName = env.AWS.SECRET_NAME;
  var secretsManagerClient = new SecretsManager({
    region: secretRegion
  });
  return new Promise((resolve, reject) => {
    secretsManagerClient.getSecretValue({
      SecretId: secretName
    }, function (err, data) {
      if (err) {
        reject(err)
      } else {
        if ('SecretString' in data) {
          let secret = {};            
          secret = JSON.parse(data.SecretString);
          env.PG.HOST = secret.host;
          env.PG.PORT = secret.port;
          env.PG.USER = secret.user;
          env.PG.PASSWORD = secret.password;
          env.PG.DB_NAME = secret.dbname;
        }
        resolve(data);
      }
    })
  });
}

export default async function app(emit: (evt: AppEvent) => void) {
  if(env.PG.HOST == undefined || env.PG.HOST == ''){
    await init_postgres_config();
  }

  const { addresses } = await getNetworkConfig();

  const clock = Clock.create();

  const queryClient = createQueryClient(emit);
  const bundleTableMutex = new Mutex();
  const bundleTable = await BundleTable.create(
    queryClient,
    env.BUNDLE_TABLE_NAME,
  );

  const ethereumService = await EthereumService.create(
    emit,
    addresses.verificationGateway,
    addresses.utilities,
    env.PRIVATE_KEY_AGG,
  );

  const aggregationStrategy = new AggregationStrategy(
    ethereumService.blsWalletSigner,
    ethereumService,
  );

  const bundleService = new BundleService(
    emit,
    clock,
    queryClient,
    bundleTableMutex,
    bundleTable,
    ethereumService.blsWalletSigner,
    ethereumService,
    aggregationStrategy,
  );

  const adminService = new AdminService(
    ethereumService,
    bundleTable,
  );

  const routers = [
    BundleRouter(bundleService),
    AdminRouter(adminService),
    AggregationStrategyRouter(aggregationStrategy),
  ];

  const app = new Application();
  app.use(oakCors()); // Enables CORS for all routes

  app.use(async (ctx, next) => {
    const startTime = Date.now();

    emit({
      type: "request-start",
      data: {
        method: ctx.request.method,
        path: ctx.request.url.pathname,
      },
    });

    await next();

    emit({
      type: "request-end",
      data: {
        method: ctx.request.method,
        path: ctx.request.url.pathname,
        status: ctx.response.status,
        duration: Date.now() - startTime,
      },
    });
  });

  app.use(errorHandler);

  for (const router of routers) {
    app.use(router.routes(), router.allowedMethods());
  }

  app.use(notFoundHandler);

  app.addEventListener("listen", () => {
    emit({ type: "listening", data: { port: env.PORT } });
  });

  await app.listen({ port: env.PORT });
}
