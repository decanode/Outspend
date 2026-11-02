import React, { useEffect, useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Alert, Platform } from 'react-native'
import { Camera, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera'
import RNFS from 'react-native-fs'
import { COLORS } from '../theme/designSystem'

const RECEIPT_DIR = `${RNFS.DocumentDirectoryPath}/receipts`

/** Full-screen receipt capture. Photos live in app-private storage and never leave the device. */
export default function CameraVault({ onClose, onImageCaptured }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const photoOutput = usePhotoOutput()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission()
  }, [hasPermission, canRequestPermission, requestPermission])

  const takePhoto = async () => {
    if (busy) return
    setBusy(true)
    try {
      const file = await photoOutput.capturePhotoToFile({}, {})
      await RNFS.mkdir(RECEIPT_DIR)
      const ext = (file.filePath.split('.').pop() || 'jpg').toLowerCase()
      const dest = `${RECEIPT_DIR}/receipt_${Date.now()}.${ext}`
      await RNFS.moveFile(file.filePath, dest)
      const uri = Platform.OS === 'android' ? `file://${dest}` : dest
      if (onImageCaptured) await onImageCaptured(uri)
      if (onClose) onClose()
    } catch (e) {
      console.error('Receipt capture failed', e)
      Alert.alert('Could not save receipt', 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is needed to capture receipts.</Text>
        {canRequestPermission && (
          <TouchableOpacity style={styles.closeBtn} onPress={requestPermission}>
            <Text style={styles.closeText}>Allow camera</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device="back" isActive outputs={[photoOutput]} />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.captureBtn, busy && { opacity: 0.5 }]} onPress={takePhoto} disabled={busy}>
          <View style={styles.innerCircle} />
        </TouchableOpacity>
        <View style={styles.closeBtn} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  message: { color: '#fff', marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 },
  controls: {
    position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%',
    justifyContent: 'space-around', alignItems: 'center',
  },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  innerCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.textPrimary },
  closeBtn: { padding: 16, minWidth: 70, alignItems: 'center' },
  closeText: { color: '#fff', fontSize: 16 },
})
