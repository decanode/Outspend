import React from 'react'
import { View, Text } from 'react-native'
import { COLORS } from '../theme/designSystem'
import { Button } from './ui'

/** Last line of defence: a render crash shows a recoverable screen instead of a white one. */
export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info && info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ color: COLORS.textSecondary, marginBottom: 24 }}>Your data is safe on this device. Try again.</Text>
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    )
  }
}
