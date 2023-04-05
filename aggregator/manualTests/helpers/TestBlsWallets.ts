import { BlsWalletWrapper, ethers } from "../../deps.ts";

import * as env from "../../test/env.ts";
import AdminWallet from "../../src/chain/AdminWallet.ts";
import Range from "../../src/helpers/Range.ts";
import Rng from "../../src/helpers/Rng.ts";

export default async function TestBlsWallets(
  provider: ethers.providers.Provider,
  count: number,
) {

  const parent = AdminWallet(provider);
  const rng = Rng.root.seed(env.PRIVATE_KEY_ADMIN, env.TEST_BLS_WALLETS_SECRET);

  const wallets = await Promise.all(
    Range(count).map(async (i) => {
      const secret = rng.seed(`${i}`).address();
      return await BlsWalletWrapper.connect(
        secret,
        env.ADDRESS.VERIFICATION_GATEWAY,
        parent.provider,
      );
    }),
  );
  return wallets;
}
