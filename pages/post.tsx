import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Loading, Text, Dot, Page, Breadcrumbs, Table } from "@geist-ui/react";
import { all, run } from "ar-gql";
import moment from "moment";

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
      ).then(async (txs) => {
        for (const tx of txs) {
          const type = tx.node.tags.find((tag) => tag.name === "Type").value;

          let status = "pending";
          if (type === "Buy" || type === "Sell") {
            const confirmationTx = (
              await run(
                `
                query($txID: [String!]!) {
                  transactions(
                    tags: [
                      { name: "Exchange", values: "Verto" }
                      { name: "Type", values: "Confirmation" }
                      { name: "Match", values: $txID }
                    ]
                  ) {
                    edges {
                      node {
                        block {
                          timestamp
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
                { txID: tx.node.id }
              )
            ).data.transactions.edges[0];

            if (confirmationTx) {
              status = "completed";
            }
          }
          if (type === "Swap") {
            const confirmationTx = (
              await run(
                `
                query($txID: [String!]!) {
                  transactions(
                    tags: [
                      { name: "Exchange", values: "Verto" }
                      { name: "Type", values: "Confirmation" }
                      { name: "Swap", values: $txID }
                    ]
                  ) {
                    edges {
                      node {
                        block {
                          timestamp
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
                { txID: tx.node.id }
              )
            ).data.transactions.edges[0];

            if (confirmationTx) {
              status = "completed";
            }
          }

          const cancelTx = (
            await run(
              `
              query($txID: [String!]!) {
                transactions(
                  tags: [
                    { name: "Exchange", values: "Verto" }
                    { name: "Type", values: "Cancel" }
                    { name: "Order", values: $txID }
                  ]
                ) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            `,
              { txID: tx.node.id }
            )
          ).data.transactions.edges[0];

          if (cancelTx) {
            status = "cancelled";
          }

          setTrades((trades) => {
            return [
              ...trades,
              {
                id: (
                  <Text>
                    <Dot
                      type={
                        status === "pending"
                          ? "warning"
                          : status === "completed"
                          ? "success"
                          : "error"
                      }
                    />{" "}
                    {tx.node.id}
                  </Text>
                ),
                hasMined: tx.node.block ? true : false,
                unix: tx.node.block
                  ? tx.node.block.timestamp
                  : parseInt(new Date().getTime().toString().slice(0, -3)),
                timestamp: tx.node.block
                  ? moment
                      .unix(tx.node.block.timestamp)
                      .format("YYYY-MM-DD HH:mm:ss")
                  : "mining ...",
                type: tx.node.tags.find((tag) => tag.name === "Type").value,
                status,
              },
            ];
          });
        }
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
          <Table.Column prop="timestamp" label="Timestamp" />
          <Table.Column prop="type" label="Order Type" />
        </Table>
      ) : (
        <Table data={trades}>
          <Table.Column prop="id" label="Order ID" />
          <Table.Column prop="timestamp" label="Timestamp" />
          <Table.Column prop="type" label="Order Type" />
        </Table>
      )}
    </Page>
  );
};

export default Post;
