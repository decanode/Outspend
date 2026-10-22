import RNFS from 'react-native-fs'
import * as Print from 'expo-print'
import { shareAsync } from 'expo-sharing'
import { fetchLiveTransactions } from '../data/transactions'
import { col } from '../data/util'
import { toCsv, toJson, buildBillHtml } from './ExportFormat'

const accountNames = async () => {
  const [accounts, cards] = await Promise.all([col('accounts').query().fetch(), col('credit_cards').query().fetch()])
  const names = {}
  accounts.forEach(a => { names[a.id] = a.name })
  cards.forEach(c => { names[c.id] = c.name })
  return names
}

const sortedTransactions = async () => (await fetchLiveTransactions()).sort((a, b) => b.timestamp - a.timestamp)

// Files go to the app cache and out through the system share sheet: this works on
// every Android version (scoped storage blocks writing straight to Downloads).
const shareText = async (filename, content, mimeType) => {
  const path = `${RNFS.CachesDirectoryPath}/${filename}`
  await RNFS.writeFile(path, content, 'utf8')
  await shareAsync(`file://${path}`, { mimeType, dialogTitle: `Export ${filename}` })
  return path
}

export const exportTransactionsToCSV = async () => {
  const [txs, names] = await Promise.all([sortedTransactions(), accountNames()])
  return shareText('Outspend_Export.csv', toCsv(txs, names), 'text/csv')
}

export const exportTransactionsToJSON = async () => {
  const [txs, names] = await Promise.all([sortedTransactions(), accountNames()])
  return shareText('Outspend_Export.json', toJson(txs, names), 'application/json')
}

/** @param {{ start: number, end: number, categories: string[]|null, rangeLabel: string }} opts */
export const exportGroupBillPdf = async ({ start, end, categories, rangeLabel }) => {
  const all = await sortedTransactions()
  const txs = all.filter(t =>
    t.type === 'DEBIT' &&
    t.timestamp >= start && t.timestamp < end &&
    (!categories || categories.includes(t.category || 'Uncategorized'))
  )
  if (!txs.length) return { count: 0 }
  const { uri } = await Print.printToFileAsync({ html: buildBillHtml(txs, { rangeLabel }) })
  await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: 'Share bill' })
  return { count: txs.length }
}
