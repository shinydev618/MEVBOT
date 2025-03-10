import { ethers } from "ethers";
import { httpProviderUrl, wssProviderUrl } from "./constants";
import decodeTransaction from "./scripts/decodeTransaction";
import sandwichTransaction from "./scripts/sandwichTransaction";
import fs from "fs";

const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);
const wssProvider = new ethers.providers.WebSocketProvider(wssProviderUrl!);

console.log("Listen for swaps on UniswapV2 to sandwich...");

// Listen to transaction hashes in the mempool
wssProvider.on("pending", (txHash) => handleTransaction(txHash));

// Get transaction, decode it and sandwich
const handleTransaction = async (txHash: string) => {
  try {
    const targetTransaction = await provider.getTransaction(txHash);
    const decoded = await decodeTransaction(targetTransaction);
    const sandwich = await sandwichTransaction(decoded);
    // console.log(sandwich);
    if (sandwich) {
      console.log("Sandwich successful!");
      fs.appendFile("sandwich.json", JSON.stringify(decoded) + "\n", (err) => {
        if (err) throw err;
        console.log("Data updated successfully");
      });
    }
  } catch (error) {
    console.log(error);
  }
};

wssProvider.on("close", () => {
  console.log("WebSocket connection closed. Attempting to reconnect...");
  // Try reconnecting after a short delay
  setTimeout(() => {
    console.log("Reconnected to WebSocket");
  }, 5000); // Reconnect after 5 seconds
});
