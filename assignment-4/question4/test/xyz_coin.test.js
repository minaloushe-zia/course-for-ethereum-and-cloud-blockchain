const XYZCoin = artifacts.require("XYZCoin");
const truffleAssert = require("truffle-assertions");

contract("XYZCoin", (accounts) => {
  const [creator, recipient, spender, outsider] = accounts;
  const zero = "0x0000000000000000000000000000000000000000";
  let coin;

  beforeEach(async () => {
    coin = await XYZCoin.new({ from: creator });
  });

  function transferEvent(tx, from, to, value) {
    truffleAssert.eventEmitted(tx, "Transfer", (event) =>
      event.from === from && event.to === to && event.value.toString() === value
    );
  }

  it("4h sets the name, symbol and zero decimals", async () => {
    assert.equal(await coin.name(), "XYZCoin");
    assert.equal(await coin.symbol(), "XYZ");
    assert.equal((await coin.decimals()).toString(), "0");
  });

  it("4h gives the creator all 1000 tokens", async () => {
    const supply = await coin.totalSupply();
    assert.equal(supply.toString(), "1000");
    assert.equal((await coin.balanceOf(creator)).toString(), supply.toString());
    assert.equal((await coin.balanceOf(recipient)).toString(), "0");
  });

  it("4h transfers tokens and preserves total supply", async () => {
    assert.equal(await coin.transfer.call(recipient, 120, { from: creator }), true);
    await coin.transfer(recipient, 120, { from: creator });
    assert.equal((await coin.balanceOf(creator)).toString(), "880");
    assert.equal((await coin.balanceOf(recipient)).toString(), "120");
    assert.equal((await coin.totalSupply()).toString(), "1000");
  });

  it("4h sets, reads and overwrites an allowance without moving tokens", async () => {
    assert.equal(await coin.approve.call(spender, 100, { from: creator }), true);
    await coin.approve(spender, 100, { from: creator });
    assert.equal((await coin.allowance(creator, spender)).toString(), "100");
    await coin.approve(spender, 30, { from: creator });
    assert.equal((await coin.allowance(creator, spender)).toString(), "30");
    assert.equal((await coin.allowance(creator, outsider)).toString(), "0");
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
  });

  it("4h transfers on behalf of an owner and consumes the allowance", async () => {
    await coin.approve(spender, 100, { from: creator });
    assert.equal(await coin.transferFrom.call(creator, recipient, 40, { from: spender }), true);
    await coin.transferFrom(creator, recipient, 40, { from: spender });
    assert.equal((await coin.balanceOf(creator)).toString(), "960");
    assert.equal((await coin.balanceOf(recipient)).toString(), "40");
    assert.equal((await coin.allowance(creator, spender)).toString(), "60");
  });

  it("4i rejects a transfer exceeding the sender balance", async () => {
    await truffleAssert.reverts(
      coin.transfer(recipient, 1001, { from: creator }),
      "XYZCoin: insufficient balance"
    );
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
    assert.equal((await coin.balanceOf(recipient)).toString(), "0");
  });

  it("4i rejects an unauthorized delegated transfer", async () => {
    await truffleAssert.reverts(
      coin.transferFrom(creator, recipient, 1, { from: outsider }),
      "XYZCoin: insufficient allowance"
    );
  });

  it("4i emits Transfer for a positive direct transfer", async () => {
    transferEvent(await coin.transfer(recipient, 7, { from: creator }), creator, recipient, "7");
  });

  it("4i emits Transfer for a zero direct transfer from an empty account", async () => {
    transferEvent(await coin.transfer(recipient, 0, { from: outsider }), outsider, recipient, "0");
    assert.equal((await coin.balanceOf(outsider)).toString(), "0");
    assert.equal((await coin.balanceOf(recipient)).toString(), "0");
  });

  it("4i emits Transfer for a positive delegated transfer", async () => {
    await coin.approve(spender, 20, { from: creator });
    const tx = await coin.transferFrom(creator, recipient, 7, { from: spender });
    transferEvent(tx, creator, recipient, "7");
  });

  it("4i emits Transfer for a zero delegated transfer", async () => {
    await coin.approve(spender, 20, { from: creator });
    const tx = await coin.transferFrom(creator, recipient, 0, { from: spender });
    transferEvent(tx, creator, recipient, "0");
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
    assert.equal((await coin.allowance(creator, spender)).toString(), "20");
  });

  it("4i emits Approval on approval and revocation", async () => {
    for (const value of [25, 0]) {
      const tx = await coin.approve(spender, value, { from: creator });
      truffleAssert.eventEmitted(tx, "Approval", (event) =>
        event.owner === creator && event.spender === spender && event.value.toString() === String(value)
      );
    }
  });

  it("rejects spending above the remaining allowance without changing it", async () => {
    await coin.approve(spender, 10, { from: creator });
    await truffleAssert.reverts(
      coin.transferFrom(creator, recipient, 11, { from: spender }),
      "XYZCoin: insufficient allowance"
    );
    assert.equal((await coin.allowance(creator, spender)).toString(), "10");
  });

  it("restores the allowance when an authorized transfer lacks funds", async () => {
    await coin.approve(spender, 1001, { from: creator });
    await truffleAssert.reverts(
      coin.transferFrom(creator, recipient, 1001, { from: spender }),
      "XYZCoin: insufficient balance"
    );
    assert.equal((await coin.allowance(creator, spender)).toString(), "1001");
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
  });

  it("preserves balances on self transfers", async () => {
    await coin.transfer(creator, 1000, { from: creator });
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
    await coin.approve(spender, 10, { from: creator });
    await coin.transferFrom(creator, creator, 10, { from: spender });
    assert.equal((await coin.balanceOf(creator)).toString(), "1000");
    assert.equal((await coin.allowance(creator, spender)).toString(), "0");
  });

  it("rejects zero recipients and zero spenders", async () => {
    await truffleAssert.reverts(coin.transfer(zero, 1, { from: creator }), "XYZCoin: zero recipient");
    await truffleAssert.reverts(coin.approve(zero, 1, { from: creator }), "XYZCoin: zero spender");
  });
});
