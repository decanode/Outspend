import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS, GLASS_STYLES } from '../theme/designSystem';
import { exportTransactionsToCSV } from '../services/ExportService';
import { requestSubscription } from 'react-native-iap';

const SUBSCRIPTION_SKU = 'com.decanode.outspend.premium_monthly';

export default function Paywall() {
  
  const handleSubscribe = async () => {
    try {
      await requestSubscription({ sku: SUBSCRIPTION_SKU });
    } catch (err) {
      console.error(err.code, err.message);
    }
  };

  const handleExport = async () => {
    try {
      await exportTransactionsToCSV();
      Alert.alert("Success", "Data exported to Downloads folder securely.");
    } catch (e) {
      Alert.alert("Error", "Could not export data.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[GLASS_STYLES.card, styles.card]}>
        <Text style={styles.title}>Total Financial Clarity.{"\n"}Zero Data Tracking.</Text>
        <Text style={styles.subtitle}>
          Your trial has ended. To keep your data strictly on your device, subscribe for ₹299/month.
        </Text>
        
        <TouchableOpacity style={styles.subButton} onPress={handleSubscribe}>
          <Text style={styles.subButtonText}>Subscribe via Google Play</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>Export Data & Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 32,
    alignItems: 'center',
  },
  title: {
    color: COLORS.emerald,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  subButton: {
    backgroundColor: COLORS.emerald,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  subButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  exportButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  exportButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  }
});
