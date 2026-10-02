// Browser-only teaching model. This never launches Java/Python or issues Control authority.
export class ObservatoryDemo {
  constructor(catalog, clock = () => new Date().toISOString()) {
    this.catalog = catalog;
    this.clock = clock;
    this.reset();
  }

  reset() {
    this.sequence = 0;
    this.previousVersion = null;
    this.state = {
      source: {sourceRevision: this.catalog.sourceRevision},
      operation: 'IDLE', operationError: '', closed: false, closing: false,
      definitions: this.catalog.definitions.map(d => ({...d, installed: false})),
      deployments: [], requests: [], ceremonies: [], activeDeploymentId: null,
      activeVersion: null, rollbackVersion: null,
    };
    this.update();
  }

  update() {
    const s = this.state, active = s.deployments.find(d => d.deploymentId === s.activeDeploymentId);
    s.activeEligible = !!active?.alive && active.qualified && !s.closed;
    s.observedLiveWorkers = s.deployments.filter(d => d.alive).length;
    s.eligibleWorkers = s.deployments.filter(d => d.alive && d.qualified).length;
    s.canRollback = !!this.previousVersion && !s.closed;
    s.rollbackVersion = this.previousVersion;
    s.canClose = !s.closed;
    s.allOwnedWorkersStopped = s.closed;
    s.controlStatus = s.closed ? 'DEMO CLOSED' : 'DEMO READY';
    return structuredClone(s);
  }

  event(d, state) {
    d.state = state;
    d.history.push({state, event: 'BROWSER_DEMO', sequence: ++this.sequence});
  }

  install(version, purpose = 'DEMO_INSTALL') {
    const definition = this.state.definitions.find(d => d.version === version);
    if (!definition) throw new Error('Unknown demo version');
    if (purpose === 'DEMO_INSTALL' && definition.installed) throw new Error('Version already installed');
    definition.installed = true;
    const id = `demo-deployment-${++this.sequence}`;
    const d = {
      deploymentId: id, version, purpose, qualified: true, alive: true,
      outstandingPins: 0, history: [],
      realization: {
        workerId: `demo-worker-${this.sequence}`, instanceId: id,
        launchNonce: `browser-demo-${this.sequence}`, environmentDigest: 'demo:browser-only',
        runtimeBinding: {runtimeIdentity: 'demo.browser', runtimeVersion: '1'},
      },
    };
    for (const state of ['REQUESTED', 'LOADING', 'WARMING', 'STANDBY']) this.event(d, state);
    this.state.deployments.push(d);
    return d;
  }

  retireIfDrained(d) {
    if (d?.state === 'DRAINING' && d.outstandingPins === 0) {
      this.event(d, 'UNLOADING'); this.event(d, 'RETIRED'); d.alive = false;
    }
  }

  activate(version) {
    const s = this.state;
    const next = [...s.deployments].reverse().find(d => d.version === version && d.state === 'STANDBY' && d.alive);
    if (!next) throw new Error('Install and warm the demo version first');
    const old = s.deployments.find(d => d.deploymentId === s.activeDeploymentId);
    if (old) {
      this.previousVersion = old.version;
      this.event(old, 'DRAINING'); this.retireIfDrained(old);
    }
    this.event(next, 'ACTIVE'); s.activeDeploymentId = next.deploymentId; s.activeVersion = version;
  }

  complete(r) {
    const d = this.state.deployments.find(d => d.deploymentId === r.executionBinding.realization.deploymentId);
    const definition = this.catalog.definitions.find(d => d.version === r.version);
    const affine = value => Math.fround(Math.fround(Math.fround(value) * Math.fround(definition.scale)) + Math.fround(definition.bias));
    r.score = affine(r.features.normalizedExposure); r.signal = affine(r.features.activity);
    r.executionState = 'SUCCEEDED'; r.canRelease = false; r.completedAt = this.clock();
    r.decision = r.score < this.catalog.policy.review ? 'ALLOW' : r.score < this.catalog.policy.reject ? 'REVIEW' : 'REJECT';
    d.outstandingPins--; this.retireIfDrained(d);
  }

