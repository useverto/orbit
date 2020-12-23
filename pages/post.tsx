import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Loading, Page, Breadcrumbs, Table } from "@geist-ui/react";
import { all } from "ar-gql";

const Post = () => {
  const router = useRouter();
  const [addr, setAddr] = useState("");

  const [trades, setTrades] = useState([]);
  const loadingTradesData = [
    {
      id: <Loading />,
      hasMined: <Loading />,
      timestamp: <Loading />,
      type: <Loading />,
    },
  ];
  useEffect(() => {
    if (router.query.addr) {
      // @ts-ignore
      setAddr(router.query.addr);
      all(
        `
        query($addr: String!, $cursor: String) {
          transactions(
            recipients: [$addr]
            tags: [
              { name: "Exchange", values: "Verto" }
              { name: "Type", values: ["Buy", "Sell", "Swap"] }
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
                block {
                  timestamp
                }
                quantity {
                  ar
                }
                tags {
                  name
                  value
                }
              }
            }
          }
        }
      `,
        { addr: router.query.addr }
      ).then((txs) => {
        const res: {
          id: string;
          hasMined: boolean;
          timestamp?: number;
          type: string;
        }[] = [];

        for (const tx of txs) {
          res.push({
            id: tx.node.id,
            hasMined: tx.node.block ? true : false,
            timestamp: tx.node.block
              ? tx.node.block.timestamp
              : parseInt(new Date().getTime().toString().slice(0, -3)),
            type: tx.node.tags.find((tag) => tag.name === "Type").value,
          });
        }

        setTrades(res);
      });
    }
  }, [router.query.addr]);

  return (
    <Page>
      <Breadcrumbs size="large">
        <Breadcrumbs.Item>🌍rbit</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/">Trading Posts</Breadcrumbs.Item>
        <Breadcrumbs.Item>{addr}</Breadcrumbs.Item>
      </Breadcrumbs>

      {trades.length === 0 ? (
        <Table data={loadingTradesData}>
          <Table.Column prop="id" label="Order ID" />
          <Table.Column prop="timestamp" label="UNIX Timestamp" />
          <Table.Column prop="type" label="Order Type" />
        </Table>
      ) : (
        <Table data={trades}>
          <Table.Column prop="id" label="Order ID" />
          <Table.Column prop="timestamp" label="UNIX Timestamp" />
          <Table.Column prop="type" label="Order Type" />
        </Table>
      )}
    </Page>
  );
};

export default Post;
