import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Sheet, Field, Button, Chip, DateField } from './ui'
import { CATEGORIES } from '../constants/categories'
import { OVERALL } from '../services/Budgets'
import { currencySymbolFor } from '../regions'
import { COLORS } from '../theme/designSystem'
import { parseAmount, parseSignedAmount, parseDateInput, toDateInput } from '../utils/format'

const Err = ({ text }) => (text ? <Text style={{ color: COLORS.coral, marginBottom: 8 }}>{text}</Text> : null)

export const BudgetForm = (props) => (props.visible ? <BudgetFormBody {...props} /> : null)

function BudgetFormBody({ visible, onClose, onSave, onDelete, budget, takenCategories }) {
  const [category, setCategory] = useState(budget ? budget.category : OVERALL)
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '')
  const [error, setError] = useState('')

  const submit = () => {
    const amt = parseAmount(amount)
    if (!amt) return setError('Enter a budget amount greater than 0.')
    onSave({ category, amount: amt })
  }
  const options = [OVERALL, ...CATEGORIES.map(c => c.name)]

  return (
    <Sheet visible={visible} onClose={onClose} title={budget ? 'Edit budget' : 'Set a monthly budget'}>
      {!budget && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {options.map(o => (
            <Chip key={o} label={o === OVERALL ? 'Overall cap' : o} selected={category === o} onPress={() => setCategory(o)}
              color={o === OVERALL ? COLORS.blue : undefined} />
          ))}
        </View>
      )}
      {budget ? <Text style={{ color: COLORS.textPrimary, marginBottom: 12 }}>{budget.category === OVERALL ? 'Overall monthly cap' : budget.category}</Text> : null}
      {!budget && takenCategories.includes(category) ? <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>This category already has a budget; saving replaces its amount.</Text> : null}
      <Field label={`Monthly amount (${currencySymbolFor()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <Err text={error} />
      <Button title="Save" onPress={submit} />
      {budget && onDelete ? <Button title="Delete budget" variant="danger" onPress={onDelete} style={{ marginTop: 8 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

export const GoalForm = (props) => (props.visible ? <GoalFormBody {...props} /> : null)

function GoalFormBody({ visible, onClose, onSave, onDelete, goal }) {
  const [name, setName] = useState(goal ? goal.name : '')
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '')
  const [saved, setSaved] = useState(goal ? String(goal.saved_amount) : '')
  const [date, setDate] = useState(() => toDateInput(goal ? goal.target_date : Date.now() + 180 * 86400000))
  const [error, setError] = useState('')

  const submit = () => {
    const t = parseAmount(target)
    const when = parseDateInput(date, new Date().setHours(12, 0, 0, 0))
    const s = saved.trim() === '' ? 0 : parseSignedAmount(saved)
    if (!name.trim()) return setError('Name your goal.')
    if (!t) return setError('Enter the target amount.')
    if (!Number.isFinite(s) || s < 0) return setError('Saved so far must be 0 or more.')
    if (!when) return setError('Date must be a real date like 2027-03-31.')
    onSave({ name, target_amount: t, saved_amount: s, target_date: when })
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={goal ? 'Edit goal' : 'New savings goal'}>
      <Field label="Goal" value={name} onChangeText={setName} placeholder="New laptop" style={{ marginBottom: 12 }} />
      <Field label={`Target amount (${currencySymbolFor()})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <Field label={`Saved so far (${currencySymbolFor()})`} value={saved} onChangeText={setSaved} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <DateField label="Target date" value={date} onChange={setDate} minimumDate={new Date()} style={{ marginBottom: 12 }} />
      <Err text={error} />
      <Button title="Save" onPress={submit} />
      {goal && onDelete ? <Button title="Delete goal" variant="danger" onPress={onDelete} style={{ marginTop: 8 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}

export const AddMoneyForm = (props) => (props.visible ? <AddMoneyFormBody {...props} /> : null)

function AddMoneyFormBody({ visible, onClose, onSave, goal }) {
  const [amount, setAmount] = useState('')
  const [withdraw, setWithdraw] = useState(false)
  const [error, setError] = useState('')
  const submit = () => {
    const amt = parseAmount(amount)
    if (!amt) return setError('Enter an amount greater than 0.')
    onSave(withdraw ? -amt : amt)
  }
  return (
    <Sheet visible={visible} onClose={onClose} title={goal ? goal.name : 'Goal'}>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Chip label="Add money" selected={!withdraw} onPress={() => setWithdraw(false)} />
        <Chip label="Take out" selected={withdraw} color={COLORS.coral} onPress={() => setWithdraw(true)} />
      </View>
      <Field label={`Amount (${currencySymbolFor()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginBottom: 12 }} />
      <Err text={error} />
      <Button title="Save" onPress={submit} />
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  )
}
