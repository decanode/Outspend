import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { exportTransactionsToCSV } from '../services/ExportService'
import * as Print from 'expo-print'
import { shareAsync } from 'expo-sharing'

export default function Settings() {
  const handleExport = async () => {
    try {
      await exportTransactionsToCSV();
      Alert.alert("Success", "Data exported to Downloads folder securely.");
    } catch (e) {
      Alert.alert("Error", "Could not export data.");
    }
  };

  const handleExportPDF = async () => {
    try {
      const html = `
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #10b981;">Outspend Group Bill Summary</h1>
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #ccc;">
                <th>Date</th><th>Merchant</th><th>Amount</th>
              </tr>
              <tr><td>2026-09-26</td><td>Swiggy</td><td>₹4,500</td></tr>
              <tr><td>2026-09-27</td><td>Uber</td><td>₹1,800</td></tr>
            </table>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("Error", "Could not generate PDF.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Privacy & Controls</Text>
      
      <View style={[GLASS_STYLES.card, styles.card]}>
        <Text style={styles.rowText}>Google Play Status: Active Trial (29 Days left)</Text>
      </View>
      
      <TouchableOpacity style={[GLASS_STYLES.card, styles.actionRow]} onPress={handleExport}>
        <Text style={styles.actionText}>Export Data to CSV</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[GLASS_STYLES.card, styles.actionRow]} onPress={handleExportPDF}>
        <Text style={styles.actionText}>Export Group Bill (PDF)</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 40,
  },
  card: {
    marginBottom: 16,
  },
  rowText: {
    color: COLORS.textPrimary,
  },
  actionRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: COLORS.emerald,
    fontWeight: 'bold',
  }
})
