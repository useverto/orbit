import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { tx, run } from "ar-gql";
import Head from "next/head";
import {
  Page,
  Breadcrumbs,
  Spacer,
  Note,
  Dot,
  Tag,
  Text,
  Card,
  Description,
} from "@geist-ui/react";
import { GQLNodeInterface } from "ar-gql/dist/types";
import Arweave from "arweave";
import Verto from "@verto/lib";

const getARAmount = (tx: GQLNodeInterface) => {
  return `${parseFloat(tx.quantity.ar)} AR`;
};

const getPSTAmount = async (tx: GQLNodeInterface) => {
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
  const [hash, setHash] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState({
    type: "warning",
    title: "pending",
  });
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);

  const bannerData = [
    {
      content:
        "This order was created before tags for AR transfers were added.",
      timestamp: 1608763440,
    },
  ];
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    if (router.query.id) {
      // @ts-ignore
      setID(router.query.id);

      // @ts-ignore
      tx(router.query.id).then(async (tx) => {
        console.log(tx);
        setOwner(tx.owner.address);
        setPost(tx.recipient);

        const type = tx.tags.find((tag) => tag.name === "Type").value;
        setType(type);

        const hash = tx.tags.find((tag) => tag.name === "Hash")?.value;
        setHash(hash);

        if (type === "Buy") {
          setValue(getARAmount(tx));
        }
        if (type === "Sell") {
          setValue(await getPSTAmount(tx));

          // if (tx.block && tx.block.timestamp > bannerData[0].timestamp)
          setBanners((banners) => {
            return [
              ...banners,
              {
                type: "warning",
                content: bannerData[0].content,
              },
            ];
          });
        }
        if (type === "Swap") {
          const chain = tx.tags.find((tag) => tag.name === "Chain")?.value;
          const value = tx.tags.find((tag) => tag.name === "Value")?.value;

          if (chain) {
            if (value) {
              setValue(`${value} ${chain}`);
            } else {
              setValue(getARAmount(tx));
            }
          }
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
            const match = tx.node.tags.find((tag) => tag.name === "Match");
            setOrders((orders) => {
              return [
                ...orders,
                {
                  title: tx.node.id,
                  description: match ? (
                    <>
                      PST Transfer - {amnt}
                      <Spacer y={0.5} />
                      Match -{" "}
                      <a target="_blank" href={`/order?id=${match.value}`}>
                        {match.value}
                      </a>
                    </>
                  ) : (
                    `PST Transfer - ${amnt}`
                  ),
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
            const amnt = await getARAmount(tx.node);
            const match = tx.node.tags.find((tag) => tag.name === "Match");
            setOrders((orders) => {
              return [
                ...orders,
                {
                  title: tx.node.id,
                  description: match ? (
                    <>
                      AR Transfer - {amnt}
                      <Spacer y={0.5} />
                      Match -{" "}
                      <a target="_blank" href={`/order?id=${match.value}`}>
                        {match.value}
                      </a>
                    </>
                  ) : (
                    `AR Transfer - ${amnt}`
                  ),
                },
              ];
            });
          }
        }
        if (type === "Swap") {
          if (hash) {
            // Going from ETH -> AR
            // Search for "AR-Transfers"
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
              { post: tx.recipient, order: hash }
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

            if (res.data.transactions.edges.length === 0) {
              const config = await new Verto().getConfig(tx.recipient);
              let url = config.publicURL.startsWith("https://")
                ? config.publicURL
                : "https://" + config.publicURL;
              let endpoint = url.endsWith("/") ? "orders" : "/orders";

              const res = await fetch(url + endpoint);
              const orders = await res.clone().json();

              const table = orders.find((table) => table.token === "TX_STORE")
                .orders;
              const entry = table.find((elem) => elem.txHash === hash);

              if (entry) {
                if (entry.parsed === 1) {
                  setBanners((banners) => {
                    return [
                      ...banners,
                      {
                        type: "error",
                        content:
                          "An error occured. Most likely the Ethereum hash submitted is invalid.",
                      },
                    ];
                  });
                  setStatus({
                    type: "error",
                    title: "errored",
                  });
                } else {
                  // We're all good
                }
              } else {
                // This is were it gets tricky ...
              }
            }
          } else {
            // Going from AR -> ETH
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
            type: "secondary",
            title: "cancelled",
          });
        }

        const refundRes = await run(
          `
            query($post: String!, $order: [String!]!) {
              transactions(
                owners: [$post]
                tags: [
                  { name: "Exchange", values: "Verto" }
                  { name: "Type", values: "Refund" }
                  { name: "Order", values: $order }
                ]
                first: 1
              ) {
                edges {
                  node {
                    id
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
          { post: tx.recipient, order: router.query.id }
        );
        if (refundRes.data.transactions.edges[0]) {
          const tx = refundRes.data.transactions.edges[0].node;
          let amnt;
          if (type === "Buy") {
            amnt = await getARAmount(tx);
          }
          if (type === "Sell") {
            amnt = await getPSTAmount(tx);
          }
          setOrders((orders) => {
            return [
              ...orders,
              {
                title: tx.id,
                description: `Refund - ${amnt}`,
              },
            ];
          });
          setStatus({
            type: "secondary",
            title: "refunded",
          });
        }

        const returnRes = await run(
          `
            query($post: String!, $order: [String!]!) {
              transactions(
                owners: [$post]
                tags: [
                  { name: "Exchange", values: "Verto" }
                  { name: "Type", values: "${type}-Return" }
                  { name: "Order", values: $order }
                ]
                first: 1
              ) {
                edges {
                  node {
                    id
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
          { post: tx.recipient, order: router.query.id }
        );
        if (returnRes.data.transactions.edges[0]) {
          const tx = returnRes.data.transactions.edges[0].node;
          let amnt;
          if (type === "Buy") {
            amnt = await getARAmount(tx);
          }
          if (type === "Sell") {
            amnt = await getPSTAmount(tx);
          }
          setOrders((orders) => {
            return [
              ...orders,
              {
                title: tx.id,
                description: `Return - ${amnt}`,
              },
            ];
          });
          setStatus({
            type: "secondary",
            title: "returned",
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
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>"
        />
      </Head>
      <Page>
        <Breadcrumbs size="large">
          <Breadcrumbs.Item href={post === "" ? "/" : `/post?addr=${post}`}>
            🌍rbit
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>{id}</Breadcrumbs.Item>
        </Breadcrumbs>

        {banners.map((banner) => (
          <>
            <Spacer y={1} />
            <Note label={banner.type} type={banner.type}>
              {banner.content}
            </Note>
          </>
        ))}

        <Spacer y={1} />

        {/* @ts-expect-error */}
        <Dot type={status.type}>
          {/* @ts-expect-error */}
          <Tag type={status.type}>{status.title}</Tag>
        </Dot>

        <Spacer y={1} />

        <>
          Owner:{" "}
          <a
            target="_blank"
            href={`https://viewblock.io/arweave/address/${owner}`}
          >
            {owner}
          </a>
        </>

        <Spacer y={2} />

        {!loading && (
          <a
            target="_blank"
            href={
              hash
                ? `https://etherscan.io/tx/${hash}`
                : `https://viewblock.io/arweave/tx/${id}`
            }
          >
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
