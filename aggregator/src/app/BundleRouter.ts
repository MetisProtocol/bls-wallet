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
      const result = await bundleService.add(bun);
      console.log("add result:",result);
      if ("failures" in result) {
        return failRequest(ctx, result.failures);
      }

      ctx.response.body = result;
    }),
  );

  router.get(
    "bundleReceipt/:hash",
    (ctx) => {
      const bundleRow = bundleService.lookupBundle(ctx.params.hash!);
      // console.log("bundleRow:",bundleRow.submitError)

      if (bundleRow?.receipt === nil) {
        ctx.response.status = 404;
        let errorMsg = bundleRow?.submitError
        if(bundleRow?.status=="failed" && !bundleRow?.submitError  ){
          errorMsg = "nonce is too small."
        }
        ctx.response.body = {
          submitError: errorMsg,
        };
        

        return;
      }

      ctx.response.body = bundleService.receiptFromBundle(bundleRow);
    },
  );

  router.get(
    "tryaggregating",
    (ctx) => {
      bundleService.tryAggregating();
      ctx.response.body = "ok"
    },
  );

  router.get(
    "bundlelist/:limit/:status",
    (ctx) => {
      const data =  bundleService.queryBundle(ctx.params.limit,ctx.params.status);
      console.log("data:",data)
      ctx.response.body =data
    },
  );

  router.get(
    "bundles/clear",
    (ctx) => {
      const data =  bundleService.clearBundle();
      ctx.response.body =data
    },
  );

  router.get(
    "getbundle/:hash",
    (ctx) => {
      const data =  bundleService.getBundle(ctx.params.hash);
      ctx.response.body =data
    },
  );

  router.get('status', async (ctx) => {
    ctx.status = 200;  
    ctx.response.body = 'ok';  
  });

  return router;
}
