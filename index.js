import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Android starts this task for every incoming SMS (see SmsReceiver.kt), even when the
// app is closed. It must be registered at bundle load, outside any component.
AppRegistry.registerHeadlessTask('SmsReceivedTask', () => require('./src/services/SmsHeadlessTask').default);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
