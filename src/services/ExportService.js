import RNFS from 'react-native-fs';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';

export const exportTransactionsToCSV = async () => {
  try {
    const transactions = await database.collections.get('transactions').query().fetch();
    
    let csvString = "Date,Merchant,Amount,Type,Source,Category\n";
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toISOString();
      const merchant = tx.merchant ? tx.merchant.replace(/,/g, '') : '';
      const category = tx.category ? tx.category.replace(/,/g, '') : '';
      csvString += `${date},${merchant},${tx.amount},${tx.type},${tx.source},${category}\n`;
    });

    const path = `${RNFS.DownloadDirectoryPath}/Outspend_Export.csv`;
    await RNFS.writeFile(path, csvString, 'utf8');
    console.log('Export saved to', path);
    return path;
  } catch (error) {
    console.error("Export Error", error);
    throw error;
  }
}
