import {useEffect} from "react";
import ArDB from 'ardb';
import Arweave from 'arweave'
import {GQLTransactionInterface} from "ardb/lib/faces/gql";

const config = {
  host: 'arweave.net',// Hostname or IP address for a Arweave host
  port: 443,          // Port
  protocol: 'https',  // Network protocol http or https
  timeout: 20000,     // Network request timeouts in milliseconds
  logging: false,     // Enable network request logging
}

const ardb = new ArDB(new Arweave(config));

const getUniqueUsers = async (): Promise<number> => {

  const transactions: any = await ardb.search('transactions').tag('Exchange', 'Verto').tag('Type', ['Buy', 'Sell', 'Swap']).findAll();

  const users = new Set()
  transactions.map((transaction: GQLTransactionInterface) => {
    users.add(transaction.owner.address)
  })

  return users.size
}

const Analytics = () => {
  // unique user count
  useEffect(() => {
    getUniqueUsers().then((count) => {
      console.log(count)
    })

  }, [])

  return (
    <>
      Hello World!
    </>
  )
}

export default Analytics;