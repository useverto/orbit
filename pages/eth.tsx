import Arweave from "arweave";
import { useState, useEffect } from "react";
import { all } from "ar-gql";
import Head from "next/head";
import { Page, Text } from "@geist-ui/react";

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const Eth = () => {
  const [data, setData] = useState([]);

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

  useEffect(() => {
    getLinkedAddresses().then((res) => setData(res));
    setInterval(async () => {
      setData(await getLinkedAddresses());
    }, 60000);
  }, []);
  return (
    <>
      <Head>
        <title>Orbit / ETH</title>
      </Head>
      <Page>
        <Text>{JSON.stringify(data)}</Text>
      </Page>
    </>
  );
};

export default Eth;
