import Arweave from "arweave";
import Verto from "@verto/lib";
import { getContract } from "cacheweave";
import { useState, useEffect } from "react";
import { all } from "ar-gql";
import Head from "next/head";
import { Page } from "@geist-ui/react";
import { Pie } from "react-chartjs-2";

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
  let userMetaData = [];
  const getLinkedAddresses = async (): Promise<
    {
      arWallet: string;
      ethWallet: string;
    }[]
  > => {
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
    let graphData = newGraphData;
    for (const user of data) {
      console.log("Pulling a new user");
      const stake = await verto.getPostStake(user.arWallet);
      if (stake > 0) {
        graphData.labels.push(user.arWallet);
        graphData.datasets[0].data.push(stake);
        setGraphData(graphData);
      }
    }
    console.log("Finished");
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
    userMetaData = [];
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
