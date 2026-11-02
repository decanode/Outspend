import React from 'react'
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'

const Step = ({ n, children }) => (
  <View style={styles.step}>
    <Text style={styles.stepNo}>{n}</Text>
    <Text style={styles.stepText}>{children}</Text>
  </View>
)

/**
 * iPhone only. iOS never lets an app read your messages, so you hand over a bank message yourself:
 * copy it in Messages and paste it into Outspend (or, optionally, share it through a Shortcut).
 */
export default function HowToCapture({ onClose }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.header}>Add bank messages</Text>
          <Text style={styles.link} onPress={onClose}>Close</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.lead}>
            Apple does not allow any app to read your text messages directly. But with a simple 1-minute Shortcut automation, Outspend can capture all your bank messages silently and automatically in the background.
          </Text>

          <Text style={styles.section}>Automatic background capture (recommended)</Text>
          <View style={[GLASS_STYLES.card, styles.card]}>
            <Step n="1">Open the Shortcuts app on your iPhone and tap Automation at the bottom.</Step>
            <Step n="2">Tap + in the top-right corner, then choose Message.</Step>
            <Step n="3">In &quot;Message Contains&quot;, enter keywords like debited, credited, or spent.</Step>
            <Step n="4">Select Run Immediately and turn off Notify When Run. Tap Next.</Step>
            <Step n="5">Choose New Blank Automation, tap Add Action, and search for Outspend.</Step>
            <Step n="6">Select &quot;Add transaction to Outspend&quot; and set the message to Shortcut Input.</Step>
          </View>
          <Text style={styles.note}>
            Once set up, whenever a bank message arrives, it is logged automatically in the background. You never have to copy, paste, or open the app manually.
          </Text>

          <Text style={styles.section}>Alternative: copy and paste</Text>
          <View style={[GLASS_STYLES.card, styles.card]}>
            <Step n="1">Open the bank message in Messages, touch and hold it, and tap Copy.</Step>
            <Step n="2">Open Outspend and tap Paste bank message on the Home tab.</Step>
            <Step n="3">Check what Outspend understood and tap Add.</Step>
          </View>
          <Text style={styles.note}>
            Pasting the same message twice adds it once. To stop iPhone asking each time you paste, go to Settings &gt; Apps &gt; Outspend &gt; Paste from Other Apps &gt; Allow.
          </Text>

          <Text style={styles.section}>Good to know</Text>
          <Text style={styles.note}>
            Outspend always shows what it understood and asks before adding anything, so a stray paste or a link from another app can never add a transaction on its own. Cards, bank transfers and refunds all work the same once a message is pasted.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 12 },
  header: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  link: { color: COLORS.emerald, fontWeight: '600' },
  lead: { color: COLORS.textPrimary, lineHeight: 21, marginBottom: 8 },
  section: { color: COLORS.textSecondary, fontSize: 13, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  card: { marginBottom: 8 },
  step: { flexDirection: 'row', marginTop: 10 },
  stepNo: { color: COLORS.emerald, fontWeight: '700', width: 22 },
  stepText: { color: COLORS.textPrimary, flex: 1, lineHeight: 20 },
  note: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
})
