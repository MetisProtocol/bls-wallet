#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import {
  BlsWalletWrapper,
  ethers,
  VerificationGateway__factory,
  Wallet,
} from "../deps.ts";
import * as env from "../src/env.ts";

const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
const wallet = new Wallet(env.PRIVATE_KEY_AGG, provider);


const vg = VerificationGateway__factory.connect(
  env.ADDRESS.VERIFICATION_GATEWAY,
  wallet,
);

const internalBlsWallet = await BlsWalletWrapper.connect(
  env.PRIVATE_KEY_AGG,
  env.ADDRESS.VERIFICATION_GATEWAY,
  provider,
);

console.log("Connected internal wallet:", internalBlsWallet.address);

const nonce = await internalBlsWallet.Nonce();

if (!nonce.eq(0)) {
  console.log("Already exists with nonce", nonce.toNumber());
} else {
  await (await vg.processBundle(internalBlsWallet.sign({
    nonce: 0,
    actions: [],
  }))).wait();

  console.log("Created successfully");
}