  act(action, extra = {}) {
    const s = this.state;
    if (s.closed) throw new Error('Reset the demo to start another session');
    if (action === 'install') this.install(extra.version);
    else if (action === 'activate') this.activate(extra.version);
    else if (action === 'rollback') {
      if (!s.canRollback) throw new Error('A previously active version is required');
      const target = this.previousVersion;
      this.install(target, 'FRESH_ROLLBACK');
      for (const phase of ['SELECT_PRIOR_BYTES', 'NEW_DEMO_REALIZATION', 'DEMO_WARM', 'DEMO_QUALIFY', 'DEMO_ACTIVATE']) {
        s.ceremonies.push({phase, version: target, observedAt: this.clock()});
      }
      this.activate(target);
    } else if (action === 'invoke') {
      if (!s.activeEligible) throw new Error('Activate an available demo version first');
      const d = s.deployments.find(d => d.deploymentId === s.activeDeploymentId);
      if (d.outstandingPins) throw new Error('Release the held request first');
      const features = this.catalog.samples[extra.sample || 'STANDARD'];
      const mode = extra.mode || 'normal';
      if (!features || !['normal', 'hold', 'crash'].includes(mode)) throw new Error('Unknown demo sample or mode');
      const definition = this.catalog.definitions.find(v => v.version === d.version);
      const id = `R${String(s.requests.length + 1).padStart(3, '0')}`;
      const r = {
        id, version: d.version, mode, features: {...features}, acceptedAt: this.clock(),
        score: null, signal: null, decision: 'WITHHELD', executionState: 'IN_FLIGHT',
        observation: 'Demo pin held; release to simulate completion.', canRelease: mode === 'hold', wireCalled: false,
        javaPolicy: {identity: 'demo:java-threshold-policy@1'}, policyDigest: 'demo:policy-thresholds',
        executionBinding: {
          definition: {definitionIdentity: definition.identity, definitionDigest: definition.digest, environmentDigest: 'demo:browser-only'},
          realization: {...d.realization, deploymentId: d.deploymentId},
          qualificationId: `demo:qualification:${d.deploymentId}`,
          pin: {pinId: `demo:pin:${id}`}, plan: {attemptId: `demo:attempt:${id}`, logicalInvocationId: `demo:invocation:${id}`},
        },
      };
      d.outstandingPins++; s.requests.push(r);
      if (mode === 'normal') this.complete(r);
      if (mode === 'crash') {
        d.alive = false; r.executionState = 'OUTCOME_UNKNOWN'; r.completedAt = this.clock();
        r.observation = 'Browser demonstration of missing outcome; no worker was launched.';
      }
      this.update(); return {id};
    } else if (action === 'release') {
      const r = s.requests.find(r => r.id === extra.requestId && r.canRelease);
      if (!r) throw new Error('No held demo request');
      this.complete(r);
    } else if (action === 'close') {
      for (const r of s.requests.filter(r => r.canRelease)) {
        r.canRelease = false; r.executionState = 'FAILED'; r.decision = 'WITHHELD'; r.completedAt = this.clock();
      }
      for (const d of s.deployments) {
        d.outstandingPins = 0; d.alive = false;
        if (d.state !== 'RETIRED') this.event(d, 'RETIRED');
      }
      s.closed = true; s.activeVersion = null; s.activeDeploymentId = null;
    } else throw new Error('Unknown demo action');
    this.update(); return {};
  }

  receipt() {
    if (!this.state.closed) throw new Error('Close the demo session before exporting');
    return {
      schemaVersion: 'jpyxis.io/frontend-demo-receipt/v1alpha1',
      scope: 'Browser-only simulation. No Java host, Python worker, dispatch, qualification or physical shutdown evidence.',
      sourceRevision: this.catalog.sourceRevision,
      requests: structuredClone(this.state.requests), ceremonies: structuredClone(this.state.ceremonies),
    };
  }
}
