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
 * select it, tap Share, choose the Outspend Shortcut. Nothing is sent anywhere.
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
            Apple does not allow any app to read your text messages, so Outspend cannot see them on its own. Instead you share a bank message to Outspend, and it is added in one tap. The message never leaves your phone.
          </Text>

          <Text style={styles.section}>Each time</Text>
          <View style={[GLASS_STYLES.card, styles.card]}>
            <Step n="1">Open the bank message in Messages.</Step>
            <Step n="2">Touch and hold the message, tap More, and select it. Then tap the Share button.</Step>
            <Step n="3">Choose Add to Outspend. Outspend opens and shows what it understood.</Step>
            <Step n="4">Tap Add. If the shop is unknown, name it from the Needs attention card on Home.</Step>
          </View>
          <Text style={styles.note}>
            The transaction is dated today. Open it in the Ledger to change the date. Sharing the same message twice adds it once.
          </Text>

          <Text style={styles.section}>One-time setup</Text>
          {SHORTCUT_URL ? (
            <Button title="Install the Add to Outspend shortcut" onPress={() => Linking.openURL(SHORTCUT_URL)} />
          ) : (
            <View style={[GLASS_STYLES.card, styles.card]}>
              <Text style={styles.stepText}>The one-tap install link is not available yet. Until it is, build the shortcut yourself in about a minute:</Text>
              <Step n="1">Open the Shortcuts app and tap + to make a new shortcut. Name it Add to Outspend.</Step>
              <Step n="2">Open the shortcut&apos;s details (the i button) and turn on Show in Share Sheet. Under Share Sheet Types keep only Text.</Step>
              <Step n="3">Add the action URL Encode (Encode Text, with URL as the type) and give it Shortcut Input.</Step>
              <Step n="4">Add the action Open URLs. Set its URL to outspend://capture?text= followed by the Encoded Text from the previous step.</Step>
              <Step n="5">Tap Done. It now appears in the share sheet for any text.</Step>
            </View>
          )}

          <Text style={styles.section}>Good to know</Text>
          <Text style={styles.note}>
            Outspend asks you to confirm every message before adding it, so a link from another app can never add a transaction on its own. Nothing is read in the background on iPhone: cards, UPI-style payments and refunds all work the same once a message is shared.
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
