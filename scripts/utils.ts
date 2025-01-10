import { BigNumber, ethers } from "ethers";
import uniswapFactoryByteCode from "../bytecode/uniswapV2FactoryByteCode";
import erc20ByteCode from "../bytecode/erc20ByteCode";
import UniswapV2FactoryAbi from "../abi/UniswapV2Factory.json";
import UniswapV2RouterAbi from "../abi/UniswapV2Router.json";
import UniswapV3Pool from "../abi/UniswapV3Pool.json";
import Erc20Abi from "../abi/ERC20.json";
import {
  gasBribe,
  buyAmount,
  httpProviderUrl,
  privateKey,
  uniswapV2RouterAddress,
  uniswapV2FactoryAddress,
} from "../constants";
import DecodedTransactionProps from "../types/DecodedTransactionProps";
import PairProps from "../types/PairProps";
import AmountsProps from "../types/AmountsProps";

const provider = ethers.getDefaultProvider(httpProviderUrl);
const signer = new ethers.Wallet(privateKey!, provider);

const uniswapV2Router = new ethers.Contract(
  uniswapV2RouterAddress,
  UniswapV2RouterAbi
  // signer
);

const uniswapV3Factory = new ethers.Contract(
  uniswapV2FactoryAddress,
  UniswapV2FactoryAbi,
  signer
);

const erc20Factory = new ethers.ContractFactory(
  Erc20Abi,
  erc20ByteCode,
  signer
);

const getPair = async (token1: string, token2: string, fee: number) => {
  const pairFactory = new ethers.ContractFactory(
    UniswapV2FactoryAbi,
    uniswapFactoryByteCode,
    signer
  );
  console.log(fee, uniswapV2FactoryAddress, token1, token2);

  const pairAddress = await uniswapV3Factory.getPool(token1, token2, fee);

  try {
    // console.log(pairAddress);
    const uniswapV3Pool = new ethers.Contract(
      pairAddress,
      UniswapV3Pool,
      provider
    );

    const liquidity = await uniswapV3Pool.liquidity();
    const slot0 = await uniswapV3Pool.slot0();

    const sqrtPriceX96 = slot0[0];

    const amountToken0 = liquidity
      .mul(sqrtPriceX96)
      .div(ethers.BigNumber.from(2).pow(96));
    const amountToken1 = liquidity
      .mul(ethers.BigNumber.from(2).pow(96))
      .div(sqrtPriceX96);

    // console.log(amountToken0, amountToken1);

    // const pair = pairFactory.attach(pairAddress);
    // const reserves = await pair.getReserves();
    return { token0: amountToken0, token1: amountToken1 };
  } catch (e) {
    return;
  }
};

const decodeSwap = async (input: string) => {
  const abiCoder = new ethers.utils.AbiCoder();
  const decodedParameters = abiCoder.decode(
    ["address", "uint256", "uint256", "bytes", "bool"],
    input
  );
  // process.exit(1);
  const sub = input.substring(2).match(/.{1,64}/g);

  let path: string[] = [];
  let fee;
  let hasTwoPath = true;
  if (!sub) return;
  if (sub.length != 9) {
    // const pathOne = "0x" + sub[sub.length - 2].substring(24);
    // const pathTwo = "0x" + sub[sub.length - 1].substring(24);
    const pathOne = "0x" + decodedParameters[3].substring(2, 42);
    fee = ethers.BigNumber.from("0x" + decodedParameters[3].substring(42, 48));
    const pathTwo = "0x" + decodedParameters[3].substring(48);
    path = [pathOne, pathTwo];
  } else {
    hasTwoPath = false;
  }

  return {
    recipient: parseInt(decodedParameters[0]),
    amountIn: decodedParameters[1],
    minAmountOut: decodedParameters[2],
    path,
    hasTwoPath,
    fee,
  };
};

const getAmountOut = (
  amountIn: BigNumber,
  reserveIn: BigNumber,
  reserveOut: BigNumber
) => {
  const amountInWithFee = amountIn.mul(997); // Uniswap fee of 0.3%
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  const amountOut = numerator.div(denominator);
  return amountOut;
};

const getAmounts = (
  decoded: DecodedTransactionProps,
  pairs: PairProps
): AmountsProps | undefined => {
  const { transaction, amountIn, minAmountOut } = decoded;
  const { token0, token1 } = pairs;

  const maxGasFee = transaction.maxFeePerGas
    ? transaction.maxFeePerGas.add(gasBribe ?? 0)
    : BigNumber.from(gasBribe);

  const priorityFee = transaction.maxPriorityFeePerGas
    ? transaction.maxPriorityFeePerGas.add(gasBribe ?? 0)
    : BigNumber.from(gasBribe);

  let firstAmountOut = getAmountOut(BigNumber.from(buyAmount), token0, token1);
  const updatedReserveA = token0.add(buyAmount!);
  const updatedReserveB = token1.add(firstAmountOut.mul(997).div(1000));

  let secondBuyAmount = getAmountOut(
    amountIn,
    updatedReserveA,
    updatedReserveB
  );

  if (secondBuyAmount.lt(minAmountOut)) return;
  const updatedReserveA2 = updatedReserveA.add(amountIn);
  const updatedReserveB2 = updatedReserveB.add(
    secondBuyAmount.mul(997).div(1000)
  );

  let thirdAmountOut = getAmountOut(
    firstAmountOut,
    updatedReserveB2,
    updatedReserveA2
  );

  return {
    maxGasFee,
    priorityFee,
    firstAmountOut,
    secondBuyAmount,
    thirdAmountOut,
  };
};

export { getPair, decodeSwap, getAmounts, uniswapV2Router, erc20Factory };
