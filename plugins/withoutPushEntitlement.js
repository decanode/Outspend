const { withEntitlementsPlist } = require('expo/config-plugins');

// expo-notifications (57.0.23) always adds aps-environment to the entitlements, even though this
// app only ever schedules local, on-device reminders (subscriptions, salary nudges, budgets) --
// there is no server to push from, and the installed plugin version has no option to opt out.
// Run this after "expo-notifications" in app.json's plugins array so it strips what was just added;
// a provisioning profile without the Push Notifications capability otherwise fails to build.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
