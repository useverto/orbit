import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { tx, run } from "ar-gql";
import Head from "next/head";
import {
  Page,
  Breadcrumbs,
  Spacer,
  Dot,
  Tag,
  Text,
  Card,
  Description,
} from "@geist-ui/react";
import { GQLNodeInterface } from "ar-gql/dist/types";
import Arweave from "arweave";

const getARAmount = (tx: GQLNodeInterface) => {
  return `${parseFloat(tx.quantity.ar)} AR`;
};

const getPSTAmount = async (tx: GQLNodeInterface) => {
  console.log(tx);
  const contract = tx.tags.find((tag) => tag.name === "Contract");
  const input = tx.tags.find((tag) => tag.name === "Input");
  if (contract && input) {
    const client = new Arweave({
      host: "arweave.net",
      port: 443,
      protocol: "https",
    });

    const qty = JSON.parse(input.value).qty;
    const res = await client.transactions.getData(contract.value, {
      decode: true,
      string: true,
    });
    const ticker = JSON.parse(res.toString()).ticker;

    return `${qty} ${ticker}`;
  }
};

const Order = () => {
  const router = useRouter();
  const [id, setID] = useState("");
  const [owner, setOwner] = useState("");
  const [post, setPost] = useState("");
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState({
    type: "warning",
    title: "pending",
  });
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (router.query.id) {
      // @ts-ignore
      setID(router.query.id);

      // @ts-ignore
      tx(router.query.id).then(async (tx) => {
        setOwner(tx.owner.address);
        setPost(tx.recipient);

        const type = tx.tags.find((tag) => tag.name === "Type").value;
        setType(type);

        if (type === "Buy") {
          setValue(getARAmount(tx));
        }
        if (type === "Sell") {
          setValue(await getPSTAmount(tx));
        }
        if (type === "Swap") {
          setValue(
            `${tx.tags.find((tag) => tag.name === "Value").value} ${
              tx.tags.find((tag) => tag.name === "Chain").value
            }`
          );
        }

        setLoading(false);

        if (type === "Buy") {
          const res = await run(
            `
            query($post: String!, $order: [String!]!) {
              transactions(
                owners: [$post]
                tags: [
                  { name: "Exchange", values: "Verto" }
                  { name: "Type", values: "PST-Transfer" }
                  { name: "Order", values: $order }
                ]
              ) {
                edges {
                  node {
                    id
                    tags {
                      name
                      value
                    }
                  }
                }
              }
            }
            `,
            { post: tx.recipient, order: router.query.id }
          );

          for (const tx of res.data.transactions.edges) {
            const amnt = await getPSTAmount(tx.node);
            setOrders((orders) => {
              return [
                ...orders,
                {
                  title: tx.node.id,
                  description: `PST Transfer - ${amnt}`,
                },
              ];
            });
          }
        }
        if (type === "Sell") {
          const res = await run(
            `
            query($post: String!, $order: [String!]!) {
              transactions(
                owners: [$post]
                tags: [
                  { name: "Exchange", values: "Verto" }
                  { name: "Type", values: "AR-Transfer" }
                  { name: "Order", values: $order }
                ]
              ) {
                edges {
                  node {
                    id
                    quantity {
                      ar
                    }
                  }
                }
              }
            }
            `,
            { post: tx.recipient, order: router.query.id }
          );

          for (const tx of res.data.transactions.edges) {
            const amnt = await getARAmount(tx.node);
            setOrders((orders) => {
              return [
                ...orders,
                {
                  title: tx.node.id,
                  description: `AR Transfer - ${amnt}`,
                },
              ];
            });
          }
        }

        const res = await run(
          `
          query($post: String!, $order: [String!]!) {
            transactions(
              recipients: [$post]
              tags: [
                { name: "Exchange", values: "Verto" }
                { name: "Type", values: "Cancel" }
                { name: "Order", values: $order }
              ]
              first: 1
            ) {
              edges {
                node {
                  id
                }
              }
            }
          }
          `,
          { post: tx.recipient, order: router.query.id }
        );
        if (res.data.transactions.edges[0]) {
          setOrders((orders) => {
            return [
              ...orders,
              {
                title: res.data.transactions.edges[0].node.id,
                description: `Cancel`,
              },
            ];
          });
          setStatus({
            type: "error",
            title: "cancelled",
          });
        }

        if (type === "Buy" || type === "Sell") {
          const res = await run(
            `
            query($post: String!, $order: [String!]!) {
              transactions(
                owners: [$post]
                tags: [
                  { name: "Exchange", values: "Verto" }
                  { name: "Type", values: "Confirmation" }
                  { name: "Match", values: $order }
                ]
                first: 1
              ) {
                edges {
                  node {
                    id
                    tags {
                      name
                      value
                    }
                  }
                }
              }
            }
            `,
            { post: tx.recipient, order: router.query.id }
          );

          if (res.data.transactions.edges[0]) {
            setOrders((orders) => {
              const received = res.data.transactions.edges[0].node.tags.find(
                (tag) => tag.name === "Received"
              ).value;
              return [
                ...orders,
                {
                  title: res.data.transactions.edges[0].node.id,
                  description: `Confirmation - ${received}`,
                },
              ];
            });
            setStatus({
              type: "success",
              title: "completed",
            });
          }
        }
        if (type === "Swap") {
          // TODO(@johnletey): Query for a swap confirmation
        }
      });
    }
  }, [router.query.id]);

  return (
    <>
      <Head>
        <title>Orbit / Order</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Page>
        <Breadcrumbs size="large">
          <Breadcrumbs.Item href={post === "" ? "/" : `/post?addr=${post}`}>
            🌍rbit
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>{id}</Breadcrumbs.Item>
        </Breadcrumbs>

        <Spacer y={1} />

        {/* @ts-expect-error */}
        <Dot type={status.type}>
          {/* @ts-expect-error */}
          <Tag type={status.type}>{status.title}</Tag>
        </Dot>

        <Text>
          Owner:{" "}
          <a
            target="_blank"
            href={`https://viewblock.io/arweave/address/${owner}`}
          >
            {owner}
          </a>
        </Text>

        <Spacer y={2} />

        {!loading && (
          <a target="_blank" href={`https://viewblock.io/arweave/tx/${id}`}>
            <Card width="50%" style={{ border: "1px dashed #333" }}>
              <Description title={id} content={`${type} - ${value}`} />
            </Card>
          </a>
        )}
        {orders.map((order) => (
          <>
            <Spacer y={1} />
            <a
              target="_blank"
              href={`https://viewblock.io/arweave/tx/${order.title}`}
            >
              <Card width="50%" style={{ border: "1px dashed #333" }}>
                <Description title={order.title} content={order.description} />
              </Card>
            </a>
          </>
        ))}
      </Page>
    </>
  );
};

export default Order;
