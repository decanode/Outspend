import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { database } from '../db'
import { Q } from '@nozbe/watermelondb'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { Ionicons } from '@expo/vector-icons'
import { VoiceService } from '../services/VoiceService'
import { processIncomingSms } from '../services/TransactionManager'

const NeedsAttentionCard = ({ transaction }) => (
  <View style={[GLASS_STYLES.card, styles.carouselCard]}>
    <Text style={styles.carouselText}>₹{transaction.amount} paid via UPI. Who was this to?</Text>
    <TextInput 
      style={styles.input} 
      placeholder="Merchant Name" 
      placeholderTextColor={COLORS.textSecondary} 
    />
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>Save Rule</Text>
    </TouchableOpacity>
  </View>
)

const Dashboard = ({ needsReviewTransactions, recentTransactions }) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceService, setVoiceService] = useState(null);

  useEffect(() => {
    const service = new VoiceService((result) => {
      Alert.alert("Voice Logged", `Parsed: ${result}`);
      setIsListening(false);
      service.stopListening();
      
      // Basic fallback to mock saving a manual voice note
      database.write(async () => {
        await database.collections.get('transactions').create(tx => {
          tx.amount = 0 // Needs NLP parsing
          tx.merchant = 'Voice Note'
          tx.type = 'DEBIT'
          tx.timestamp = Date.now()
          tx.source = 'VOICE'
          tx.raw_text = result
          tx.needs_review = true
        })
      });
    });
    setVoiceService(service);
    return () => service.destroy();
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    } else {
      voiceService.startListening();
      setIsListening(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceValue}>₹48,750.00</Text>
      </View>

      {/* Needs Attention Carousel */}
      {needsReviewTransactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Needs Attention</Text>
          <FlatList
            horizontal
            data={needsReviewTransactions}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <NeedsAttentionCard transaction={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          />
        </View>
      )}

      {/* Recent Activity List */}
      <View style={[styles.section, { flex: 1 }]}>
        <Text style={styles.sectionTitle}>Synced from SMS and Emails</Text>
        <FlatList
          data={recentTransactions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[GLASS_STYLES.card, styles.transactionCard]}>
              <View>
                <Text style={styles.merchant}>{item.merchant}</Text>
                <Text style={styles.date}>{new Date(item.timestamp).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.amount, { color: item.type === 'CREDIT' ? COLORS.emerald : COLORS.coral }]}>
                {item.type === 'CREDIT' ? '+' : '-'}₹{item.amount}
              </Text>
            </View>
          )}
        />
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, isListening && styles.fabActive]} 
        onPress={toggleVoice}
      >
        <Ionicons name="mic" size={24} color="#fff" />
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
    marginBottom: 24,
    marginTop: 40,
  },
  balanceLabel: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 8,
  },
  balanceValue: {
    color: COLORS.emerald,
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  carouselContainer: {
    paddingRight: 16,
  },
  carouselCard: {
    width: 280,
    marginRight: 12,
  },
  carouselText: {
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 10,
    color: COLORS.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  button: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.emerald,
    fontWeight: '600',
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  merchant: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  date: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: COLORS.emerald,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabActive: {
    backgroundColor: COLORS.coral,
  }
})

const enhance = withObservables([], () => ({
  needsReviewTransactions: database.collections.get('transactions').query(Q.where('needs_review', true)),
  recentTransactions: database.collections.get('transactions').query(Q.sortBy('timestamp', Q.desc), Q.take(5)),
}))

export default enhance(Dashboard)
