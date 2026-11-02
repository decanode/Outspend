const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

// Adds the "Add transaction to Outspend" App Intent (plugins/ios/OutspendCaptureIntent.swift) to the
// generated iOS project, so an iPhone Message automation can pass a bank SMS to the app without opening it.
// ios/ is regenerated on every prebuild, so the file is copied in and linked each time.
const FILE = 'OutspendCaptureIntent.swift';

module.exports = function withCaptureIntent(config) {
  config = withDangerousMod(config, ['ios', (cfg) => {
    const dest = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName, FILE);
    fs.copyFileSync(path.join(__dirname, 'ios', FILE), dest);
    return cfg;
  }]);
  return withXcodeProject(config, (cfg) => {
    const name = cfg.modRequest.projectName;
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${name}/${FILE}`,
      groupName: name,
      project: cfg.modResults,
    });
    return cfg;
  });
};
