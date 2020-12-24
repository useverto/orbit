import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { tx } from "ar-gql";
import Head from "next/head";
import { Page, Breadcrumbs, Spacer } from "@geist-ui/react";

const Order = () => {
  const router = useRouter();
  const [id, setID] = useState("");
  const [post, setPost] = useState("");

  useEffect(() => {
    if (router.query.id) {
      // @ts-ignore
      setID(router.query.id);

      // @ts-ignore
      tx(router.query.id).then((tx) => {
        setPost(tx.recipient);
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
      </Page>
    </>
  );
};

export default Order;
