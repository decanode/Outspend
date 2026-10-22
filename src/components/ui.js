import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native'
import { COLORS } from '../theme/designSystem'

export const Button = ({ title, onPress, variant = 'primary', disabled, style }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.button, variant === 'primary' && styles.buttonPrimary, variant === 'danger' && styles.buttonDanger, variant === 'ghost' && styles.buttonGhost, disabled && { opacity: 0.4 }, style]}
  >
    <Text style={[styles.buttonText, variant === 'danger' && { color: COLORS.coral }, variant === 'ghost' && { color: COLORS.textSecondary }]}>{title}</Text>
  </TouchableOpacity>
)

export const Chip = ({ label, selected, onPress, color }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, selected && { backgroundColor: (color || COLORS.emerald) + '33', borderColor: color || COLORS.emerald }]}
  >
    <Text style={[styles.chipText, selected && { color: COLORS.textPrimary }]}>{label}</Text>
  </TouchableOpacity>
)

export const Field = ({ label, style, ...props }) => (
  <View style={style}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} {...props} />
  </View>
)

export const EmptyState = ({ icon, title, hint }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyTitle}>{title}</Text>
    {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
  </View>
)

export const SectionTitle = ({ children, right }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {right}
  </View>
)

/** Bottom sheet built on Modal: tap the backdrop or hardware back to dismiss. */
export const Sheet = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
)

/** Transient message with an optional action (e.g. Undo). */
export const Snackbar = ({ message, actionLabel, onAction, onDismiss, duration = 5000 }) => {
  const [opacity] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!message) return undefined
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss, opacity])
  if (!message) return null
  return (
    <Animated.View style={[styles.snackbar, { opacity }]}>
      <Text style={styles.snackText}>{message}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction}><Text style={styles.snackAction}>{actionLabel}</Text></TouchableOpacity>
      ) : null}
    </Animated.View>
  )
}

export const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  header: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 40, marginBottom: 16 },
  amount: { fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  rowTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  rowSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  fab: {
    position: 'absolute', right: 24, backgroundColor: COLORS.emerald, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
})

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.2)' },
  buttonPrimary: { backgroundColor: COLORS.emerald },
  buttonDanger: { backgroundColor: 'rgba(239,71,111,0.15)' },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { color: '#fff', fontWeight: '700' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    marginRight: 8, marginBottom: 8,
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13 },
  label: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.inputFill, borderRadius: 8, padding: 10, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.sheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
    maxHeight: '85%', borderColor: COLORS.cardBorder, borderWidth: 1,
  },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  snackbar: {
    position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: '#1f3a52', borderRadius: 10,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 6,
  },
  snackText: { color: COLORS.textPrimary, flex: 1 },
  snackAction: { color: COLORS.emerald, fontWeight: '700', marginLeft: 16 },
})
