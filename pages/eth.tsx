import { useEffect, useState } from "react";
import Head from "next/head";
import Verto from "@verto/lib";
import Arweave from "arweave";
import { Table, Loading, Dot, Tooltip, Page } from "@geist-ui/react";
import styles from "../styles/Index.module.scss";
import { all } from "ar-gql";

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const Eth = () => {
  const [data, setData] = useState([]);

  const getLinkedAddresses = async (): Promise<{
    arWallet: string,
    ethWallet: string
  }[]> => {
    const linkedAddresses: {
      arWallet: string,
      ethWallet: string
    }[] = [];
    const res = await all(
      `query($cursor: String) {
      transactions(
        tags: [
          { name: "Application", values: "ArLink" }
        ]
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
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
    }`
    );

    console.log("Queried");
    for (const tx of res) {
      let updated: boolean = false;
      for (let i = 0; i < linkedAddresses.length; i++) {
        if (linkedAddresses[i].arWallet === tx.node.owner.address) {
          linkedAddresses[i] = {
            arWallet: tx.node.owner.address,
            ethWallet: tx.node.tags.find(tag => tag.name === "Wallet").value
          };
          updated = true;
        }
      }
      if (!updated) {
        linkedAddresses.push({
          arWallet: tx.node.owner.address,
          ethWallet: tx.node.tags.find(tag => tag.name === "Wallet").value
        });
      }
    }

    return linkedAddresses;
  }

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
        {data}
      </Page>
    </>
  );
};

export default Eth;