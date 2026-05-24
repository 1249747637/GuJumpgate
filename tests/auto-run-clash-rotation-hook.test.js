const assert = require('node:assert/strict');
const test = require('node:test');

require('../background/auto-run-controller.js');

function createAutoRunHarness(options = {}) {
  const {
    runAutoSequenceFromNode = async () => {},
    isStopError = () => false,
    getStopRequested = () => false,
  } = options;
  const completions = [];
  const logs = [];
  const statuses = [];
  let state = {
    nodeStatuses: {},
    autoRunFallbackThreadIntervalMinutes: 0,
  };
  const runtimeState = {
    autoRunActive: false,
    autoRunCurrentRun: 0,
    autoRunTotalRuns: 0,
    autoRunAttemptRun: 0,
    autoRunSessionId: 0,
  };

  const controller = globalThis.MultiPageBackgroundAutoRunController.createAutoRunController({
    addLog: async (message, level) => logs.push({ message, level }),
    appendAccountRunRecord: async () => ({ id: 'record' }),
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 0,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload) => statuses.push({ phase, payload }),
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => 1,
    ensureHotmailMailboxReadyForAutoRunRound: async () => {},
    getAutoRunStatusPayload: (phase, payload = {}) => ({ autoRunPhase: phase, ...payload }),
    getErrorMessage: (error) => String(error?.message || error || ''),
    getFirstUnfinishedNodeId: () => null,
    getPendingAutoRunTimerPlan: () => null,
    getRunningNodeIds: () => [],
    getState: async () => state,
    getStopRequested,
    hasSavedNodeProgress: () => false,
    isAddPhoneAuthFailure: () => false,
    isCloudCheckoutAlreadyPaidFailure: () => false,
    isGpcTaskEndedFailure: () => false,
    isHostedCheckoutGenericErrorFailure: () => false,
    isHostedCheckoutVerificationResendLimitFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError,
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: () => 0,
    onAutoRunRoundComplete: async (payload) => completions.push(payload),
    persistAutoRunTimerPlan: async () => {},
    resetState: async () => {
      state = {
        nodeStatuses: {},
        autoRunFallbackThreadIntervalMinutes: 0,
      };
    },
    runAutoSequenceFromNode,
    runtime: {
      get: () => ({ ...runtimeState }),
      set: (updates = {}) => Object.assign(runtimeState, updates),
    },
    setState: async (updates = {}) => {
      state = { ...state, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: () => {},
    waitForRunningNodesToFinish: async () => state,
    chrome: {
      runtime: {
        sendMessage: () => Promise.resolve(),
      },
    },
  });

  return {
    completions,
    controller,
    logs,
    statuses,
  };
}

test('auto-run notifies the round-complete hook after a successful round', async () => {
  const harness = createAutoRunHarness();

  await harness.controller.autoRunLoop(1);

  assert.equal(harness.completions.length, 1);
  assert.equal(harness.completions[0].status, 'success');
  assert.equal(harness.completions[0].targetRun, 1);
  assert.equal(harness.completions[0].totalRuns, 1);
});

test('auto-run notifies the round-complete hook after a final failed round without retries', async () => {
  const harness = createAutoRunHarness({
    runAutoSequenceFromNode: async () => {
      throw new Error('boom');
    },
  });

  await harness.controller.autoRunLoop(1, { autoRunSkipFailures: false });

  assert.equal(harness.completions.length, 1);
  assert.equal(harness.completions[0].status, 'failed');
  assert.equal(harness.completions[0].finalFailureReason, 'boom');
});

test('auto-run does not notify the round-complete hook when the user stops the round', async () => {
  const stopError = new Error('user stopped');
  const harness = createAutoRunHarness({
    runAutoSequenceFromNode: async () => {
      throw stopError;
    },
    isStopError: (error) => error === stopError,
  });

  await harness.controller.autoRunLoop(1);

  assert.equal(harness.completions.length, 0);
});
