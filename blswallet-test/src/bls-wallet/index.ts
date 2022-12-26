import { Aggregator, BlsWalletWrapper, getConfig, ethers,providers  } from "../../deps.ts";
import networkConfig from "./config/network.ts";

const provider = new providers.JsonRpcProvider('https://goerli.gateway.metisdevops.link/api/rpc/v1');
// const provider = new providers.JsonRpcProvider('http://localhost:8545');

const netCfg = networkConfig;

export default async function testBlsTx(){
    // 32 random bytes
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Note that if a wallet doesn't yet exist, it will be
// lazily created on the first transaction.
    const wallet = await BlsWalletWrapper.connect(
        privateKey,
        netCfg.addresses.verificationGateway,
        provider
    );
    
    const erc20Address = netCfg.addresses.testToken; // Or some other ERC20 token
    const erc20Abi = [
        'function mint(address to, uint amount) returns (bool)',
    ];
    const erc20 = new ethers.Contract(erc20Address, erc20Abi, provider);
    
    console.log('Contract wallet:', wallet.address);
    console.log('Test token:', erc20.address);
    
    const nonce = await wallet.Nonce();
// All of the actions in a bundle are atomic, if one
// action fails they will all fail.
    const bundle = wallet.sign({
        nonce,
        actions: [
            {
                // Mint ourselves one test token
                ethValue: 0,
                contractAddress: erc20.address,
                encodedFunction: erc20.interface.encodeFunctionData(
                    'mint',
                    [wallet.address, ethers.utils.parseUnits('1', 18)],
                ),
            },
        ],
    });
    
    const aggregator = new Aggregator('http://localhost:3000');

    const estimateFeeResult = await aggregator.estimateFee(bundle);
    console.log(estimateFeeResult);

    
    console.log('Sending bundle to the aggregator');
    const addResult = await aggregator.add(bundle);
    
    if ('failures' in addResult) {
        throw new Error(addResult.failures.join('\n'));
    }
    
    console.log('Bundle hash:', addResult.hash);
    
    const checkConfirmation = async () => {
        console.log('Checking for confirmation')
        const maybeReceipt = await aggregator.lookupReceipt(addResult.hash);
        
        if (maybeReceipt === undefined) {
            return;
        }
        
        console.log('Confirmed in block', maybeReceipt.blockNumber);
        provider.off('block', checkConfirmation);
    };
    
    provider.on('block', checkConfirmation);
}
