import React, { useState } from 'react'
import { View, Text, StyleSheet, Modal, Alert, FlatList } from 'react-native'
import withObservables from '@nozbe/with-observables'
import { COLORS, GLASS_STYLES } from '../theme/designSystem'
import { observeRules, updateRule, deleteRule, createRule } from '../data/rules'
import { Button, Chip, EmptyState, Field, Sheet } from '../components/ui'
import CategoryPicker from '../components/CategoryPicker'

const RuleForm = (props) => (props.visible ? <RuleFormBody {...props} /> : null)

function RuleFormBody({ visible, rule, onClose }) {
  const [pattern, setPattern] = useState(rule ? rule.pattern : '')
  const [merchant, setMerchant] = useState(rule ? rule.mapped_merchant : '')
  const [category, setCategory] = useState(rule ? rule.category : null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!pattern.trim() || !merchant.trim()) return setError('Both the text to match and the merchant name are required.')
    if (/^\/.+\/[a-z]*$/i.test(pattern.trim())) {
      try { new RegExp(pattern.trim().slice(1, pattern.trim().lastIndexOf('/'))) } catch { return setError('That regular expression is not valid.') }
    }
    if (rule) await updateRule(rule, { pattern: pattern.trim(), mapped_merchant: merchant.trim(), category })
    else await createRule({ pattern, mapped_merchant: merchant, category })
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={rule ? 'Edit rule' : 'New rule'}>
      <Field label="When a message or merchant contains" value={pattern} onChangeText={setPattern} placeholder="chaiwala@ybl" autoCapitalize="none" style={{ marginBottom: 12 }} />
      <Field label="Name it" value={merchant} onChangeText={setMerchant} placeholder="Chai Point" style={{ marginBottom: 12 }} />
      <Chip label={category || 'Category (optional)'} selected={!!category} onPress={() => setPicking(true)} />
      {error ? <Text style={{ color: COLORS.coral, marginVertical: 8 }}>{error}</Text> : null}
      <Button title="Save" onPress={save} style={{ marginTop: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={onClose} />
      <CategoryPicker visible={picking} onClose={() => setPicking(false)} offerApplyAll={false} current={category}
        onSelect={(c) => { setCategory(c); setPicking(false) }} />
    </Sheet>
  )
}

function MerchantRules({ rules, onClose }) {
  const [editing, setEditing] = useState(undefined) // undefined: closed, null: new, model: edit

  const confirmDelete = (rule) =>
    Alert.alert('Delete rule?', 'Transactions already updated by this rule keep their names.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRule(rule) },
    ])

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.header}>Merchant rules</Text>
          <Text style={styles.link} onPress={onClose}>Close</Text>
        </View>
        <FlatList
          data={rules}
          keyExtractor={r => r.id}
          ListEmptyComponent={<EmptyState title="No rules yet" hint='Rules are created when you name an unknown payment on the Home tab, or tap "New rule".' />}
          renderItem={({ item }) => (
            <View style={[GLASS_STYLES.card, styles.card]}>
              <Text style={styles.name}>{item.mapped_merchant}</Text>
              <Text style={styles.sub}>matches “{item.pattern}”{item.category ? ` → ${item.category}` : ''}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Edit" variant="ghost" onPress={() => setEditing(item)} />
                <Button title="Delete" variant="ghost" onPress={() => confirmDelete(item)} />
              </View>
            </View>
          )}
        />
        <Button title="New rule" onPress={() => setEditing(null)} />
        <RuleForm visible={editing !== undefined} rule={editing || null} onClose={() => setEditing(undefined)} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16, paddingBottom: 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  header: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  link: { color: COLORS.emerald, fontWeight: '600' },
  card: { marginBottom: 10 },
  name: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  sub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
})

export default withObservables([], () => ({ rules: observeRules() }))(MerchantRules)
