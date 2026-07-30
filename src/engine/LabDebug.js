/**
 * Limits lab instrumentation to deliberately opted-in development or test builds.
 *
 * @param {{ isDevelopmentOrTest: boolean, optIn: boolean }} options
 */
export function isLabDebugEnabled({ isDevelopmentOrTest, optIn }) {
  return isDevelopmentOrTest && optIn;
}
