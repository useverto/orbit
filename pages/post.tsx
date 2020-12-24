import { useRouter } from "next/router";
import Head from "next/head";
import { useState, useEffect } from "react";
import {
  Loading,
  Dot,
  Page,
  Breadcrumbs,
  Table,
  Spacer,
  Row,
  Button,
} from "@geist-ui/react";
import { all, run } from "ar-gql";
import moment from "moment";
import { Bar } from "react-chartjs-2";

const Post = () => {
  const router = useRouter();
  const [addr, setAddr] = useState("");

  const [trades, setTrades] = useState([]);
  const [limit, setLimit] = useState(10);
  const [graphData, setGraphData] = useState([]);
  const graphOptions = {
    tooltips: {
      mode: "index",
      intersect: false,
    },
    hover: {
      mode: "nearest",
      intersect: true,
    },
    scales: {
      xAxes: [
        {
          display: false,
          stacked: true,
        },
      ],
      yAxes: [
        {
          display: false,
          stacked: true,
        },
      ],
    },
    legend: {
      display: false,
    },
  };

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
                  <>
                    <Dot
                      type={
                        status === "pending"
                          ? "warning"
                          : status === "completed"
                          ? "success"
                          : "secondary"
                      }
                    />{" "}
                    <a target="_blank" href={`/order?id=${tx.node.id}`}>
                      {tx.node.id}
                    </a>
                  </>
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

  useEffect(() => {
    const labels = [],
      data = [];
    const cancelled = [],
      pending = [],
      succeeded = [];
    for (let i = trades.length - 1; i >= 0; i--) {
      const time = trades[i].timestamp.split(" ")[0];
      const position = labels.indexOf(time);
      if (position === -1) {
        // Time doesn't exist
        labels.push(time);
        data.push(1);
        if (trades[i].status === "completed") {
          succeeded.push(1);
          pending.push(0);
          cancelled.push(0);
        }
        if (trades[i].status === "pending") {
          succeeded.push(0);
          pending.push(1);
          cancelled.push(0);
        }
        if (trades[i].status === "cancelled") {
          succeeded.push(0);
          pending.push(0);
          cancelled.push(1);
        }
      } else {
        // Time already exists
        data[position]++;
        if (trades[i].status === "completed") {
          succeeded[position]++;
        }
        if (trades[i].status === "pending") {
          pending[position]++;
        }
        if (trades[i].status === "cancelled") {
          cancelled[position]++;
        }
      }
    }

    const config = {
      labels,
      datasets: [
        {
          label: "Succeeded",
          backgroundColor: "rgba(0, 212, 110, 0.5)",
          borderColor: "#00D46E",
          borderWidth: 0.5,
          data: succeeded,
        },
        {
          label: "Pending",
          backgroundColor: "rgba(255, 211, 54, 0.5)",
          borderColor: "#FFD336",
          borderWidth: 0.5,
          data: pending,
        },
        {
          label: "Cancelled",
          backgroundColor: "rgba(130, 130, 130, 0.5)",
          borderColor: "#828282",
          borderWidth: 0.5,
          data: cancelled,
        },
      ],
    };

    // @ts-expect-error
    setGraphData(config);
  }, [trades]);

  return (
    <>
      <Head>
        <title>Orbit / Post</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>"
        />
      </Head>
      <Page>
        <Breadcrumbs size="large">
          <Breadcrumbs.Item href="/">🌍rbit</Breadcrumbs.Item>
          <Breadcrumbs.Item>{addr}</Breadcrumbs.Item>
        </Breadcrumbs>

        <Spacer y={1} />

        <Bar data={graphData} height={50} options={graphOptions} />

        {trades.length === 0 ? (
          <Table data={loadingTradesData}>
            <Table.Column prop="id" label="Order ID" />
            <Table.Column prop="timestamp" label="Timestamp" />
            <Table.Column prop="type" label="Order Type" />
          </Table>
        ) : (
          <>
            <Table data={trades.slice(0, limit)}>
              <Table.Column prop="id" label="Order ID" />
              <Table.Column prop="timestamp" label="Timestamp" />
              <Table.Column prop="type" label="Order Type" />
            </Table>
            {limit < trades.length && (
              <>
                <Spacer y={2} />
                <Row justify="center">
                  <Button onClick={() => setLimit((limit) => limit + 10)}>
                    Show More
                  </Button>
                </Row>
              </>
            )}
          </>
        )}
      </Page>
    </>
  );
};

export default Post;
