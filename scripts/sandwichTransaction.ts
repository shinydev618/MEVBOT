import { Transaction, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import DecodedTransactionProps from "../types/DecodedTransactionProps";
import { uniswapV2Router, getAmounts, getPair, erc20Factory } from "./utils";
import { chainId, httpProviderUrl, privateKey, buyAmount } from "../constants";
import AmountsProps from "../types/AmountsProps";
import Erc20Abi from "../abi/ERC20.json";

const provider = ethers.getDefaultProvider(httpProviderUrl);
const signer = new ethers.Wallet(privateKey!, provider);
const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour from now

const sandwichTransaction = async (
  decoded: DecodedTransactionProps | undefined
): Promise<boolean> => {
  // console.log(decoded);
  if (!decoded) return false;
  // console.log(decoded.path, decoded.transaction.from, decoded.fee);
  const pairs = await getPair(
    decoded.path[0],
    decoded.path[1],
    Number(decoded.fee)
  );
  if (!pairs) return false;
  const amounts = getAmounts(decoded, pairs);
  if (!amounts) return false;
  // console.log("amount", amounts);

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signer,
    "https://relay-sepolia.flashbots.net",
    "sepolia"
  );

  // const approveTx = await approve(decoded, amounts);
  // console.log("start");
  // await approve();
  // console.log("end");

  // 1. Swap ETH for tokens
  // const t1 = await firstTransaction(decoded, amounts);

  // console.log(t1);

  // 2. Wrap target transacton
  const t2 = secondTransaction(decoded.transaction);

  // 3. Approve UniswapV2Router to spend token
  const t3 = await thirdTransaction(decoded, amounts);

  // 4. Swap tokens for ETH
  const t4 = await forthTransaction(decoded, amounts);

  // Sign sandwich transaction
  const bundle = await signBundle([t2, t3, t4], flashbotsProvider);

  // Finally try to get sandwich transaction included in block
  const result = await sendBundle(bundle, flashbotsProvider);

  if (result) console.log("bundle: ", bundle);

  return result ?? false;
};

const approve = async () => {
  const tokenContract = new ethers.Contract(
    "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    Erc20Abi,
    signer
  );

  try {
    const balance = await tokenContract.balanceOf(signer.address);
    // Call the `approve` function
    const tx = await tokenContract.approve(
      "0x89031Ff7240456b4997e367b48eDED3415606e0D",
      balance
    );
    console.log("Approval transaction sent. Waiting for confirmation...");
    await tx.wait(); // Wait for the transaction to be mined
    console.log(`Transaction successful: ${tx.hash}`);
  } catch (error) {
    console.error("Error approving tokens:", error);
  }
};

const firstTransaction = async (
  decoded: DecodedTransactionProps,
  amounts: AmountsProps
) => {
  const transaction = await uniswapV2Router.connect(signer).exactInputSingle(
    {
      tokenIn: decoded.path[0],
      tokenOut: decoded.path[1],
      fee: Number(decoded.fee),
      recipient: signer.address,
      deadline,
      amountIn: buyAmount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    },
    {
      value: "0",
      type: 2,
      maxFeePerGas: amounts.maxGasFee,
      maxPriorityFeePerGas: amounts.priorityFee,
      gasLimit: 300000,
    }
  );

  let firstTransaction = {
    signer: signer,
    transaction: transaction,
  };

  firstTransaction.transaction = {
    ...firstTransaction.transaction,
    chainId,
  };
  console.log("first");
  return firstTransaction;
};

const secondTransaction = (transaction: Transaction) => {
  const victimsTransactionWithChainId = {
    //@ts-expect-error
    chainId,
    ...transaction,
  };
  let signedMiddleTransaction;

  try {
    signedMiddleTransaction = {
      signedTransaction: ethers.utils.serializeTransaction(
        victimsTransactionWithChainId,
        {
          r: victimsTransactionWithChainId.r!,
          s: victimsTransactionWithChainId.s,
          v: victimsTransactionWithChainId.v,
        }
      ),
    };
  } catch (error: any) {
    console.log("Error signedMiddleTransaction: ", error);
    return;
  }
  console.log("second");

  return signedMiddleTransaction;
};

const thirdTransaction = async (
  decoded: DecodedTransactionProps,
  amounts: AmountsProps
) => {
  const erc20 = erc20Factory.attach(decoded.path[1]);
  let thirdTransaction = {
    signer: signer,
    transaction: await erc20.populateTransaction.approve(
      uniswapV2Router.address,
      amounts.firstAmountOut,
      {
        value: "0",
        type: 2,
        maxFeePerGas: amounts.maxGasFee,
        maxPriorityFeePerGas: amounts.priorityFee,
        gasLimit: 300000,
      }
    ),
  };
  thirdTransaction.transaction = {
    ...thirdTransaction.transaction,
    chainId,
  };
  console.log("third");

  return thirdTransaction;
};

const forthTransaction = async (
  decoded: DecodedTransactionProps,
  amounts: AmountsProps
) => {
  let fourthTransaction = {
    signer: signer,
    transaction: await uniswapV2Router.connect(signer).exactOutputSingle(
      {
        tokenIn: decoded.path[1],
        tokenOut: decoded.path[0],
        fee: Number(decoded.fee),
        recipient: signer.address,
        deadline,
        amountOut: amounts.thirdAmountOut,
        amountInMaximum: amounts.firstAmountOut,
        sqrtPriceLimitX96: 0,
      },
      {
        value: "0",
        type: 2,
        maxFeePerGas: amounts.maxGasFee,
        maxPriorityFeePerGas: amounts.priorityFee,
        gasLimit: 300000,
      }
    ),
  };
  fourthTransaction.transaction = {
    ...fourthTransaction.transaction,
    chainId,
  };
  console.log("fourth");

  return fourthTransaction;
};

const signBundle = async (
  transactions: any,
  flashbotsProvider: FlashbotsBundleProvider
) => {
  const transactionsArray = [...transactions];
  const signedBundle = await flashbotsProvider.signBundle(transactionsArray);
  // console.log(signedBundle);
  return signedBundle;
};

const sendBundle = async (
  bundle: any,
  flashbotsProvider: FlashbotsBundleProvider
) => {
  const blockNumber = await provider.getBlockNumber();
  console.log("Simulating...");
  let simulation;
  // try {
  simulation = await flashbotsProvider.simulate(bundle, blockNumber + 1);
  // } catch (error) {
  //   console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", error);
  // }
  //@ts-expect-error
  if (simulation.firstRevert) {
    //@ts-expect-error
    console.log("Simulation error", simulation.firstRevert);
    return false;
  }
  console.log("Simulation success");

  // 12. Send transactions with flashbots
  let bundleSubmission: { bundleHash: any; wait: () => any };
  flashbotsProvider
    .sendRawBundle(bundle, blockNumber + 1)
    .then((_bundleSubmission: any) => {
      bundleSubmission = _bundleSubmission;
      console.log("Bundle submitted", bundleSubmission.bundleHash);
      return bundleSubmission.wait();
    })
    .then(async (waitResponse: any) => {
      console.log("Wait response", FlashbotsBundleResolution[waitResponse]);
      if (waitResponse == FlashbotsBundleResolution.BundleIncluded) {
        console.log("Bundle Included!");
        return true;
      } else if (
        waitResponse == FlashbotsBundleResolution.AccountNonceTooHigh
      ) {
        console.log("The transaction has been confirmed already");
      }
      return false;
    });
};

export default sandwichTransaction;
