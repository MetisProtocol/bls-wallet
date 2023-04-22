import { Application, oakCors, sqlite } from "../../deps.ts";

import * as env from "../env.ts";
import EthereumService from "./EthereumService.ts";
import BundleService from "./BundleService.ts";
import BundleRouter from "./BundleRouter.ts";
import AdminRouter from "./AdminRouter.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import Mutex from "../helpers/Mutex.ts";
import Clock from "../helpers/Clock.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable from "./BundleTable.ts";
import AggregationStrategy from "./AggregationStrategy.ts";
import AggregationStrategyRouter from "./AggregationStrategyRouter.ts";

export default async function app(emit: (evt: AppEvent) => void) {

  const clock = Clock.create();

  const bundleTableMutex = new Mutex();

  const bundleTable = new BundleTable(
    new sqlite.DB(env.DB_PATH),
    (sql, params) => {
      if (env.LOG_QUERIES) {
        emit({
          type: "db-query",
          data: { sql, params },
        });
      }
    },
  );

  const ethereumService = await EthereumService.create(
    emit,
    env.ADDRESS.VERIFICATION_GATEWAY,
    env.ADDRESS.UTILITIES,
    env.PRIVATE_KEY_AGG,
  );

  const aggregationStrategy = new AggregationStrategy(
    ethereumService.blsWalletSigner,
    ethereumService,
    AggregationStrategy.defaultConfig,
    emit,
  );

  const bundleService = new BundleService(
    emit,
    clock,
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

    // emit({
    //   type: "request-start",
    //   data: {
    //     method: ctx.request.method,
    //     path: ctx.request.url,
    //   },
    // });

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
    emit({ type: "warning", data: "gasLimit:" +env.GAS_LIMIT  });
    emit({ type: "listening", data: { port: env.PORT } });
  });

  await app.listen({ port: env.PORT });
}
