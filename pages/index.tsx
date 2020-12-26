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

const getTradingPosts = async (): Promise<
  { wallet: string; stake: number; genesis: string }[]
> => {
  const res = await all(
    `query($cursor: String) {
      transactions(
        tags: [
          { name: "Exchange", values: "Verto" }
          { name: "Type", values: "Genesis" }
        ]
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            owner {
              address
            }
          }
        }
      }
    }`
  );

  const posts: { wallet: string; stake: number; genesis: string }[] = [];
  const encountered: string[] = [];

  for (const tx of res) {
    if (!encountered.find((addr) => addr === tx.node.owner.address)) {
      const stake = await new Verto().getPostStake(tx.node.owner.address);
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
};

const ping = async (genesis: string): Promise<number | boolean> => {
  const config = JSON.parse(
    (
      await client.transactions.getData(genesis, { decode: true, string: true })
    ).toString()
  );
  let url = config.publicURL.startsWith("https://")
    ? config.publicURL
    : "https://" + config.publicURL;
  let endpoint = url.endsWith("/") ? "ping" : "/ping";

  const res = await fetch(url + endpoint);
  // TODO: @t8 Check for response before parsing
  const uptime = (await res.clone().json()).uptime;

  return uptime;
};

const populate = async () => {
  const posts = await getTradingPosts();
  const res = [];

  for (const post of posts) {
    const address = <a href={`/post?addr=${post.wallet}`}>{post.wallet}</a>;

    const balance = `${client.ar.winstonToAr(
      await client.wallets.getBalance(post.wallet)
    )} AR`;

    const pong = await ping(post.genesis);
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

    res.push({
      status,
      address,
      balance,
      stake: `${post.stake} VRT`,
    });
  }

  return res;
};

const Home = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    populate().then((res) => setData(res));
    setInterval(async () => {
      setData(await populate());
    }, 60000);
  }, []);

  return (
    <>
      <Head>
        <title>Orbit</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>"
        />
      </Head>
      <Page>
        <div className={styles.heading}>
          <h1 className={styles.title}>🌍rbit</h1>
          <h4>Verto Protocol Explorer</h4>
        </div>
        {data.length === 0 ? (
          <Table
            data={[
              {
                status: <Loading></Loading>,
                address: <Loading></Loading>,
                balance: <Loading></Loading>,
                stake: <Loading></Loading>,
              },
            ]}
          >
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
      </Page>
    </>
  );
};

export default Home;
