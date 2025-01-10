require("dotenv").config();

const isMainnet = process.argv[2] == "mainnet";

const chainId = isMainnet ? 1 : 11155111;

const privateKey = isMainnet
  ? process.env.MAINNET_WALLET_PRIVATE_KEY
  : process.env.TESTNET_WALLET_PRIVATE_KEY;

const httpProviderUrl = isMainnet
  ? process.env.MAINNET_NODE_URL
  : process.env.TESTNET_NODE_URL;

const wssProviderUrl = isMainnet
  ? process.env.MAINNET_NODE_URL_WSS
  : process.env.TESTNET_NODE_URL_WSS;

const uniswapUniversalRouterAddress = isMainnet
  ? "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B"
  : "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

const uniswapV2RouterAddress = isMainnet
  ? "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 "
  : "0x89031Ff7240456b4997e367b48eDED3415606e0D";

const wETHAddress = isMainnet
  ? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  : "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

const uniswapV2FactoryAddress = isMainnet
  ? "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  : "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";

const gasBribe = process.env.GAS_BRIBE_IN_GWEI;
const buyAmount = process.env.BUY_AMOUNT_IN_WEI;

export {
  isMainnet,
  chainId,
  privateKey,
  wssProviderUrl,
  httpProviderUrl,
  uniswapUniversalRouterAddress,
  wETHAddress,
  uniswapV2FactoryAddress,
  uniswapV2RouterAddress,
  gasBribe,
  buyAmount,
};
