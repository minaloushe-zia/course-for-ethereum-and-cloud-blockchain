// The npm dependency pins the local compiler to Solidity 0.5.1.
module.exports = {
  network: "development",
  config: "truffle-config.js",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*"
    },
    develop: {
      host: "127.0.0.1",
      port: 9545,
      network_id: 5777
    }
  },
  compilers: {
    solc: {
      version: require.resolve("solc/soljson.js"),
      settings: {
        optimizer: { enabled: true, runs: 200 }
      }
    }
  },
  // Solidity 0.5.1 emits an empty metadata string for interfaces. Omit that
  // optional field so Truffle can load the interface artifact in its console.
  subscribers: {
    interfaceMetadata: {
      handlers: {
        "compile:succeed": [function ({ result }) {
          for (const contract of result.contracts) {
            if (contract.metadata === "") delete contract.metadata;
          }
        }]
      }
    }
  },
  mocha: { timeout: 30000 },
  db: { enabled: false }
};
