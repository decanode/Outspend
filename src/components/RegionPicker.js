import React, { useState } from 'react'
import { View, Text } from 'react-native'
import { Sheet, Chip, Button } from './ui'
import { COLORS } from '../theme/designSystem'
import { REGIONS, currencyList, currencySymbol } from '../regions'

/**
 * Choose the country (sets currency, number style, date format and how messages are read).
 * "Other country" lets the user pick any supported currency.
 */
export default function RegionPicker({ visible, title = 'Where are you?', initialRegion, initialCurrency, warning, onClose, onSave }) {
  const [region, setRegion] = useState(initialRegion || 'OTHER')
  const [currency, setCurrency] = useState(initialCurrency || 'USD')
  const selected = REGIONS.find(r => r.id === region)

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 }}>
        This sets your currency, number and date format, and how bank messages are read.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {REGIONS.map(r => (
          <Chip key={r.id} label={r.id === 'OTHER' ? r.name : `${r.name} · ${currencySymbol(r.currency)}`} selected={region === r.id} onPress={() => setRegion(r.id)} />
        ))}
      </View>
      {selected && selected.customCurrency ? (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginVertical: 8 }}>Currency</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {currencyList().map(c => <Chip key={c} label={`${c} ${currencySymbol(c)}`} color={COLORS.blue} selected={currency === c} onPress={() => setCurrency(c)} />)}
          </View>
        </>
      ) : null}
      {selected && selected.smsProfile === 'GLOBAL' ? (
        <Text style={{ color: COLORS.amber, fontSize: 12, marginTop: 8 }}>
          Bank messages outside India are read with a general English profile. If some are missed or misread, please report them so the profile can be tuned.
        </Text>
      ) : null}
      {warning ? <Text style={{ color: COLORS.coral, fontSize: 12, marginTop: 8 }}>{warning}</Text> : null}
      <Button title="Continue" onPress={() => onSave(region, selected && selected.customCurrency ? currency : null)} style={{ marginTop: 16 }} />
      {onClose ? <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} /> : null}
    </Sheet>
  )
}
