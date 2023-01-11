#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --unstable

import {
  AggregatorClient,
  delay,
  ethers,
  MockERC20__factory,
} from "../deps.ts";

import getNetworkConfig from "../src/helpers/getNetworkConfig.ts";
import * as env from "../test/env.ts";
import TestBlsWallets from "./helpers/TestBlsWallets.ts";

const { addresses } = await getNetworkConfig();

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const testErc20 = MockERC20__factory.connect(env.ADDRESS.TEST_TOKEN, provider);
const client = new AggregatorClient(env.ORIGIN);

const [wallet] = await TestBlsWallets(provider, 1);
const startBalance = await testErc20.balanceOf(wallet.address);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [{
    ethValue: 0,
    contractAddress: testErc20.address,
    encodedFunction: testErc20.interface.encodeFunctionData(
      "mint",
      [wallet.address, 1],
    ),
  }],
});

// console.log("Calling estimateFee");

// const feeEstimation = await client.estimateFee(bundle);
// console.log({ feeEstimation });

console.log("Sending mint bundle to aggregator");

const res = await client.add(bundle);
if ("failures" in res) {
  throw new Error(res.failures.map((f) => f.description).join(", "));
}

console.log("Success response from aggregator", res.hash);

while (true) {
  const balance = (await testErc20.balanceOf(wallet.address));

  console.log({
    startBalance: startBalance.toString(),
    balance: balance.toString(),
  });

  if (!balance.eq(startBalance)) {
    console.log("done");
    break;
  }

  console.log("Balance has not increased, waiting 500ms");
  await delay(500);
}
