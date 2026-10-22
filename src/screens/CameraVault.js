import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { COLORS } from '../theme/designSystem';

export default function CameraVault({ onClose, onImageCaptured }) {
  const device = useCameraDevice('back');
  const camera = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePhoto = async () => {
    if (camera.current) {
      const photo = await camera.current.takePhoto();
      const localPath = `${RNFS.DocumentDirectoryPath}/receipt_${Date.now()}.jpg`;
      
      // Move photo to permanent storage
      await RNFS.moveFile(photo.path, localPath);
      
      Alert.alert("Saved", "Receipt saved securely to your offline vault.");
      if (onImageCaptured) onImageCaptured(localPath);
      if (onClose) onClose();
    }
  };

  if (!hasPermission) return <View style={styles.container}><Text>No Camera Permission</Text></View>;
  if (device == null) return <View style={styles.container}><Text>No Camera Found</Text></View>;

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />
      
      <View style={styles.controls}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
          <View style={styles.innerCircle} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  closeBtn: {
    padding: 16,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
  }
});
