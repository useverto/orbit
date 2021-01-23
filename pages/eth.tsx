import Arweave from "arweave";
import { useState, useEffect } from "react";
import { all } from "ar-gql";
import Head from "next/head";
import { Page, Text } from "@geist-ui/react";
import { Pie } from "react-chartjs-2";

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const Eth = () => {
  const [data, setData] = useState([]);
  const [graphData, setGraphData] = useState([]);
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

  const getWeights = async (): Promise<{}> => {
    return {};
  };

  useEffect(() => {
    getLinkedAddresses().then((res) => setData(res));
    setInterval(async () => {
      setData(await getLinkedAddresses());
    }, 60000);
  }, []);

  useEffect(() => {
    console.log("Triggered");
    let newGraphData = {
      datasets: [
        {
          label: 'Linked Address Weights',
          data: [],
        },
      ],
    };
    for (let i = 0; i < data.length; i++) {
      newGraphData.datasets[0].data.push(data[i].arWallet);
    }
    setGraphData(newGraphData);
  }, [data]);
  return (
    <>
      <Head>
        <title>Orbit / ETH</title>
      </Head>
      <Page>
        <Pie data={graphData} />
        <Text>{JSON.stringify(data)}</Text>
      </Page>
    </>
  );
};

export default Eth;
