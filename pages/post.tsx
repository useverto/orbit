import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Page, Breadcrumbs } from "@geist-ui/react";
import { all } from "ar-gql";
import { parse } from "path";

const Post = () => {
  const router = useRouter();
  const [addr, setAddr] = useState("");

  const [trades, setTrades] = useState([]);
  useEffect(() => {
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

      console.log(res);
    });
  }, []);

  return (
    <Page>
      <Breadcrumbs size="large">
        <Breadcrumbs.Item>🌍rbit</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/">Trading Posts</Breadcrumbs.Item>
        <Breadcrumbs.Item>{addr}</Breadcrumbs.Item>
      </Breadcrumbs>
    </Page>
  );
};

export default Post;
