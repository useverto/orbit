import { useEffect, useState } from "react";
import Head from "next/head";
import Verto from "@verto/lib";
import Arweave from "arweave";
import { Table, Loading, Dot, Tooltip } from "@geist-ui/react";

import { query } from "../utils/gql";
import styles from "../styles/Index.module.scss";
import { EdgeQueryResponse } from "../types";

export default function Index() {
  const arweaveClient = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
    timeout: 20000,
    logging: false,
  });
  const client = new Verto(arweaveClient);

  const loadingTableData = [{
    status: <Loading></Loading>,
    address: <Loading></Loading>,
    balance: <Loading></Loading>,
    stake: <Loading></Loading>
  }];
  const [data, setData] = useState([]);
  useEffect(() => {
    populateTradingPosts().then((res) => {
      setData(res);
    });
  }, []);

  async function populateTradingPosts() {
    const allTPs: [
      { wallet: string; stake: number; genesis: string }
    ] = await getTradingPosts();
    let response = [];

    for (let i = 0; i < allTPs.length; i++) {
      const address = <a href={`/post?addr=${allTPs[i].wallet}`}>{allTPs[i].wallet}</a>

      const balance = `${arweaveClient.ar.winstonToAr(
        await arweaveClient.wallets.getBalance(allTPs[i].wallet)
      )} AR`;

      const pong: number | boolean = await ping(allTPs[i].genesis);
      let status;
      if (typeof pong === "number") {
        // It is online
        let pongText = `${pong / 3600} hours`;
        status = (
          <Tooltip text={pongText} placement="topStart">
            <Dot style={{ marginRight: "20px" }} type="success">
              Online
            </Dot>
          </Tooltip>
        );
      } else {
        // It is offline
        status = (
          <Dot style={{ marginRight: "20px" }} type="error">
            Offline
          </Dot>
        );
      }

      response.push({
        status,
        address,
        balance,
        stake: `${allTPs[i].stake} VRT`,
      });
    }
    return response;
  }

  async function getTradingPosts(): Promise<
    [{ wallet: string; stake: number; genesis: string }]
  > {
    const genesi = (
      await query<EdgeQueryResponse>({
        query: `{
        transactions(
          tags: [
            { name: "Exchange", values: "Verto" }
            { name: "Type", values: "Genesis" }
          ]
          first: 2147483647
        ) {
          edges {
            node {
              id
              owner {
                address
              }
            }
          }
        }
      }`,
      })
    ).data.transactions;
    const gensisTxs = genesi.edges;
    // @ts-expect-error
    let posts: [{ wallet: string; stake: number; genesis: string }] = [];
    const encountered: string[] = [];

    for (const tx of gensisTxs) {
      if (!encountered.find((addr) => addr === tx.node.owner.address)) {
        const stake = await client.getPostStake(tx.node.owner.address);
        if (stake > 0) {
          posts.push({
            wallet: tx.node.owner.address,
            stake: stake,
            genesis: tx.node.id,
          });
        }
        encountered.push(tx.node.owner.address);
      }
    }
    return posts;
  }

  async function ping(genesisTX: string): Promise<number | boolean> {
    const apiEndpoint = JSON.parse(
      // @ts-expect-error
      await arweaveClient.transactions.getData(genesisTX, {
        decode: true,
        string: true,
      })
    );
    const pong = await fetch(`https://${apiEndpoint.publicURL}/ping`);
    // TODO: @t8 Check for response before parsing
    const uptime = (await pong.clone().json()).uptime;
    return uptime;
  }

  return (
    <>
      <Head>
        <title>Orbit</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.container}>
        <div className={styles.heading}>
          <h1 className={styles.title}>🌍rbit</h1>
          <h4>Verto Protocol Explorer</h4>
        </div>
        {data.length === 0 ? (
          <Table data={loadingTableData}>
            <Table.Column prop="status" label="status" />
            <Table.Column prop="address" label="trading post address" />
            <Table.Column prop="balance" label="balance" />
            <Table.Column prop="stake" label="stake" />
          </Table>
        ) : (
          <Table data={data}>
            <Table.Column prop="status" label="status" />
            <Table.Column prop="address" label="trading post address" />
            <Table.Column prop="balance" label="balance" />
            <Table.Column prop="stake" label="stake" />
          </Table>
        )}
      </div>
    </>
  );
}
