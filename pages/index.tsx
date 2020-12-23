import { useEffect, useState } from "react";
import Head from 'next/head';
import Verto from "@verto/lib";
import Arweave from "arweave";
import {
  Table,
  Tag,
  Loading
} from "@geist-ui/react";

import { query } from "../utils/gql";
import styles from "../styles/Index.module.scss";
import { EdgeQueryResponse } from "../types";

export default function Index() {
  const arweaveClient = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 20000,
    logging: false,
  });
  const client = new Verto(arweaveClient);

  let data = [
    { status: <Loading></Loading>, address: <Loading></Loading>, balance: <Loading></Loading>, reputation: <Loading></Loading> },
  ];

  const TradingPostTable: React.FC = props => {
    useEffect(() => {
      async function populateTradingPosts() {
        const allTPs: [{ wallet: string, stake: number, genesis: string }] = await getTradingPosts();
        let response;

        for (let i = 0; i < allTPs.length; i++) {
          const balance = await arweaveClient.wallets.getBalance(allTPs[i].wallet);
          arweaveClient.ar.winstonToAr(balance);

          const pong: string | boolean = await ping(allTPs[i].genesis);
          let status;
          if (typeof (pong) === "string") {
            // It is online
            status = <Tag type="success">{pong}</Tag>
          } else {
            // It is offline
            status = <Tag type="error">Offline</Tag>;
          }

          response.push({
            status,
            address: allTPs[i].wallet,
            balance,
            stake: allTPs[i].stake
          });
        }
        return (
          <Table data={response}>
            <Table.Column prop="status" label="status" />
            <Table.Column prop="address" label="address" />
            <Table.Column prop="balance" label="balance" />
            <Table.Column prop="stake" label="stake" />
          </Table>
        );
      }

      populateTradingPosts();
    }, []);
    return <div></div>;
  };

  async function getTradingPosts(): Promise<[{ wallet: string, stake: number, genesis: string }]> {
    const genesi = (await query<EdgeQueryResponse>({
      query: 
      `{
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
    })).data.transactions;
    const gensisTxs = genesi.edges;
    let posts: [{ wallet: string, stake: number, genesis: string }] = [];
    const encountered: string[] = [];

    for (const tx of gensisTxs) {
      if (!encountered.find((addr) => addr === tx.node.owner.address)) {
        const stake = await client.getPostStake(tx.node.owner.address);
        if (stake > 0) {
          posts.push({
            wallet: tx.node.owner.address,
            stake: stake,
            genesis: tx.node.id
          });
        }
        encountered.push(tx.node.owner.address);
      }
    }
    return posts;
  }

  async function ping(genesisTX: string): Promise<string | boolean> {
    const apiEndpoint = await arweaveClient.transactions.getData(genesisTX, { decode: true, string: true });
    // @ts-expect-error
    JSON.parse(apiEndpoint);
    // @ts-expect-error
    const pong = await fetch(`https://${apiEndpoint.publicURL}/ping`);
    // TODO: @t8 Check for response before parsing

    const uptime = (await pong.json()).uptime;
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
          <h4>A block explorer for the Verto Protocol</h4>
        </div>
        <TradingPostTable></TradingPostTable>
      </div>
    </>
  )
}