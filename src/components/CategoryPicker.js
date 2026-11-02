import React, { useState } from 'react'
import { View, Text, Switch } from 'react-native'
import { Sheet, Chip } from './ui'
import { CATEGORIES } from '../constants/categories'
import { COLORS } from '../theme/designSystem'

/** onSelect(categoryName, applyToAllFromMerchant) */
export default function CategoryPicker({ visible, onClose, onSelect, current, merchant, offerApplyAll = true }) {
  const [applyAll, setApplyAll] = useState(false)
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose a category">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <Chip
            key={c.name}
            label={c.name}
            color={c.color}
            selected={current === c.name}
            onPress={() => { onSelect(c.name, offerApplyAll && applyAll); setApplyAll(false) }}
          />
        ))}
      </View>
      {offerApplyAll && merchant && merchant !== 'Unknown Vendor' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={{ color: COLORS.textPrimary, flex: 1, marginRight: 12 }}>Apply to all from {merchant}</Text>
          <Switch value={applyAll} onValueChange={setApplyAll} trackColor={{ true: COLORS.emerald }} />
        </View>
      ) : null}
    </Sheet>
  )
}
