import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'

export default function Accounts() {
  const [balanceInput, setBalanceInput] = useState('');

  const handleAdjustBalance = () => {
    Alert.alert("Balance Updated", `New seeded balance is ₹${balanceInput}`);
    setBalanceInput('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Net Worth & Reconciliation</Text>
      
      <View style={[GLASS_STYLES.card, styles.card]}>
        <Text style={styles.cardTitle}>HDFC Savings</Text>
        <Text style={styles.balance}>App Balance: ₹1,45,000</Text>
        
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="New Balance"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={balanceInput}
            onChangeText={setBalanceInput}
          />
          <TouchableOpacity style={styles.button} onPress={handleAdjustBalance}>
            <Text style={styles.buttonText}>Adjust</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[GLASS_STYLES.card, styles.card]}>
        <Text style={styles.cardTitle}>SBI Cashback</Text>
        <Text style={styles.alertText}>₹48,000 / ₹50,000 Limit reached</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '96%', backgroundColor: COLORS.coral }]} />
        </View>
      </View>
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
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  balance: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 10,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginRight: 8,
  },
  button: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.emerald,
    fontWeight: 'bold',
  },
  alertText: {
    color: COLORS.coral,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  }
})
