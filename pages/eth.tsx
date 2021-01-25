import Arweave from "arweave";
import Verto from "@verto/lib";
import { getContract } from "cacheweave";
import { useState, useEffect } from "react";
import { all } from "ar-gql";
import Head from "next/head";
import { Page } from "@geist-ui/react";
import { Pie } from "react-chartjs-2";

const contract = "usjm4PCxUd5mtaon7zc97-dt-3qf67yPyqgzLnLqk5A";

const client = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const verto = new Verto(null, client);

const Eth = () => {
  const [data, setData] = useState([]);
  const graphOptions = {
    legend: {
      display: false,
    }
  };
  const [newGraphData, setGraphData] = useState({
    labels: [],
    datasets: [{
      label: "Address Weights",
      data: []
    }]
  });
  const getLinkedAddresses = async (): Promise<
    {
      arWallet: string;
      ethWallet: string;
    }[]
    > => {
    setData([]);
    const linkedAddresses: {
      arWallet: string;
      ethWallet: string;
    }[] = [];
    const res = await all(`
      query($cursor: String) {
        transactions(
          tags: [
            { name: "Application", values: "ArLink" }
            { name: "Chain", values: "ETH" }
          ]
          after: $cursor
        ) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              owner {
                address
              }
              tags {
                name
                value
              }
            }
          }
        }
      }
    `);

    for (const tx of res) {
      let updated: boolean = false;
      for (let i = 0; i < linkedAddresses.length; i++) {
        if (linkedAddresses[i].arWallet === tx.node.owner.address) {
          linkedAddresses[i] = {
            arWallet: tx.node.owner.address,
            ethWallet: tx.node.tags.find((tag) => tag.name === "Wallet").value,
          };
          updated = true;
        }
      }
      if (!updated) {
        linkedAddresses.push({
          arWallet: tx.node.owner.address,
          ethWallet: tx.node.tags.find((tag) => tag.name === "Wallet").value,
        });
      }
    }

    return linkedAddresses;
  };

  const getWeights = async () => {
    console.log("Getting weights");
    let graphData = newGraphData;
    const contractState = await getContract(client, contract);
    for (const user of data) {
      console.log(user);
      let updated = false;
      let amountOfVRT = 0;
      const stake = await verto.getPostStake(user.arWallet);
      if (stake > 0) {
        amountOfVRT += stake;
        updated = true;
      }
      // @ts-expect-error
      const unlockedBalance = contractState.balances[user.arWallet];
      if (unlockedBalance > 0) {
        amountOfVRT += unlockedBalance;
        updated = true;
      }
      if (updated) {
        console.log(user, amountOfVRT);
        graphData.labels.push(user.arWallet);
        graphData.datasets[0].data.push(amountOfVRT);
        setGraphData(graphData);
      }
    }
  };

  useEffect(() => {
    getLinkedAddresses().then((res) => setData(res));
    setInterval(async () => {
      setData(await getLinkedAddresses());
    }, 360000);
  }, []);

  useEffect(() => {
    setGraphData({
      labels: [],
      datasets: [
        {
          label: "Address Weights",
          data: [],
        },
      ],
    });
    getWeights();
  }, [data]);

  return (
    <>
      <Head>
        <title>Orbit / ETH</title>
      </Head>
      <Page>
        <Pie data={newGraphData} options={graphOptions} />
      </Page>
    </>
  );
};

export default Eth;
