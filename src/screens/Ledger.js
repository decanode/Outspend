import React, { useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Modal, Alert } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { database } from '../db'
import { Q } from '@nozbe/watermelondb'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { Ionicons } from '@expo/vector-icons'
import CameraVault from './CameraVault'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const Ledger = ({ transactions }) => {
  const [showCamera, setShowCamera] = useState(false);

  // Group transactions by date (dummy grouping for UI structure)
  const grouped = [{ title: 'All Transactions', data: transactions }]

  const handleDelete = (item) => {
    Alert.alert("Delete", "Are you sure you want to hide/delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          // Add delete logic using database.write(...)
      }}
    ])
  }

  const handleCategory = (item) => {
    Alert.alert("Category", "Select a new category for this transaction.");
    // In reality, this opens a custom bottom sheet / modal.
  }

  const renderLeftActions = () => (
    <View style={styles.leftAction}>
      <Text style={styles.actionText}>Category</Text>
    </View>
  )

  const renderRightActions = () => (
    <View style={styles.rightAction}>
      <Text style={styles.actionText}>Delete</Text>
    </View>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.header}>Ledger</Text>
        <SectionList
          sections={grouped}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Swipeable
              renderLeftActions={renderLeftActions}
              renderRightActions={renderRightActions}
              onSwipeableLeftOpen={() => handleCategory(item)}
              onSwipeableRightOpen={() => handleDelete(item)}
            >
              <View style={[GLASS_STYLES.card, styles.transactionCard]}>
                <View>
                  <Text style={styles.merchant}>{item.merchant}</Text>
                  <Text style={styles.source}>{item.source}</Text>
                </View>
                <Text style={[styles.amount, { color: item.type === 'CREDIT' ? COLORS.emerald : COLORS.coral }]}>
                  {item.type === 'CREDIT' ? '+' : '-'}₹{item.amount}
                </Text>
              </View>
            </Swipeable>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
        />

        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setShowCamera(true)}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>

        <Modal visible={showCamera} animationType="slide">
          <CameraVault onClose={() => setShowCamera(false)} />
        </Modal>
      </View>
    </GestureHandlerRootView>
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
    marginBottom: 16,
    marginTop: 40,
  },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
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
  source: {
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
  leftAction: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    flex: 1,
    borderRadius: 16,
    marginBottom: 8,
    paddingLeft: 24,
  },
  rightAction: {
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flex: 1,
    borderRadius: 16,
    marginBottom: 8,
    paddingRight: 24,
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
  }
})

const enhance = withObservables([], () => ({
  transactions: database.collections.get('transactions').query(Q.sortBy('timestamp', Q.desc)),
}))

export default enhance(Ledger)
