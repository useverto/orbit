import {useEffect} from "react";
import ArDB from 'ardb';
import Arweave from 'arweave'
import {GQLEdgeTransactionInterface, GQLTransactionInterface} from "ardb/lib/faces/gql";

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
    users.add(transaction.owner) // todo add address
  })

  return users.size
}

const getTradeCount = async (): Promise<number> => {

  const transactions: any = await ardb.search('transactions').tag('Exchange', 'Verto').tag('Type', ['Buy', 'Sell', 'Swap']).findAll();

  return transactions.length
}

const getTokenholderTips = async (): Promise<{ [id: string]: number }> => {

  const transactions: any = await ardb.search('transactions').tag('Exchange', 'Verto').tag('Type', 'Fee-VRT-Holder').findAll();
  const tips = {}

  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    let amount, contract;

    for (const tag of transaction.node.tags) {

      if (tag.name == "Input") {
        const data = JSON.parse(tag.value)
        amount = parseInt(data.qty)
      }
      if (tag.name == "Contract") {
        contract = tag.value
      }
    }

    if (contract in tips) {
      tips[contract] += amount
    } else {
      tips[contract] = amount
    }
  })

  return tips
}

const getVolume = async (): Promise<number> => {

  const transactions: any = await ardb.search('transactions').tag('Exchange', 'Verto').tag('Type', 'Buy').findAll();
  let volume = 0

  transactions.map((transaction: GQLEdgeTransactionInterface) => {
    volume += parseFloat(transaction.node.quantity.ar)
  })

  return volume
}

const Analytics = () => {
  // unique user count
  useEffect(() => {
    getUniqueUsers().then((count) => {
      console.log("Unique Users", count)
    })
    getTradeCount().then((count) => {
      console.log("Trades", count)
    })
    getTokenholderTips().then((tips) => {
      console.log("VRT holder tips", tips)
    })
    getVolume().then((volume) => {
      console.log("AR Volume", volume)
    })
  }, [])

  return (
    <>
      Hello World!
    </>
  )
}

export default Analytics;