import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, GLASS_STYLES } from '../theme/designSystem';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={styles.title}>100% Private.</Text>
            <Text style={styles.subtitle}>Outspend never sends your data to any servers. All processing happens right here on your phone.</Text>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.title}>Read SMS</Text>
            <Text style={styles.subtitle}>We need SMS permissions to automatically log your expenses from bank alerts. This data never leaves your device.</Text>
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.title}>Gmail Sync</Text>
            <Text style={styles.subtitle}>Securely log in to Gmail to automatically track e-receipts from merchants like Swiggy and Amazon.</Text>
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.title}>When to start?</Text>
            <Text style={styles.subtitle}>Choose a starting date for your transaction history to limit processing.</Text>
          </>
        );
      default:
        return null;
    }
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={[GLASS_STYLES.card, styles.card]}>
        {renderStep()}
        <TouchableOpacity style={styles.button} onPress={nextStep}>
          <Text style={styles.buttonText}>{step === 4 ? "Let's Go" : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: COLORS.emerald,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.emerald,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
