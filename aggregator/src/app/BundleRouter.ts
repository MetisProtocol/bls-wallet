import { Router } from "../../deps.ts";
import failRequest from "./helpers/failRequest.ts";
import BundleHandler from "./helpers/BundleHandler.ts";
import nil from "../helpers/nil.ts";

import BundleService from "./BundleService.ts";

export default function BundleRouter(bundleService: BundleService) {
  const router = new Router({ prefix: "/" });

  router.post(
    "bundle",
    BundleHandler(async (ctx, bun) => {
      console.log("bundle=====");
      const result = await bundleService.add(bun);

      if ("failures" in result) {
        return failRequest(ctx, result.failures);
      }

      ctx.response.body = result;
    }),
  );

  router.get(
    "bundleReceipt/:hash",
    async (ctx) => {
      console.log("bundleReceipt=====");
      const pendingBundle = await bundleService.lookupBundle(ctx.params.hash!);
      const receipt = await bundleService.lookupReceipt(ctx.params.hash!);

      if (receipt === nil) {
        ctx.response.status = 404;
        ctx.response.body = {
          submitError: pendingBundle?.submitError,
        };
        return;
      }

      ctx.response.body = receipt;
    },
  );

  router.get('status', async (ctx) => {
    ctx.status = 200;  
    ctx.response.body = 'ok';  
  });

  return router;
}
