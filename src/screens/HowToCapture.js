import React from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Linking } from 'react-native'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { Button } from '../components/ui'
import { SHORTCUT_URL } from '../config'

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
            Apple does not allow any app to read your text messages, so Outspend cannot see them on its own. Instead you copy a bank message and paste it into Outspend. It takes a few seconds, and the message never leaves your phone.
          </Text>

          <Text style={styles.section}>Each time</Text>
          <View style={[GLASS_STYLES.card, styles.card]}>
            <Step n="1">Open the bank message in Messages.</Step>
            <Step n="2">Touch and hold the message bubble, then tap Copy.</Step>
            <Step n="3">Open Outspend and tap Paste bank message on the Home tab. If iPhone asks, tap Allow Paste.</Step>
            <Step n="4">Check what Outspend understood and tap Add. If the shop is unknown, name it from the Needs attention card.</Step>
          </View>
          <Text style={styles.note}>
            The transaction is dated today; open it in the Ledger to change the date. Pasting the same message twice adds it once. To stop iPhone asking each time, go to Settings, Apps, Outspend, Paste from Other Apps, and choose Allow.
          </Text>

          <Text style={styles.section}>Optional: one tap from the share sheet</Text>
          {SHORTCUT_URL ? (
            <Button title="Install the Add to Outspend shortcut" onPress={() => Linking.openURL(SHORTCUT_URL)} />
          ) : (
            <View style={[GLASS_STYLES.card, styles.card]}>
              <Text style={styles.stepText}>Not needed for Paste. If you like using the Shortcuts app, you can add a share-sheet shortcut yourself:</Text>
              <Step n="1">In Shortcuts, tap + and name it Add to Outspend.</Step>
              <Step n="2">Open its details (the i button), turn on Show in Share Sheet, and keep only Text as the type.</Step>
              <Step n="3">Add URL Encode (set to encode as URL) on Shortcut Input.</Step>
              <Step n="4">Add Open URLs with outspend://capture?text= followed by the Encoded Text.</Step>
            </View>
          )}

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
