import { BigNumber, Transaction } from "ethers";

type DecodedTransactionProps = {
  transaction: Transaction;
  amountIn: BigNumber;
  minAmountOut: BigNumber;
  path: string[];
  targetToken: string;
  fee: BigNumber;
};

export default DecodedTransactionProps;
