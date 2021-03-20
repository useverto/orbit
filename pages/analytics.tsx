import { useEffect, useState } from "react";
import ArDB from "ardb";
import Arweave from "arweave";
import {
  GQLEdgeTransactionInterface,
  GQLTransactionInterface,
} from "ardb/lib/faces/gql";
import {
  Button,
  Card,
  Col,
  Grid,
  Input,
  Loading,
  Row,
  Spacer,
  Table,
  useInput,
} from "@geist-ui/react";

const config = {
  host: "arweave.net", // Hostname or IP address for a Arweave host
  port: 443, // Port
  protocol: "https", // Network protocol http or https
  timeout: 20000, // Network request timeouts in milliseconds
  logging: false, // Enable network request logging
};

const arweave = new Arweave(config);

const ardb = new ArDB(arweave);

const getUniqueUsers = async (): Promise<number> => {
  const transactions: any = await ardb
    .search("transactions")
    .tag("Exchange", "Verto")
    .tag("Type", ["Buy", "Sell", "Swap"])
    .findAll();

  const users = new Set();
  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    users.add(transaction.node.owner.address);
  });

  return users.size;
};

const getTradeCount = async (): Promise<number> => {
  const transactions: any = await ardb
    .search("transactions")
    .tag("Exchange", "Verto")
    .tag("Type", ["Buy", "Sell", "Swap"])
    .findAll();

  return transactions.length;
};

const getTokenholderTips = async (
  address?: string
): Promise<{ ticker: string; name: string; amount: number }[]> => {
  let query = ardb
    .search("transactions")
    .tag("Exchange", "Verto")
    .tag("Type", "Fee-VRT-Holder");

  if (address) query = query.to(address);

  const transactions: any = await query.findAll();
  const tips = {};

  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    let amount, contract;

    for (const tag of transaction.node.tags) {
      if (tag.name == "Input") {
        const data = JSON.parse(tag.value);
        amount = parseInt(data.qty);
      }
      if (tag.name == "Contract") {
        contract = tag.value;
      }
    }

    if (contract in tips) {
      tips[contract] += amount;
    } else {
      tips[contract] = amount;
    }
  });

  let result = [];
  for (const contract in tips) {
    const data = await arweave.transactions.getData(contract, {
      decode: true,
      string: true,
    });
    const ticker = JSON.parse(data.toString()).ticker;
    const name = JSON.parse(data.toString()).name;

    result.push({ ticker, name, amount: tips[contract] });
  }

  result = result.sort((a, b) => b.amount - a.amount);

  return result;
};

const getVolume = async (): Promise<number> => {
  const transactions: any = await ardb
    .search("transactions")
    .tag("Exchange", "Verto")
    .tag("Type", "Buy")
    .findAll();

  let volume = 0;

  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    volume += parseFloat(transaction.node.quantity.ar);
  });

  return volume;
};

const getRetention = async (): Promise<number> => {
  const transactions: any = await ardb
    .search("transactions")
    .tag("Exchange", "Verto")
    .tag("Type", "Buy")
    .findAll();

  const data = {};

  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    const owner = transaction.node.owner.address;
    if (owner in data) {
      data[owner] += 1;
    } else {
      data[owner] = 1;
    }
  });

  let moreThanOne = 0;
  for (const [address, count] of Object.entries(data)) {
    if (count > 1) moreThanOne++;
  }
  return moreThanOne;
};

const Analytics = () => {
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [retention, setRetention] = useState(0);
  const [totalTrades, setTotalTrades] = useState(0);
  const [volume, setVolume] = useState(0);
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);

  const { bindings: addressInputBindings, state: address } = useInput("");

  // unique user count
  useEffect(() => {
    getUniqueUsers().then((count) => {
      setUniqueUsers(count);
    });
    getRetention().then((count) => {
      setRetention(count);
    });
    getTradeCount().then((count) => {
      setTotalTrades(count);
    });
    getVolume().then((volume) => {
      setVolume(parseFloat(volume.toFixed(4)));
    });
    refetchTips();
  }, []);

  const refetchTips = async () => {
    setTipsLoading(true);
    const tips = await getTokenholderTips(address);
    setTips(tips);
    setTipsLoading(false);
  };

  return (
    <>
      <h1 style={{ textAlign: "center" }}>Verto Analytics</h1>
      <Spacer y={2.5} />
      <Row gap={2}>
        <Col>
          <Card style={{ textAlign: "center" }}>
            <h4>Unique Users</h4>
            <Card.Content>
              <h3>{uniqueUsers}</h3>
            </Card.Content>
          </Card>
        </Col>
        <Col>
          <Card style={{ textAlign: "center" }}>
            <h4>User retention</h4>
            <Card.Content>
              <h3>{retention}</h3>
            </Card.Content>
          </Card>
        </Col>
        <Col>
          <Card style={{ textAlign: "center" }}>
            <h4>Trades</h4>
            <Card.Content>
              <h3>{totalTrades}</h3>
            </Card.Content>
          </Card>
        </Col>
        <Col>
          <Card style={{ textAlign: "center" }}>
            <h4>Volume</h4>
            <Card.Content>
              <h3>{volume} AR</h3>
            </Card.Content>
          </Card>
        </Col>
      </Row>
      <Spacer y={2} />
      <Row gap={2}>
        <Col>
          <Card>
            <h4>VRT holder received:</h4>
            <Input {...addressInputBindings} />
            <Button
              onClick={async () => {
                refetchTips();
              }}
            >
              Refetch
            </Button>
            <Card.Content>
              {tipsLoading ? (
                <Loading />
              ) : (
                <Table data={tips}>
                  <Table.Column prop="name" label="Name" />
                  <Table.Column prop="ticker" label="Ticker" />
                  <Table.Column prop="amount" label="Amount" />
                </Table>
              )}
            </Card.Content>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default Analytics;
