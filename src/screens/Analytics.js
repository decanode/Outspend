import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { PieChart } from 'react-native-gifted-charts'

export default function Analytics() {
  const pieData = [
    { value: 40, color: '#3b82f6', text: '40%' },
    { value: 25, color: '#10b981', text: '25%' },
    { value: 20, color: '#f59e0b', text: '20%' },
    { value: 15, color: '#ef476f', text: '15%' },
  ];

  const merchants = [
    { id: '1', name: 'Swiggy', amount: 4500 },
    { id: '2', name: 'Amazon', amount: 3200 },
    { id: '3', name: 'Uber', amount: 1800 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Analytics</Text>
      <Text style={styles.monthSelector}>September 2026 ▾</Text>

      <View style={[GLASS_STYLES.card, styles.chartCard]}>
        <Text style={styles.cardTitle}>Spending Breakdown</Text>
        <View style={styles.chartContainer}>
          <PieChart
            donut
            innerRadius={60}
            data={pieData}
            centerLabelComponent={() => {
              return <Text style={{fontSize: 24, color: 'white', fontWeight: 'bold'}}>₹14K</Text>;
            }}
          />
        </View>
        <View style={styles.legendContainer}>
          <Text style={styles.legendText}>Housing (40%)</Text>
          <Text style={styles.legendText}>Food & Dining (25%)</Text>
          <Text style={styles.legendText}>Transport (20%)</Text>
          <Text style={styles.legendText}>Entertainment (15%)</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Top Merchants</Text>
      <FlatList
        data={merchants}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[GLASS_STYLES.card, styles.merchantRow]}>
            <Text style={styles.merchantName}>{item.name}</Text>
            <Text style={styles.merchantAmount}>₹{item.amount}</Text>
          </View>
        )}
      />
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
    marginTop: 40,
  },
  monthSelector: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  chartCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    width: '48%',
    marginBottom: 4,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 16,
  },
  merchantName: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  merchantAmount: {
    color: COLORS.coral,
    fontSize: 16,
    fontWeight: 'bold',
  }
})
