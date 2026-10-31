const fs = require("node:fs");
const path = require("node:path");
const XYZCoin = artifacts.require("XYZCoin");

module.exports = async function (callback) {
  try {
    const coin = await XYZCoin.deployed();
    const accounts = await web3.eth.getAccounts();
    const networkId = await web3.eth.net.getId();
    const deploymentTransaction = XYZCoin._json.networks[networkId].transactionHash;
    const receipt = await web3.eth.getTransactionReceipt(deploymentTransaction);
    if (!receipt) throw new Error("The deployment receipt is unavailable");
    const result = {
      verifiedAtUTC: new Date().toISOString(),
      networkId,
      chainId: await web3.eth.getChainId(),
      contract: coin.address,
      creator: accounts[0],
      deploymentTransaction,
      deploymentBlock: receipt.blockNumber,
      name: await coin.name(),
      symbol: await coin.symbol(),
      decimals: (await coin.decimals()).toString(),
      totalSupply: (await coin.totalSupply()).toString(),
      creatorBalance: (await coin.balanceOf(accounts[0])).toString()
    };
    if (result.name !== "XYZCoin" || result.symbol !== "XYZ" ||
        result.decimals !== "0" || result.totalSupply !== "1000" ||
        result.creatorBalance !== "1000") {
      throw new Error("The deployed token does not match the assignment parameters");
    }
    const target = path.join(__dirname, "../results/deployment.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
    console.log("Deployment verified:", result.contract);
    console.log("XYZCoin / XYZ / decimals 0 / supply 1000 / creator balance 1000");
    callback();
  } catch (error) {
    callback(error);
  }
};
