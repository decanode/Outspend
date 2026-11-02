import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../theme/designSystem'

/** Labelled horizontal bar: ratio is 0..1 of the track. */
export const HBar = ({ label, value, ratio, color = COLORS.emerald, right }) => (
  <View style={styles.hbar}>
    <View style={styles.hbarHead}>
      <Text style={styles.hbarLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.hbarValue}>{value}</Text>
    </View>
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, Math.round(ratio * 100)))}%`, backgroundColor: color }]} />
    </View>
    {right ? <Text style={styles.hbarRight}>{right}</Text> : null}
  </View>
)

/** Tiny bar sparkline built from Views (no chart library needed). */
export const MiniBars = ({ values, color = COLORS.emerald, height = 28 }) => {
  const max = Math.max(...values, 1)
  return (
    <View style={[styles.mini, { height }]}>
      {values.map((v, i) => (
        <View key={i} style={[styles.miniBar, { height: Math.max(2, (v / max) * height), backgroundColor: color, opacity: i === values.length - 1 ? 1 : 0.55 }]} />
      ))}
    </View>
  )
}

export const Pill = ({ text, color }) => (
  <View style={[styles.pill, { backgroundColor: color + '33' }]}>
    <Text style={[styles.pillText, { color }]}>{text}</Text>
  </View>
)

const styles = StyleSheet.create({
  hbar: { marginBottom: 12 },
  hbarHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hbarLabel: { color: COLORS.textPrimary, fontSize: 13, flex: 1, marginRight: 8 },
  hbarValue: { color: COLORS.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  hbarRight: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  mini: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  miniBar: { width: 8, borderRadius: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
})
