/* eslint-env node */

const appConfig = require('./app.json');

module.exports = ({ config }) => {
  const easProjectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    appConfig.expo.extra?.eas?.projectId;

  return {
    ...config,
    ...appConfig.expo,
    extra: {
      ...config.extra,
      ...appConfig.expo.extra,
      eas: {
        ...config.extra?.eas,
        ...appConfig.expo.extra?.eas,
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },
  };
};
