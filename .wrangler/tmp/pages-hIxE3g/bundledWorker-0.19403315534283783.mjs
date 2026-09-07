var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// ../.wrangler/tmp/bundle-rv8jVf/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../node_modules/unenv/dist/runtime/_internal/utils.mjs
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
__name(PerformanceEntry, "PerformanceEntry");
var PerformanceMark = /* @__PURE__ */ __name(class PerformanceMark2 extends PerformanceEntry {
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
}, "PerformanceMark");
var PerformanceMeasure = class extends PerformanceEntry {
  entryType = "measure";
};
__name(PerformanceMeasure, "PerformanceMeasure");
var PerformanceResourceTiming = class extends PerformanceEntry {
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
__name(PerformanceResourceTiming, "PerformanceResourceTiming");
var PerformanceObserverEntryList = class {
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
__name(PerformanceObserverEntryList, "PerformanceObserverEntryList");
var Performance = class {
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
__name(Performance, "Performance");
var PerformanceObserver = class {
  __unenv__ = true;
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
__name(PerformanceObserver, "PerformanceObserver");
__publicField(PerformanceObserver, "supportedEntryTypes", []);
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
import { Socket } from "node:net";
var ReadStream = class extends Socket {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  isRaw = false;
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
  isTTY = false;
};
__name(ReadStream, "ReadStream");

// ../node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
import { Socket as Socket2 } from "node:net";
var WriteStream = class extends Socket2 {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  columns = 80;
  rows = 24;
  isTTY = false;
};
__name(WriteStream, "WriteStream");

// ../node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class extends EventEmitter {
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return "";
  }
  get versions() {
    return {};
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  ref() {
  }
  unref() {
  }
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: () => 0 });
  mainModule = void 0;
  domain = void 0;
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};
__name(Process, "Process");

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var { exit, platform, nextTick } = getBuiltinModule(
  "node:process"
);
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  nextTick
});
var {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  finalization,
  features,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  on,
  off,
  once,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _worker.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context2, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context2.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context2, () => dispatch(i + 1));
        } catch (err2) {
          if (err2 instanceof Error && onError) {
            context2.error = err2;
            res = await onError(err2, context2);
            isError = true;
          } else {
            throw err2;
          }
        }
      } else {
        if (context2.finalized === false && onNotFound) {
          res = await onNotFound(context2);
        }
      }
      if (res && (context2.finalized === false || isError)) {
        context2.res = res;
      }
      return context2;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");
var MAX_NESTING_DEPTH = 32;
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value, nestingState);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".", MAX_NESTING_DEPTH + 2);
  if (keys.length > MAX_NESTING_DEPTH + 1) {
    throwNestingLimitExceeded();
  }
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) {
          throwNestingLimitExceeded();
        }
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");
var throwNestingLimitExceeded = /* @__PURE__ */ __name(() => {
  throw new Error("Nesting limit exceeded");
}, "throwNestingLimitExceeded");
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context2, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context: context2 }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context2, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count3 = 0;
        for (const k in headers) {
          if (++count3 > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
}, "Context");
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err2, c) => {
  if ("getResponse" in err2) {
    const res = err2.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err2);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(methodName, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) {
            this.#addRoute(methodName, this.#path, handler);
          }
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err2, c) {
    if (err2 instanceof Error) {
      return this.errorHandler(err2, c);
    }
    throw err2;
  }
  #dispatch(request, executionCtx, env2, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env2, "GET")))();
    }
    const path = this.getPath(request, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err2) {
        return this.#handleError(err2, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err2) => this.#handleError(err2, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context2 = await composed(c);
        if (!context2.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context2.res;
      } catch (err2) {
        return this.#handleError(err2, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");
var createNullObject = /* @__PURE__ */ __name(() => /* @__PURE__ */ Object.create(null), "createNullObject");
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context2, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context2.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    `^${path.replace(
      /\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g,
      (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ONLY_WILDCARD_REG_EXP_STR : `/:${LABEL_REG_EXP_STR}`
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: createNullObject() };
    this.#routes = { [METHOD_NAME_ALL]: createNullObject() };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap[METHOD_NAME_ALL]) {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") {
      path = "*";
    }
    const methods = method === METHOD_NAME_ALL ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) {
        if (!middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      }
      for (const handlerMap of [middleware, routes]) {
        for (const m of methods) {
          for (const p in handlerMap[m]) {
            re.test(p) && handlerMap[m][p].push([handler, path]);
          }
        }
      }
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) {
      for (const m of methods) {
        if (!routes[m][path2]) {
          this.#insertPath(m, path2);
          routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || [];
        }
        routes[m][path2].push([handler, path2]);
      }
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) {
      matchers[method] = this.#buildMatcher(method);
    }
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
          continue;
        }
        handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [
          h,
          trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
            map[key] = paramReplacementMap[pathData[1][i][1]];
            return map;
          }, createNullObject())
        ]);
      }
    }
    return [regexp, indexReplacementMap.map((i) => handlerData[i]), staticMap];
  }
}, "RegExpRouter");
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");
var emptyParams = createNullObject();
var order = 0;
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node2");
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node = new Node2();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono2");
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "QUERY"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    } else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else {
      return () => "";
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (exposeHeadersStr) {
      set("Access-Control-Expose-Headers", exposeHeadersStr);
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        c.res.headers.append("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) {
        set("Access-Control-Allow-Methods", allowMethods);
      }
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
        }
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");
function getColorEnabled() {
  const { process, Deno } = globalThis;
  const isNoColor = typeof Deno?.noColor === "boolean" ? Deno.noColor : process !== void 0 ? (
    // eslint-disable-next-line no-unsafe-optional-chaining
    "NO_COLOR" in process?.env
  ) : false;
  return !isNoColor;
}
__name(getColorEnabled, "getColorEnabled");
async function getColorEnabledAsync() {
  const { navigator } = globalThis;
  const cfWorkers = "cloudflare:workers";
  const isNoColor = navigator !== void 0 && navigator.userAgent === "Cloudflare-Workers" ? await (async () => {
    try {
      return "NO_COLOR" in ((await import(cfWorkers)).env ?? {});
    } catch {
      return false;
    }
  })() : !getColorEnabled();
  return !isNoColor;
}
__name(getColorEnabledAsync, "getColorEnabledAsync");
var humanize = /* @__PURE__ */ __name((times) => {
  const [delimiter, separator] = [",", "."];
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + delimiter));
  return orderTimes.join(separator);
}, "humanize");
var time3 = /* @__PURE__ */ __name((start) => {
  const delta = Date.now() - start;
  return humanize([delta < 1e3 ? delta + "ms" : Math.round(delta / 1e3) + "s"]);
}, "time");
var colorStatus = /* @__PURE__ */ __name(async (status) => {
  const colorEnabled = await getColorEnabledAsync();
  if (colorEnabled) {
    switch (status / 100 | 0) {
      case 5:
        return `\x1B[31m${status}\x1B[0m`;
      case 4:
        return `\x1B[33m${status}\x1B[0m`;
      case 3:
        return `\x1B[36m${status}\x1B[0m`;
      case 2:
        return `\x1B[32m${status}\x1B[0m`;
    }
  }
  return `${status}`;
}, "colorStatus");
async function log3(fn, prefix, method, path, status = 0, elapsed) {
  const out = prefix === "<--" ? `${prefix} ${method} ${path}` : `${prefix} ${method} ${path} ${await colorStatus(status)} ${elapsed}`;
  fn(out);
}
__name(log3, "log");
var logger = /* @__PURE__ */ __name((fn = console.log) => {
  return /* @__PURE__ */ __name(async function logger2(c, next) {
    const { method, url } = c.req;
    const path = url.slice(url.indexOf("/", 8));
    await log3(fn, "<--", method, path);
    const start = Date.now();
    await next();
    await log3(fn, "-->", method, path, c.res.status, time3(start));
  }, "logger2");
}, "logger");
var CACHE_TTL = 6e4;
var cache = {};
function expired(at) {
  return !at || Date.now() - at > CACHE_TTL;
}
__name(expired, "expired");
function jget(row, fallback) {
  if (!row)
    return fallback;
  try {
    return JSON.parse(row.v);
  } catch {
    return fallback;
  }
}
__name(jget, "jget");
async function getProviders(db) {
  if (cache.providers && !expired(cache.providers.at))
    return cache.providers.data;
  const { results } = await db.prepare("SELECT * FROM providers ORDER BY builtin DESC, name ASC").all();
  const rows = (results || []).map((r) => ({
    id: r.id,
    name: r.name,
    builtin: !!r.builtin,
    enabled: !!r.enabled,
    base_url: r.base_url,
    protocol: r.protocol,
    headers: jget(r.headers, {}),
    keys: jget(r.keys, []),
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
  cache.providers = { data: rows, at: Date.now() };
  return rows;
}
__name(getProviders, "getProviders");
async function getProvider(db, id) {
  const all = await getProviders(db);
  return all.find((p) => p.id === id) || null;
}
__name(getProvider, "getProvider");
async function saveProvider(db, p) {
  await db.prepare(`
        INSERT INTO providers(id, name, builtin, enabled, base_url, protocol, headers, keys, updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, builtin=excluded.builtin, enabled=excluded.enabled,
            base_url=excluded.base_url, protocol=excluded.protocol,
            headers=excluded.headers, keys=excluded.keys, updated_at=excluded.updated_at
    `).bind(
    p.id,
    p.name,
    p.builtin ? 1 : 0,
    p.enabled ? 1 : 0,
    p.base_url,
    p.protocol,
    JSON.stringify(p.headers),
    JSON.stringify(p.keys),
    Date.now()
  ).run();
  cache.providers = void 0;
}
__name(saveProvider, "saveProvider");
async function deleteProvider(db, id) {
  await db.batch([
    db.prepare("DELETE FROM keys WHERE provider_id = ?1").bind(id),
    db.prepare("DELETE FROM providers WHERE id = ?1 AND builtin = 0").bind(id)
  ]);
  cache.providers = void 0;
}
__name(deleteProvider, "deleteProvider");
async function getRoutes(db) {
  if (cache.routes && !expired(cache.routes.at))
    return cache.routes.data;
  const { results } = await db.prepare("SELECT * FROM routes ORDER BY priority DESC, created_at ASC").all();
  const rows = (results || []).map((r) => ({
    id: r.id,
    name: r.name,
    pattern: r.pattern,
    providers: jget(r.providers, []),
    fallback: jget(r.fallback, []),
    priority: r.priority,
    enabled: !!r.enabled,
    created_at: r.created_at
  }));
  cache.routes = { data: rows, at: Date.now() };
  return rows;
}
__name(getRoutes, "getRoutes");
async function saveRoute(db, rt) {
  await db.prepare(`
        INSERT INTO routes(id, name, pattern, providers, fallback, priority, enabled, created_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, pattern=excluded.pattern, providers=excluded.providers,
            fallback=excluded.fallback, priority=excluded.priority, enabled=excluded.enabled
    `).bind(
    rt.id,
    rt.name,
    rt.pattern,
    JSON.stringify(rt.providers),
    JSON.stringify(rt.fallback),
    rt.priority,
    rt.enabled ? 1 : 0,
    rt.created_at || Date.now()
  ).run();
  cache.routes = void 0;
}
__name(saveRoute, "saveRoute");
async function deleteRoute(db, id) {
  await db.prepare("DELETE FROM routes WHERE id = ?1").bind(id).run();
  cache.routes = void 0;
}
__name(deleteRoute, "deleteRoute");
async function getKeys(db, providerId) {
  const sql = providerId ? "SELECT * FROM keys WHERE provider_id = ?1 ORDER BY created_at DESC" : "SELECT * FROM keys ORDER BY created_at DESC";
  const { results } = providerId ? await db.prepare(sql).bind(providerId).all() : await db.prepare(sql).all();
  return (results || []).map((r) => ({
    id: r.id,
    name: r.name,
    provider_id: r.provider_id,
    secret: r.secret,
    hint: r.hint,
    masked: r.masked,
    created_at: r.created_at,
    last_used: r.last_used
  }));
}
__name(getKeys, "getKeys");
async function saveKey(db, k) {
  await db.prepare(`
        INSERT INTO keys(id, name, provider_id, secret, hint, masked, created_at, last_used)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, provider_id=excluded.provider_id, secret=excluded.secret,
            hint=excluded.hint, masked=excluded.masked, last_used=excluded.last_used
    `).bind(
    k.id,
    k.name,
    k.provider_id,
    k.secret,
    k.hint,
    k.masked,
    k.created_at || Date.now(),
    k.last_used
  ).run();
}
__name(saveKey, "saveKey");
async function deleteKey(db, id) {
  await db.prepare("DELETE FROM keys WHERE id = ?1").bind(id).run();
}
__name(deleteKey, "deleteKey");
async function touchKey(db, keyId) {
  await db.prepare("UPDATE keys SET last_used = ?1 WHERE id = ?2").bind(Date.now(), keyId).run();
}
__name(touchKey, "touchKey");
async function metaGet(db, key, fallback) {
  const { results } = await db.prepare("SELECT v FROM meta WHERE k = ?1").bind(key).all();
  return jget(results?.[0], fallback);
}
__name(metaGet, "metaGet");
async function metaSet(db, key, value) {
  await db.prepare(`
        INSERT INTO meta(k, v) VALUES(?1,?2)
        ON CONFLICT(k) DO UPDATE SET v = excluded.v
    `).bind(key, JSON.stringify(value)).run();
}
__name(metaSet, "metaSet");
async function getSettings(db) {
  return metaGet(db, "settings", {
    projectName: "iRouter",
    baseUrl: "",
    apiToken: "",
    tokenMasked: ""
  });
}
__name(getSettings, "getSettings");
async function saveSettings(db, s) {
  await metaSet(db, "settings", s);
}
__name(saveSettings, "saveSettings");
async function getStats(db) {
  return metaGet(db, "stats", { totalRequests: 0, successCount: 0, successRate: 0, avgLatency: 0 });
}
__name(getStats, "getStats");
var MAX_ROWS_PER_INSERT = 20;
var TRIM_KEEP = 2e3;
var LogRing = /* @__PURE__ */ __name(class {
  buf = [];
  timer = null;
  push(l) {
    this.buf.push(l);
    if (this.buf.length >= 200)
      void this.flush();
  }
  // 定时 flush（由 worker 每 60s 调用一次）
  async flush(db) {
    if (!db || this.buf.length === 0)
      return;
    const batch = this.buf.splice(0, this.buf.length);
    const failed = [];
    for (let i = 0; i < batch.length; i += MAX_ROWS_PER_INSERT) {
      const chunk = batch.slice(i, i + MAX_ROWS_PER_INSERT);
      try {
        const values = chunk.map((_, j) => `(?${j * 5 + 1},?${j * 5 + 2},?${j * 5 + 3},?${j * 5 + 4},?${j * 5 + 5},unixepoch())`).join(",");
        const params = [];
        for (const l of chunk)
          params.push(l.model, l.provider, l.ok ? 1 : 0, l.latency_ms, l.status);
        await db.prepare(`INSERT INTO request_logs(model, provider, ok, latency_ms, status, created_at) VALUES ${values}`).bind(...params).run();
      } catch (e) {
        console.error("[logRing] INSERT failed:", e);
        failed.push(...chunk);
      }
    }
    if (failed.length)
      this.buf = [...failed, ...this.buf];
    const inserted = batch.length - failed.length;
    if (inserted <= 0)
      return;
    try {
      await db.prepare(`DELETE FROM request_logs WHERE id <= (SELECT MAX(id) - ${TRIM_KEEP} FROM request_logs) AND (SELECT COUNT(*) FROM request_logs) > ${TRIM_KEEP}`).run();
    } catch (e) {
      console.error("[logRing] trim failed:", e);
    }
    try {
      const okN = batch.reduce((n, l) => l.ok && !failed.includes(l) ? n + 1 : n, 0);
      const latSum = batch.reduce((s, l) => failed.includes(l) ? s : s + l.latency_ms, 0);
      await db.prepare(`UPDATE meta SET v = json_set(v,
                '$.totalRequests', COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1,
                '$.successCount',  COALESCE(json_extract(v, '$.successCount', 0), 0) + ?2,
                '$.avgLatency', (COALESCE(json_extract(v, '$.avgLatency', 0), 0) * COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?3) / (COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1),
                '$.successRate', ROUND(100.0 * (COALESCE(json_extract(v, '$.successCount', 0), 0) + ?2) / (COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1), 2)
            ) WHERE k = 'stats'`).bind(inserted, okN, latSum).run();
    } catch (e) {
      console.error("[logRing] stats update failed:", e);
    }
  }
  startTimer(db) {
    if (this.timer)
      return;
    this.timer = setInterval(() => this.flush(db), 6e4);
  }
}, "LogRing");
var logRing = new LogRing();
async function recentLogs(db, limit = 50) {
  const { results } = await db.prepare(
    "SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?1"
  ).bind(limit).all();
  return (results || []).map((r) => ({
    model: r.model,
    provider: r.provider,
    ok: !!r.ok,
    latency_ms: r.latency_ms,
    status: r.status,
    created_at: r.created_at
  }));
}
__name(recentLogs, "recentLogs");
var BUILTIN_PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", builtin: true, enabled: true, base_url: "https://api.deepseek.com", protocol: "openai" },
  { id: "qwen", name: "\u901A\u4E49\u5343\u95EE", builtin: true, enabled: true, base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", protocol: "openai" },
  { id: "hunyuan", name: "\u817E\u8BAF\u6DF7\u5143", builtin: true, enabled: true, base_url: "https://api.hunyuan.cloud.tencent.com/v1", protocol: "openai" },
  { id: "doubao", name: "\u8C46\u5305/\u706B\u5C71\u65B9\u821F", builtin: true, enabled: true, base_url: "https://ark.cn-beijing.volces.com/api/v3", protocol: "openai" },
  { id: "kimi", name: "Kimi (Moonshot)", builtin: true, enabled: true, base_url: "https://api.moonshot.cn/v1", protocol: "openai" },
  { id: "glm", name: "\u667A\u8C31 GLM", builtin: true, enabled: true, base_url: "https://open.bigmodel.cn/api/paas/v4", protocol: "openai" },
  { id: "siliconflow", name: "\u7845\u57FA\u6D41\u52A8", builtin: true, enabled: true, base_url: "https://api.siliconflow.cn/v1", protocol: "openai" },
  { id: "groq", name: "Groq (\u6781\u901F)", builtin: true, enabled: true, base_url: "https://api.groq.com/openai/v1", protocol: "openai" },
  { id: "together", name: "Together", builtin: true, enabled: true, base_url: "https://api.together.xyz/v1", protocol: "openai" },
  { id: "openrouter", name: "OpenRouter", builtin: true, enabled: true, base_url: "https://openrouter.ai/api/v1", protocol: "openai" },
  { id: "fireworks", name: "Fireworks", builtin: true, enabled: true, base_url: "https://api.fireworks.ai/inference/v1", protocol: "openai" },
  { id: "novita", name: "Novita", builtin: true, enabled: true, base_url: "https://api.novita.ai/v3/openai", protocol: "openai" },
  { id: "ppio", name: "PPIO \u6D3E\u6B27", builtin: true, enabled: true, base_url: "https://api.ppio.cn/v1", protocol: "openai" },
  { id: "mistral", name: "Mistral", builtin: true, enabled: true, base_url: "https://api.mistral.ai/v1", protocol: "openai" },
  { id: "cohere", name: "Cohere", builtin: true, enabled: true, base_url: "https://api.cohere.ai/v2", protocol: "openai" },
  { id: "openai", name: "OpenAI", builtin: true, enabled: true, base_url: "https://api.openai.com/v1", protocol: "openai" },
  { id: "anthropic", name: "Anthropic", builtin: true, enabled: true, base_url: "https://api.anthropic.com", protocol: "anthropic" },
  { id: "google", name: "Google", builtin: true, enabled: true, base_url: "https://generativelanguage.googleapis.com/v1beta", protocol: "gemini" },
  { id: "ollama", name: "Ollama (\u81EA\u5EFA)", builtin: false, enabled: false, base_url: "http://localhost:11434/v1", protocol: "openai" },
  { id: "vllm", name: "vLLM (\u81EA\u5EFA)", builtin: false, enabled: false, base_url: "http://localhost:8000/v1", protocol: "openai" },
  { id: "oneapi", name: "OneAPI (\u81EA\u5EFA)", builtin: false, enabled: false, base_url: "http://localhost:3000", protocol: "openai" }
];
async function migrateBuiltins(db) {
  let changed = false;
  for (const p of BUILTIN_PROVIDERS) {
    const exist = await db.prepare("SELECT id FROM providers WHERE id = ?1").bind(p.id).all();
    if ((exist.results || []).length > 0)
      continue;
    await db.prepare(`
            INSERT INTO providers(id, name, builtin, enabled, base_url, protocol, headers, keys)
            VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
        `).bind(p.id, p.name, p.builtin ? 1 : 0, p.enabled ? 1 : 0, p.base_url, p.protocol, "{}", "[]").run();
    changed = true;
  }
  if (changed)
    cache.providers = void 0;
}
__name(migrateBuiltins, "migrateBuiltins");
function maskToken(t) {
  if (!t)
    return "";
  if (t.length <= 8)
    return "****";
  return t.slice(0, 4) + "****" + t.slice(-4);
}
__name(maskToken, "maskToken");
async function isAdmin(req, env2) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/irouter_sid=([^;]+)/);
  if (!m)
    return false;
  try {
    const [user, sig] = atob(m[1]).split(":");
    const expected = await hmacSha256(env2.SESSION_SECRET, "admin");
    return user === "admin" && sig === expected;
  } catch {
    return false;
  }
}
__name(isAdmin, "isAdmin");
async function hmacSha256(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacSha256, "hmacSha256");
function timingSafeEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function patternToRegex(pattern) {
  try {
    let p = pattern.replace(/\*/g, "\0");
    p = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    p = p.replace(/\u0000/g, ".*");
    return new RegExp("^" + p + "$");
  } catch {
    return null;
  }
}
__name(patternToRegex, "patternToRegex");
var builtinsInit = null;
var loginFailures = /* @__PURE__ */ new Map();
var LOGIN_LIMIT = { max: 5, windowMs: 6e4 };
var settingsCache = { data: null, at: 0 };
async function getSettingsCached(env2) {
  if (settingsCache.data && Date.now() - settingsCache.at < 6e4)
    return settingsCache.data;
  const s = await getSettings(env2.DB);
  settingsCache.data = s;
  settingsCache.at = Date.now();
  return s;
}
__name(getSettingsCached, "getSettingsCached");
function err(status, msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
__name(err, "err");
var worker_default = {
  async fetch(request, env2, ctx) {
    const app = new Hono2();
    app.use("*", cors({ origin: "*", credentials: false }));
    app.use("*", logger());
    if (!builtinsInit) {
      builtinsInit = migrateBuiltins(env2.DB).catch((e) => console.error("migrateBuiltins failed:", e));
    }
    ctx.waitUntil(builtinsInit);
    app.get("/health", (c) => c.json({ ok: true, version: "3.2.0", storage: "d1" }));
    app.post("/v1/chat/completions", async (c) => {
      const auth = c.req.header("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const expectedKey = env2.PROXY_KEY || (await getSettingsCached(env2)).apiToken;
      if (!expectedKey)
        return err(500, "\u7F51\u5173 Token \u672A\u914D\u7F6E\uFF1A\u8BF7\u8BBE\u7F6E PROXY_KEY \u73AF\u5883\u53D8\u91CF\uFF0C\u6216\u5728\u7BA1\u7406\u540E\u53F0\u300C\u8C03\u7528\u4FE1\u606F\u300D\u4E2D\u8BBE\u7F6E Token");
      if (!token || token !== expectedKey)
        return err(401, "Unauthorized");
      const body = await c.req.json().catch(() => null);
      if (!body || !body.model)
        return err(400, "model required");
      const start = Date.now();
      const routes = await getRoutes(env2.DB);
      const model = String(body.model);
      const matched = routes.filter((r) => {
        if (!r.enabled)
          return false;
        const re = patternToRegex(r.pattern);
        return !!re && re.test(model);
      }).sort((a, b) => b.priority - a.priority || b.created_at - a.created_at)[0];
      const providers = await getProviders(env2.DB);
      const tryList = matched ? [...matched.providers, ...matched.fallback] : providers.filter((p) => p.enabled).map((p) => p.id);
      let lastErr = null;
      for (const pid2 of tryList) {
        const p = providers.find((x) => x.id === pid2);
        if (!p)
          continue;
        if (p.protocol !== "openai") {
          lastErr = new Error(`\u4F9B\u5E94\u5546 ${p.id} \u7684\u534F\u8BAE ${p.protocol} \u6682\u672A\u5B9E\u73B0\uFF08\u5F53\u524D\u4EC5\u652F\u6301 openai\uFF09\uFF0C\u5DF2\u8DF3\u8FC7`);
          continue;
        }
        const keys = await getKeys(env2.DB, p.id);
        if (keys.length === 0)
          continue;
        const key = keys[Math.floor(Math.random() * keys.length)];
        let apiKey;
        try {
          apiKey = await decrypt(key.secret, env2.ENCRYPT_KEY);
        } catch (e) {
          lastErr = new Error(`key ${key.id} \u89E3\u5BC6\u5931\u8D25\uFF08\u8BF7\u786E\u8BA4 ENCRYPT_KEY \u4E0E\u4FDD\u5B58\u8BE5 Key \u65F6\u4E00\u81F4\uFF09`);
          continue;
        }
        const upstream = p.base_url + (p.base_url.endsWith("/") ? "" : "/") + "chat/completions";
        try {
          const upstreamReq = new Request(upstream, {
            method: "POST",
            headers: { "content-type": "application/json", "authorization": "Bearer " + apiKey, ...p.headers },
            body: JSON.stringify(body),
            // CF 特有：带 body 的 fetch 必须 duplex: 'half'，否则抛异常
            duplex: "half"
          });
          const res = await fetch(upstreamReq);
          if (body.stream && res.body) {
            const latency2 = Date.now() - start;
            ctx.waitUntil(touchKey(env2.DB, key.id));
            logRing.push({ model, provider: p.id, ok: res.ok, latency_ms: latency2, status: res.status });
            logRing.flush(env2.DB);
            return new Response(res.body, { status: res.status, headers: res.headers });
          }
          const text = await res.text();
          const latency = Date.now() - start;
          ctx.waitUntil(touchKey(env2.DB, key.id));
          logRing.push({ model, provider: p.id, ok: res.ok, latency_ms: latency, status: res.status });
          logRing.flush(env2.DB);
          return new Response(text, { status: res.status, headers: res.headers });
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      logRing.push({ model, provider: "none", ok: false, latency_ms: Date.now() - start, status: 502 });
      logRing.flush(env2.DB);
      return err(502, "All providers failed: " + (lastErr?.message || "no available provider"));
    });
    app.post("/admin/api/login", async (c) => {
      if (!env2.DEFAULT_ADMIN_PASS) {
        return err(500, "\u672A\u914D\u7F6E DEFAULT_ADMIN_PASS\uFF1A\u8BF7\u5148\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Settings \u2192 Variables \u4E2D\u8BBE\u7F6E\u540E\u53F0\u5BC6\u7801");
      }
      const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
      const now = Date.now();
      const rec = loginFailures.get(ip);
      if (rec && now - rec.at < LOGIN_LIMIT.windowMs && rec.count >= LOGIN_LIMIT.max) {
        return err(429, "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 1 \u5206\u949F\u540E\u518D\u8BD5");
      }
      const { password } = await c.req.json().catch(() => ({ password: "" }));
      if (typeof password !== "string" || !timingSafeEqual(password, env2.DEFAULT_ADMIN_PASS)) {
        const f = loginFailures.get(ip);
        if (!f || now - f.at >= LOGIN_LIMIT.windowMs)
          loginFailures.set(ip, { count: 1, at: now });
        else
          f.count++;
        return err(401, "\u5BC6\u7801\u9519\u8BEF");
      }
      loginFailures.delete(ip);
      const sig = await hmacSha256(env2.SESSION_SECRET, "admin");
      const sid = btoa("admin:" + sig);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": `irouter_sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
        }
      });
    });
    app.get("/admin/api/dashboard", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const [providers, routes, keys, stats, recent, settings] = await Promise.all([
        getProviders(env2.DB),
        getRoutes(env2.DB),
        getKeys(env2.DB),
        getStats(env2.DB),
        recentLogs(env2.DB, 10),
        getSettings(env2.DB)
      ]);
      const modelCount = /* @__PURE__ */ new Map();
      for (const l of recent)
        modelCount.set(l.model, (modelCount.get(l.model) || 0) + 1);
      const modelRanking = [...modelCount.entries()].map(([model, count3]) => ({ model, count: count3 })).sort((a, b) => b.count - a.count).slice(0, 10);
      const provStat = /* @__PURE__ */ new Map();
      for (const l of recent) {
        const s = provStat.get(l.provider) || { ok: 0, total: 0, latency: 0 };
        s.total++;
        if (l.ok)
          s.ok++;
        s.latency += l.latency_ms;
        provStat.set(l.provider, s);
      }
      const providerHealth = providers.map((p) => {
        const s = provStat.get(p.id);
        return {
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          successRate: s ? Math.round(s.ok / s.total * 100) : 0,
          avgLatency: s ? Math.round(s.latency / s.total) : 0
        };
      });
      return c.json({
        version: "3.2.0",
        generatedAt: Date.now(),
        storage: { mode: "d1", writable: true, warning: null },
        counts: { providers: providers.length, routes: routes.length, keys: keys.length },
        stats,
        recent,
        modelRanking,
        providerHealth,
        providers,
        // 前端 render_dashboard 用到
        settings
        // 总览页调用信息卡
      });
    });
    app.get("/admin/api/settings", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const s = await getSettings(env2.DB);
      return c.json({
        projectName: s.projectName || env2.PROJECT_NAME || "iRouter",
        baseUrl: s.baseUrl || env2.BASE_URL || "",
        apiToken: s.tokenMasked || maskToken(env2.API_TOKEN || "")
      });
    });
    app.put("/admin/api/settings", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const body = await c.req.json().catch(() => ({}));
      const cur = await getSettings(env2.DB);
      const next = { ...cur };
      if (typeof body.projectName === "string")
        next.projectName = body.projectName;
      if (typeof body.baseUrl === "string")
        next.baseUrl = body.baseUrl;
      if (typeof body.apiToken === "string") {
        const t = body.apiToken.trim();
        if (t === "") {
        } else if (t.length < 8) {
          return err(400, "Token \u81F3\u5C11 8 \u4F4D");
        } else {
          next.apiToken = t;
          next.tokenMasked = maskToken(t);
        }
      }
      await saveSettings(env2.DB, next);
      settingsCache.data = null;
      return c.json({ ok: true, settings: { ...next, apiToken: next.tokenMasked } });
    });
    app.get("/admin/api/providers", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      return c.json(await getProviders(env2.DB));
    });
    app.post("/admin/api/providers", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const body = await c.req.json().catch(() => ({}));
      const p = {
        id: body.id || "p_" + Date.now(),
        name: body.name || "\u672A\u547D\u540D",
        builtin: false,
        enabled: body.enabled !== false,
        base_url: body.base_url || "",
        protocol: body.protocol || "openai",
        headers: body.headers || {},
        keys: body.keys || [],
        created_at: Date.now(),
        updated_at: Date.now()
      };
      await saveProvider(env2.DB, p);
      return c.json({ ok: true, id: p.id }, 201);
    });
    app.put("/admin/api/providers/:id", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const id = c.req.param("id");
      const cur = await getProvider(env2.DB, id);
      if (!cur)
        return err(404, "\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728");
      const body = await c.req.json().catch(() => ({}));
      const next = {
        ...cur,
        name: body.name ?? cur.name,
        enabled: body.enabled ?? cur.enabled,
        base_url: body.base_url ?? cur.base_url,
        protocol: body.protocol ?? cur.protocol,
        headers: body.headers ?? cur.headers,
        updated_at: Date.now()
      };
      await saveProvider(env2.DB, next);
      return c.json({ ok: true });
    });
    app.delete("/admin/api/providers/:id", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      await deleteProvider(env2.DB, c.req.param("id"));
      return c.json({ ok: true });
    });
    app.get("/admin/api/routes", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      return c.json(await getRoutes(env2.DB));
    });
    app.post("/admin/api/routes", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const body = await c.req.json().catch(() => ({}));
      const rt = {
        id: "r_" + Date.now(),
        name: body.name || "",
        pattern: body.pattern || "*",
        providers: body.providers || [],
        fallback: body.fallback || [],
        priority: body.priority || 0,
        enabled: body.enabled !== false,
        created_at: Date.now()
      };
      await saveRoute(env2.DB, rt);
      return c.json({ ok: true, id: rt.id }, 201);
    });
    app.put("/admin/api/routes/:id", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const id = c.req.param("id");
      const routes = await getRoutes(env2.DB);
      const cur = routes.find((r) => r.id === id);
      if (!cur)
        return err(404, "\u8DEF\u7531\u4E0D\u5B58\u5728");
      const body = await c.req.json().catch(() => ({}));
      const next = {
        ...cur,
        name: body.name ?? cur.name,
        pattern: body.pattern ?? cur.pattern,
        providers: body.providers ?? cur.providers,
        fallback: body.fallback ?? cur.fallback,
        priority: body.priority ?? cur.priority,
        enabled: body.enabled ?? cur.enabled
      };
      await saveRoute(env2.DB, next);
      return c.json({ ok: true });
    });
    app.delete("/admin/api/routes/:id", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      await deleteRoute(env2.DB, c.req.param("id"));
      return c.json({ ok: true });
    });
    app.get("/admin/api/keys", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      const keys = await getKeys(env2.DB);
      return c.json(keys.map((k) => ({ ...k, secret: "" })));
    });
    app.post("/admin/api/keys", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      if (!env2.ENCRYPT_KEY) {
        return err(500, "ENCRYPT_KEY \u672A\u914D\u7F6E\uFF1A\u65E0\u6CD5\u52A0\u5BC6\u5B58\u50A8 API Key\u3002\u8BF7\u5148\u5728 Cloudflare \u63A7\u5236\u53F0\u8BBE\u7F6E ENCRYPT_KEY\uFF08\u4EFB\u610F\u957F\u968F\u673A\u4E32\uFF09\u540E\u518D\u6DFB\u52A0");
      }
      const body = await c.req.json().catch(() => ({}));
      if (!body.secret)
        return err(400, "secret required");
      const encrypted = await encrypt(String(body.secret), env2.ENCRYPT_KEY);
      const k = {
        id: "k_" + Date.now(),
        name: body.name || "",
        provider_id: body.provider_id || "",
        secret: encrypted,
        hint: String(body.secret).slice(-4),
        masked: "****" + String(body.secret).slice(-4),
        created_at: Date.now(),
        last_used: 0
      };
      await saveKey(env2.DB, k);
      return c.json({ ok: true, id: k.id }, 201);
    });
    app.delete("/admin/api/keys/:id", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      await deleteKey(env2.DB, c.req.param("id"));
      return c.json({ ok: true });
    });
    app.get("/admin/api/storage/status", async (c) => {
      if (!await isAdmin(c.req.raw, env2))
        return err(401, "Unauthorized");
      try {
        await env2.DB.prepare("SELECT 1 FROM meta LIMIT 1").all();
        return c.json({ mode: "d1", writable: true, warning: null });
      } catch (e) {
        return c.json({ mode: "d1", writable: false, warning: String(e) }, 500);
      }
    });
    logRing.startTimer(env2.DB);
    app.get("/", (c) => c.html(ADMIN_HTML));
    app.get("/admin", (c) => c.html(ADMIN_HTML));
    app.get("/admin/*", (c) => c.html(ADMIN_HTML));
    return app.fetch(request);
  }
};
var LEGACY_ENCRYPT_KEY = "default-encrypt-key-change-me";
async function getKeyMaterial(key) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(getKeyMaterial, "getKeyMaterial");
async function encrypt(text, key) {
  const cryptoKey = await getKeyMaterial(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(text)
  ));
  const b64 = /* @__PURE__ */ __name((buf) => btoa(String.fromCharCode(...buf)), "b64");
  return b64(iv) + ":" + b64(enc);
}
__name(encrypt, "encrypt");
async function decrypt(payload, key) {
  const [ivB64, encB64] = payload.split(":");
  if (!ivB64 || !encB64)
    throw new Error("invalid encrypted payload");
  const fromB64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "fromB64");
  const tryDecrypt = /* @__PURE__ */ __name(async (k) => {
    const cryptoKey = await getKeyMaterial(k);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivB64) }, cryptoKey, fromB64(encB64));
  }, "tryDecrypt");
  try {
    return new TextDecoder().decode(await tryDecrypt(key));
  } catch {
    const legacy = await tryDecrypt(LEGACY_ENCRYPT_KEY);
    return new TextDecoder().decode(legacy);
  }
}
__name(decrypt, "decrypt");
var ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iRouter \xB7 \u7BA1\u7406\u540E\u53F0</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#0f1419;color:#e6edf3;line-height:1.6}
  .layout{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#161b22;border-right:1px solid #30363d;padding:20px 0;position:sticky;top:0;height:100vh;overflow:auto}
  .brand{padding:0 20px 20px;border-bottom:1px solid #30363d;margin-bottom:12px}
  .brand h1{font-size:20px;color:#58a6ff;letter-spacing:1px}
  .brand small{color:#8b949e;font-size:12px}
  .nav a{display:block;padding:10px 20px;color:#c9d1d9;text-decoration:none;font-size:14px;border-left:3px solid transparent;transition:.15s}
  .nav a:hover{background:#21262d;color:#fff}
  .nav a.active{background:#1f6feb22;color:#58a6ff;border-left-color:#58a6ff}
  .main{flex:1;padding:28px 36px;overflow:auto}
  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
  .topbar h2{font-size:20px;font-weight:600}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px}
  .card .label{color:#8b949e;font-size:13px;margin-bottom:6px}
  .card .value{font-size:28px;font-weight:700;color:#58a6ff}
  .card .sub{font-size:12px;color:#8b949e;margin-top:4px}
  .panel{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin-bottom:24px}
  .panel h3{font-size:15px;margin-bottom:14px;color:#e6edf3}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #30363d}
  th{color:#8b949e;font-weight:600}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:12px}
  .badge.ok{background:#23863633;color:#3fb950}
  .badge.err{background:#f8514933;color:#f85149}
  .badge.warn{background:#d2992233;color:#d29922}
  .btn{background:#238636;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px}
  .btn:hover{background:#2ea043}
  .btn.ghost{background:transparent;border:1px solid #30363d;color:#c9d1d9}
  .btn.danger{background:#f85149}
  .form-row{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .form-row label{font-size:12px;color:#8b949e;display:block;margin-bottom:4px}
  .form-row input,.form-row select{flex:1;min-width:160px;background:#0d1117;border:1px solid #30363d;color:#e6edf3;padding:8px 10px;border-radius:6px}
  .conn-card{border:1px solid #30363d;border-radius:12px;padding:18px;background:#161b22}
  .conn-card .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #30363d}
  .conn-card .row:last-child{border-bottom:none}
  .conn-card code{background:#0d1117;padding:4px 8px;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .copy{cursor:pointer;color:#58a6ff;font-size:12px;margin-left:8px}
  .toast{position:fixed;top:20px;right:20px;background:#161b22;border:1px solid #30363d;padding:12px 18px;border-radius:8px;z-index:99;display:none}
  .toast.show{display:block}
  pre{background:#0d1117;padding:14px;border-radius:8px;overflow:auto;font-size:12px;color:#a5d6ff}
  .modal{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:100}
  .modal.show{display:flex}
  .modal .box{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;width:440px;max-width:90vw}
  .modal h3{margin-bottom:16px}
  .bar{height:6px;background:#30363d;border-radius:3px;overflow:hidden;margin-top:4px}
  .bar>span{display:block;height:100%;background:#58a6ff;border-radius:3px}
  .hidden{display:none!important}
</style></head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand"><h1>iRouter</h1><small>\u667A\u80FD\u8DEF\u7531\u7F51\u5173 v3.2.0</small></div>
    <nav class="nav">
      <a href="#dashboard" class="active" data-view="dashboard">\u{1F3E0} \u9996\u9875</a>
      <a href="#providers" data-view="providers">\u2699\uFE0F \u4F9B\u5E94\u5546</a>
      <a href="#routes" data-view="routes">\u{1F500} \u8DEF\u7531\u89C4\u5219</a>
      <a href="#keys" data-view="keys">\u{1F511} API Keys</a>
      <a href="#settings" data-view="settings">\u26A1 \u8C03\u7528\u4FE1\u606F</a>
      <a href="#guide" data-view="guide">\u2754 \u4F7F\u7528\u6307\u5357</a>
      <a href="#" id="logout">\u{1F6AA} \u9000\u51FA</a>
    </nav>
  </aside>
  <main class="main" id="view"></main>
</div>
<div class="toast" id="toast"></div>
<div class="modal" id="modal"><div class="box" id="modal-box"></div></div>

<script>
// ============ api()\uFF1AURL \u5F52\u4E00\u5316\uFF08\u6839\u6CBB /admin/apiGET \u4E0E\u53CC\u62FC 404\uFF09============
window.api = function(method, path, body){
  var m, p, b;
  if(typeof method === 'string' && typeof path === 'string'){ m=method.toUpperCase(); p=path; b=body; }
  else { p=method; var opts=path||{}; m=(opts.method||'GET').toUpperCase(); b=opts.body; }
  p = String(p||'').replace(/^\\s+|\\s+$/g,'');
  var full = p.match(/^(GET|POST|PUT|DELETE|PATCH)\\s+(.+)$/i);
  if(full){ m=full[1].toUpperCase(); p=full[2]; }
  p = p.replace(/^(GET|POST|PUT|DELETE|PATCH)\\s+/i,'');
  if(p.indexOf('/')!==0) p='/'+p;
  // \u5408\u5E76\u91CD\u590D\u659C\u6760\uFF08\u5FAA\u73AF\u515C\u5E95\uFF0C\u5F7B\u5E95\u6CBB //admin//api//dashboard\uFF09
  while(/\\/\\//.test(p)) p = p.replace(/\\/\\//g,'/');
  // \u5DF2\u5E26\u5B8C\u6574\u524D\u7F00\u5219\u4E0D\u518D\u62FC\u63A5\uFF0C\u9632 /admin/api/admin/api/... \u53CC\u62FC
  var url = p;
  if(p.indexOf('/admin/api/')!==0){
    var ep = p.replace(/^\\//,'');
    if(/^(providers|routes|keys|dashboard|config|stats|logs|storage|status|settings)(\\/|$)/.test(ep)){
      url = '/admin/api/'+ep;
    }
  }
  return fetch(url,{
    method:m,
    headers:b?{'content-type':'application/json'}:{},
    body:b?JSON.stringify(b):undefined,
    credentials:'include'
  }).then(function(r){
    if(!r.ok) return r.json().then(function(e){ throw e; });
    return r.json();
  });
};

// ============ \u89C6\u56FE\u6E32\u67D3 ============
var TITLES = {dashboard:'\u7BA1\u7406\u9996\u9875',providers:'\u4F9B\u5E94\u5546',routes:'\u8DEF\u7531\u89C4\u5219',keys:'API Keys',settings:'\u8C03\u7528\u4FE1\u606F',guide:'\u4F7F\u7528\u6307\u5357'};
var currentView = 'dashboard';
var state = {providers:[],routes:[],keys:[],settings:null};

function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.className='toast show';setTimeout(function(){t.className='toast';},2500);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function render(){
  var v = currentView;
  document.title = (TITLES[v]||'') + ' \xB7 iRouter';
  var main = document.getElementById('view');
  if(v==='dashboard') return render_dashboard(main);
  if(v==='providers') return render_providers(main);
  if(v==='routes') return render_routes(main);
  if(v==='keys') return render_keys(main);
  if(v==='settings') return render_settings(main);
  if(v==='guide') return render_guide(main);
}

// ---- \u9996\u9875 Dashboard ----
function render_dashboard(main){
  main.innerHTML = '<div class="topbar"><h2>\u{1F3E0} \u7BA1\u7406\u9996\u9875</h2><button class="btn" onclick="fetchDashboard()">\u{1F504} \u5237\u65B0</button></div>'
    + '<div class="cards" id="cards"></div>'
    + '<div class="grid2">'
    +   '<div class="panel"><h3>\u{1F4CA} \u6A21\u578B\u8C03\u7528\u6392\u884C</h3><div id="ranking"></div></div>'
    +   '<div class="panel"><h3>\u{1F3E5} \u4F9B\u5E94\u5546\u5065\u5EB7\u5EA6</h3><div id="health"></div></div>'
    + '</div>'
    + '<div class="panel"><h3>\u{1F550} \u6700\u8FD1\u8BF7\u6C42</h3><table id="recent"><thead><tr><th>\u65F6\u95F4</th><th>\u6A21\u578B</th><th>\u4F9B\u5E94\u5546</th><th>\u72B6\u6001</th><th>\u5EF6\u8FDF</th></tr></thead><tbody></tbody></table></div>'
    + '<div id="guide-mount"></div>';
  fetchDashboard();
}

function fetchDashboard(){
  api('GET','/admin/api/dashboard').then(function(d){
    var data = d.data || d;   // \u517C\u5BB9 {ok,data} \u4E0E\u88F8\u5BF9\u8C61\u4E24\u79CD\u8FD4\u56DE
    state.settings = data.settings;
    render_cards(data);
    render_ranking(data.modelRanking||[]);
    render_health(data.providerHealth||[]);
    render_recent(data.recent||[]);
    if(!localStorage.getItem('irouter_guide_dismissed')) render_guide_mini();
  }).catch(function(e){ toast('\u52A0\u8F7D\u5931\u8D25\uFF1A'+(e&&e.error||e)); });
}

function render_cards(data){
  var c = document.getElementById('cards');
  if(!c) return;
  var s = data.stats||{};
  c.innerHTML = ''
    + card('\u2699\uFE0F \u4F9B\u5E94\u5546', (data.counts||{}).providers||0, '\u5DF2\u542F\u7528 '+(data.providers||[]).filter(function(p){return p.enabled;}).length)
    + card('\u{1F500} \u8DEF\u7531\u89C4\u5219', (data.counts||{}).routes||0, '\u6309\u4F18\u5148\u7EA7\u5339\u914D')
    + card('\u{1F511} API Keys', (data.counts||{}).keys||0, '\u52A0\u5BC6\u5B58\u50A8')
    + card('\u{1F680} \u603B\u8BF7\u6C42', s.totalRequests||0, '\u6210\u529F\u7387 '+(s.successRate||0)+'%');
}

function card(label,value,sub){return '<div class="card"><div class="label">'+label+'</div><div class="value">'+value+'</div><div class="sub">'+esc(sub)+'</div></div>';}

function render_ranking(list){
  var el = document.getElementById('ranking');
  if(!el) return;
  if(!list.length){el.innerHTML='<p style="color:#8b949e;font-size:13px">\u6682\u65E0\u8BF7\u6C42\u6570\u636E\uFF0C\u53D1\u4E00\u6B21\u8BF7\u6C42\u540E\u6B64\u5904\u4F1A\u663E\u793A\u6392\u884C</p>';return;}
  var max = Math.max.apply(null,list.map(function(x){return x.count;}));
  el.innerHTML = '<table><thead><tr><th>\u6A21\u578B</th><th>\u8C03\u7528\u6B21\u6570</th></tr></thead><tbody>'
    + list.map(function(x){return '<tr><td>'+esc(x.model)+'</td><td><div class="bar"><span style="width:'+(x.count/max*100)+'%"></span></div>'+x.count+'</td></tr>';}).join('')
    + '</tbody></table>';
}

function render_health(list){
  var el = document.getElementById('health');
  if(!el) return;
  el.innerHTML = list.map(function(p){
    var color = p.successRate>=90?'ok':p.successRate>=60?'warn':'err';
    return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(p.name)+'</span><span>'+(p.successRate||0)+'% \xB7 '+(p.avgLatency||0)+'ms</span></div><div class="bar"><span style="width:'+(p.successRate||0)+'%;background:'+(color==='ok'?'#3fb950':color==='warn'?'#d29922':'#f85149')+'"></span></div></div>';
  }).join('') || '<p style="color:#8b949e;font-size:13px">\u6682\u65E0\u6570\u636E</p>';
}

function render_recent(list){
  var tb = document.querySelector('#recent tbody');
  if(!tb) return;
  tb.innerHTML = list.map(function(r){
    var d = new Date((r.created_at||0)*1000);
    var time = isNaN(d)?'':'0'.concat(d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2);
    var badge = r.ok?'<span class="badge ok">'+r.status+'</span>':'<span class="badge err">'+r.status+'</span>';
    return '<tr><td>'+time+'</td><td>'+esc(r.model||'-')+'</td><td>'+esc(r.provider||'-')+'</td><td>'+badge+'</td><td>'+(r.latency_ms||0)+'ms</td></tr>';
  }).join('') || '<tr><td colspan="5" style="color:#8b949e;text-align:center;padding:20px">\u6682\u65E0\u8BF7\u6C42\u8BB0\u5F55</td></tr>';
}

// ---- \u8C03\u7528\u4FE1\u606F\uFF08\u603B\u89C8\u9875\u6838\u5FC3\uFF1ABase URL + Token + \u4FEE\u6539\uFF09----
function render_settings(main){
  main.innerHTML = '<div class="topbar"><h2>\u26A1 \u8C03\u7528\u4FE1\u606F</h2></div>'
    + '<div class="conn-card" id="conn"></div>'
    + '<div class="panel" style="margin-top:24px"><h3>\u{1F4DD} \u4FEE\u6539\u914D\u7F6E</h3><div id="settings-form"></div></div>';
  api('GET','/admin/api/settings').then(function(d){
    var s = d.data || d;
    state.settings = s;
    render_conn(s);
    render_settings_form(s);
  }).catch(function(e){ toast('\u52A0\u8F7D\u5931\u8D25\uFF1A'+(e&&e.error||e)); });
}

function render_conn(s){
  var baseUrl = s.baseUrl || (location.origin || '');
  var token = s.apiToken || '\uFF08\u672A\u8BBE\u7F6E\uFF0C\u8BF7\u5728\u4E0B\u65B9\u8BBE\u7F6E API_TOKEN\uFF09';
  var curl = 'curl -X POST "'+baseUrl+'/v1/chat/completions" \\\\\\n'
           + '  -H "Authorization: Bearer '+esc(s.apiToken||'YOUR_TOKEN')+'" \\\\\\n'
           + '  -H "Content-Type: application/json" \\\\\\n'
           + '  -d '{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hello"}] }'';
  document.getElementById('conn').innerHTML = ''
    + row_html('\u{1F3F7}\uFE0F \u9879\u76EE\u540D', esc(s.projectName||'iRouter')+' <span class="badge ok">v3.2.0 \xB7 D1</span>')
    + row_html('\u{1F310} \u7F51\u5173 Base URL', '<code id="conn-url">'+esc(baseUrl)+'</code> <span class="copy" onclick="copyText('conn-url')">\u{1F4CB} \u590D\u5236</span>')
    + row_html('\u{1F511} \u8C03\u7528 Token', '<code id="conn-token">'+esc(token)+'</code> <span class="copy" onclick="copyText('conn-token')">\u{1F4CB} \u590D\u5236</span>')
    + '<div style="margin-top:14px"><label style="font-size:12px;color:#8b949e">\u{1F4E6} \u5FEB\u901F\u8C03\u7528\u793A\u4F8B\uFF08curl\uFF09</label><pre id="conn-curl">'+esc(curl)+'</pre><span class="copy" onclick="copyText('conn-curl')">\u{1F4CB} \u590D\u5236</span></div>';
}

function row_html(k,v){return '<div class="row"><div><div style="font-size:12px;color:#8b949e">'+k+'</div><div style="font-size:14px;margin-top:4px">'+v+'</div></div></div>';}

function render_settings_form(s){
  document.getElementById('settings-form').innerHTML = ''
    + '<div class="form-row"><div style="flex:1"><label>\u9879\u76EE\u540D</label><input id="f-project" value="'+esc(s.projectName||'iRouter')+'"></div>'
    + '<div style="flex:1"><label>\u7F51\u5173 Base URL\uFF08\u7559\u7A7A=\u81EA\u52A8\u53D6\u5F53\u524D\u57DF\u540D\uFF09</label><input id="f-base" value="'+esc(s.baseUrl||'')+'" placeholder="https://irouter.example.com"></div></div>'
    + '<div class="form-row"><div style="flex:1"><label>\u8C03\u7528 Token\uFF08\u7559\u7A7A=\u4E0D\u4FEE\u6539\uFF1B\u22658 \u4F4D\u53EF\u66F4\u65B0\uFF1B\u4E0E\u767B\u5F55\u5BC6\u7801\u76F8\u4E92\u72EC\u7ACB\uFF09</label><input id="f-token" type="password" placeholder="sk-xxxxxxxx\uFF08\u7559\u7A7A\u5219\u4E0D\u4FEE\u6539\uFF09"></div></div>'
    + '<button class="btn" onclick="saveSettings()">\u{1F4BE} \u4FDD\u5B58</button>'
    + '<span style="margin-left:12px;font-size:12px;color:#8b949e">\u63D0\u793A\uFF1A\u6B64 Token \u662F\u300C\u5916\u90E8\u8C03\u7528\u7F51\u5173\u300D\u7528\u7684\u9274\u6743 key\uFF0C\u4E0E\u7BA1\u7406\u5458\u767B\u5F55\u5BC6\u7801\u662F\u4E24\u5957\uFF0C\u4E92\u4E0D\u5F71\u54CD</span>';
}

window.saveSettings = function(){
  var body = {
    projectName: document.getElementById('f-project').value.trim(),
    baseUrl: document.getElementById('f-base').value.trim(),
    apiToken: document.getElementById('f-token').value,
  };
  api('PUT','/admin/api/settings', body).then(function(d){
    toast('\u2705 \u5DF2\u4FDD\u5B58');
    document.getElementById('f-token').value='';
    fetchDashboard && fetchDashboard();   // \u9759\u9ED8\u5237\u65B0\u56DE\u586B
  }).catch(function(e){ toast('\u4FDD\u5B58\u5931\u8D25\uFF1A'+(e&&e.error||e)); });
};

window.copyText = function(id){var el=document.getElementById(id);var txt=el.textContent||el.innerText;navigator.clipboard.writeText(txt).then(function(){toast('\u{1F4CB} \u5DF2\u590D\u5236');},function(){toast('\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9');});};

// ---- \u4F9B\u5E94\u5546 ----
function render_providers(main){
  main.innerHTML = '<div class="topbar"><h2>\u2699\uFE0F \u4F9B\u5E94\u5546</h2><button class="btn" onclick="openProvider()">\uFF0B \u6DFB\u52A0\u4F9B\u5E94\u5546</button></div>'
    + '<div class="panel"><table><thead><tr><th>\u540D\u79F0</th><th>\u6807\u8BC6</th><th>Base URL</th><th>\u534F\u8BAE</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody id="prov-tbody"></tbody></table></div>';
  api('GET','/admin/api/providers').then(function(d){state.providers=d.data||d;render_prov_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_prov_table(){
  var tb=document.getElementById('prov-tbody');
  tb.innerHTML=state.providers.map(function(p){
    return '<tr><td>'+esc(p.name)+'</td><td><code>'+esc(p.id)+'</code></td><td><code style="font-size:11px">'+esc(p.base_url)+'</code></td><td>'+esc(p.protocol)+'</td>'
      + '<td>'+(p.enabled?'<span class="badge ok">\u542F\u7528</span>':'<span class="badge err">\u505C\u7528</span>')+'</td>'
      + '<td><button class="btn ghost" onclick="editProvider(''+esc(p.id)+'')">\u7F16\u8F91</button> '
      + (p.builtin?'<span style="font-size:11px;color:#8b949e">\u5185\u7F6E</span>':'<button class="btn danger" onclick="deleteProvider(''+esc(p.id)+'')">\u5220\u9664</button>')+'</td></tr>';
  }).join('');
}
window.openProvider=function(){setModal('<h3>\u6DFB\u52A0\u4F9B\u5E94\u5546</h3>'
  +'<div class="form-row"><div style="flex:1"><label>\u540D\u79F0</label><input id="m-name"></div><div style="flex:1"><label>\u6807\u8BC6\uFF08\u552F\u4E00 ID\uFF09</label><input id="m-id" placeholder="my-provider"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>Base URL</label><input id="m-url" placeholder="https://api.example.com/v1"></div><div style="flex:1"><label>\u534F\u8BAE</label><select id="m-proto"><option value="openai">openai</option><option value="anthropic">anthropic</option><option value="gemini">gemini</option><option value="custom">custom</option></select></div></div>'
  +'<button class="btn" onclick="submitProvider()">\u4FDD\u5B58</button>');};
window.submitProvider=function(){api('POST','/admin/api/providers',{name:document.getElementById('m-name').value,id:document.getElementById('m-id').value,base_url:document.getElementById('m-url').value,protocol:document.getElementById('m-proto').value}).then(function(){closeModal();render_providers(document.getElementById('view'));toast('\u2705 \u5DF2\u6DFB\u52A0');});};
window.editProvider=function(id){var p=state.providers.find(function(x){return x.id===id;});if(!p)return;setModal('<h3>\u7F16\u8F91\u4F9B\u5E94\u5546</h3>'
  +'<div class="form-row"><div style="flex:1"><label>\u540D\u79F0</label><input id="m-name" value="'+esc(p.name)+'"></div><div style="flex:1"><label>Base URL</label><input id="m-url" value="'+esc(p.base_url)+'"></div></div>'
  +'<div class="form-row"><label>\u542F\u7528</label><select id="m-enabled"><option value="1"'+(p.enabled?' selected':'')+'>\u542F\u7528</option><option value="0"'+(!p.enabled?' selected':'')+'>\u505C\u7528</option></select></div>'
  +'<button class="btn" onclick="submitEditProvider(''+esc(id)+'')">\u4FDD\u5B58</button>');};
window.submitEditProvider=function(id){api('PUT','/admin/api/providers/'+id,{name:document.getElementById('m-name').value,base_url:document.getElementById('m-url').value,enabled:document.getElementById('m-enabled').value==='1'}).then(function(){closeModal();render_providers(document.getElementById('view'));toast('\u2705 \u5DF2\u66F4\u65B0');});};
window.deleteProvider=function(id){if(!confirm('\u786E\u8BA4\u5220\u9664\uFF1F'))return;api('DELETE','/admin/api/providers/'+id).then(function(){render_providers(document.getElementById('view'));toast('\u{1F5D1}\uFE0F \u5DF2\u5220\u9664');});};

// ---- \u8DEF\u7531\u89C4\u5219 ----
function render_routes(main){
  main.innerHTML='<div class="topbar"><h2>\u{1F500} \u8DEF\u7531\u89C4\u5219</h2><button class="btn" onclick="openRoute()">\uFF0B \u6DFB\u52A0\u89C4\u5219</button></div>'
    +'<div class="panel"><table><thead><tr><th>\u540D\u79F0</th><th>\u5339\u914D\u6A21\u5F0F</th><th>\u547D\u4E2D\u4F9B\u5E94\u5546</th><th>\u515C\u5E95</th><th>\u4F18\u5148\u7EA7</th><th>\u64CD\u4F5C</th></tr></thead><tbody id="rt-tbody"></tbody></table></div>';
  api('GET','/admin/api/routes').then(function(d){state.routes=d.data||d;render_route_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_route_table(){
  var tb=document.getElementById('rt-tbody');
  tb.innerHTML=state.routes.map(function(r){
    return '<tr><td>'+esc(r.name||'(\u672A\u547D\u540D)')+'</td><td><code>'+esc(r.pattern)+'</code></td>'
      +'<td>'+(r.providers||[]).map(esc).join(' \u2192 ')+'</td>'
      +'<td>'+(r.fallback||[]).map(esc).join(' \u2192 ')||'<span style="color:#8b949e">-</span>'+
      '</td><td>'+(r.priority||0)+'</td>'
      +'<td><button class="btn ghost" onclick="editRoute(''+esc(r.id)+'')">\u7F16\u8F91</button> <button class="btn danger" onclick="deleteRoute(''+esc(r.id)+'')">\u5220\u9664</button></td></tr>';
  }).join('');
}
window.openRoute=function(){setModal('<h3>\u6DFB\u52A0\u8DEF\u7531\u89C4\u5219</h3>'
  +'<div class="form-row"><div style="flex:1"><label>\u540D\u79F0</label><input id="r-name"></div><div style="flex:1"><label>\u5339\u914D\u6A21\u5F0F\uFF08\u652F\u6301 * \u901A\u914D\uFF0C\u5982 gpt-*\uFF09</label><input id="r-pattern" value="*"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>\u547D\u4E2D\u4F9B\u5E94\u5546 ID\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u6709\u5E8F\uFF09</label><input id="r-prov" placeholder="openai,anthropic"></div><div style="flex:1"><label>\u515C\u5E95\u4F9B\u5E94\u5546 ID</label><input id="r-fb" placeholder="openrouter"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>\u4F18\u5148\u7EA7\uFF08\u5927\u8005\u4F18\u5148\uFF09</label><input id="r-pri" type="number" value="0"></div></div>'
  +'<button class="btn" onclick="submitRoute()">\u4FDD\u5B58</button>');};
window.submitRoute=function(){api('POST','/admin/api/routes',{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('\u2705 \u5DF2\u6DFB\u52A0');});};
window.editRoute=function(id){var r=state.routes.find(function(x){return x.id===id;});if(!r)return;setModal('<h3>\u7F16\u8F91\u8DEF\u7531\u89C4\u5219</h3>'
  +'<div class="form-row"><div style="flex:1"><label>\u540D\u79F0</label><input id="r-name" value="'+esc(r.name||'')+'"></div><div style="flex:1"><label>\u5339\u914D\u6A21\u5F0F</label><input id="r-pattern" value="'+esc(r.pattern)+'"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>\u547D\u4E2D\u4F9B\u5E94\u5546</label><input id="r-prov" value="'+esc((r.providers||[]).join(','))+'"></div><div style="flex:1"><label>\u515C\u5E95</label><input id="r-fb" value="'+esc((r.fallback||[]).join(','))+'"></div></div>'
  +'<div class="form-row"><label>\u4F18\u5148\u7EA7</label><input id="r-pri" type="number" value="'+esc(r.priority||0)+'"></div>'
  +'<button class="btn" onclick="submitEditRoute(''+esc(id)+'')">\u4FDD\u5B58</button>');};
window.submitEditRoute=function(id){api('PUT','/admin/api/routes/'+id,{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('\u2705 \u5DF2\u66F4\u65B0');});};
window.deleteRoute=function(id){if(!confirm('\u786E\u8BA4\u5220\u9664\uFF1F'))return;api('DELETE','/admin/api/routes/'+id).then(function(){render_routes(document.getElementById('view'));toast('\u{1F5D1}\uFE0F \u5DF2\u5220\u9664');});};

// ---- Keys ----
function render_keys(main){
  main.innerHTML='<div class="topbar"><h2>\u{1F511} API Keys</h2><button class="btn" onclick="openKey()">\uFF0B \u6DFB\u52A0 Key</button></div>'
    +'<div class="panel"><table><thead><tr><th>\u540D\u79F0</th><th>\u4F9B\u5E94\u5546</th><th>\u63A9\u7801</th><th>\u64CD\u4F5C</th></tr></thead><tbody id="key-tbody"></tbody></table></div>';
  api('GET','/admin/api/keys').then(function(d){state.keys=d.data||d;render_key_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_key_table(){
  var tb=document.getElementById('key-tbody');
  tb.innerHTML=state.keys.map(function(k){
    return '<tr><td>'+esc(k.name||'(\u672A\u547D\u540D)')+'</td><td><code>'+esc(k.provider_id)+'</code></td><td><code>'+esc(k.masked||'****')+'</code></td>'
      +'<td><button class="btn danger" onclick="deleteKey(''+esc(k.id)+'')">\u5220\u9664</button></td></tr>';
  }).join('')||'<tr><td colspan="4" style="text-align:center;color:#8b949e;padding:20px">\u6682\u65E0 Key\uFF0C\u6DFB\u52A0\u540E\u4F9B\u5E94\u5546\u65B9\u53EF\u8F6C\u53D1</td></tr>';
}
window.openKey=function(){var opts=state.providers.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('');setModal('<h3>\u6DFB\u52A0 API Key</h3>'
  +'<div class="form-row"><div style="flex:1"><label>\u540D\u79F0</label><input id="k-name"></div><div style="flex:1"><label>\u6240\u5C5E\u4F9B\u5E94\u5546</label><select id="k-prov">'+opts+'</select></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>\u771F\u5B9E Key\uFF08AES-GCM \u52A0\u5BC6\u5B58\u50A8\uFF0C\u4EC5\u4F60\u53EF\u89C1\uFF09</label><input id="k-secret" type="password" placeholder="sk-..."></div></div>'
  +'<button class="btn" onclick="submitKey()">\u4FDD\u5B58</button>');};
window.submitKey=function(){api('POST','/admin/api/keys',{name:document.getElementById('k-name').value,provider_id:document.getElementById('k-prov').value,secret:document.getElementById('k-secret').value}).then(function(){closeModal();render_keys(document.getElementById('view'));toast('\u2705 \u5DF2\u6DFB\u52A0');});};
window.deleteKey=function(id){if(!confirm('\u786E\u8BA4\u5220\u9664\uFF1F\u5220\u9664\u540E\u8BE5 Key \u65E0\u6CD5\u518D\u7528\u4E8E\u8F6C\u53D1'))return;api('DELETE','/admin/api/keys/'+id).then(function(){render_keys(document.getElementById('view'));toast('\u{1F5D1}\uFE0F \u5DF2\u5220\u9664');});};

// ---- \u4F7F\u7528\u6307\u5357 ----
function render_guide(main){
  main.innerHTML='<div class="topbar"><h2>\u2754 \u4F7F\u7528\u6307\u5357</h2><button class="ghost btn" onclick="localStorage.removeItem(\\'irouter_guide_dismissed\\');toast(\\'\u5DF2\u91CD\u7F6E\uFF0C\u4E0B\u6B21\u8FDB\u5165\u5C06\u518D\u6B21\u5F39\u51FA\\')">\u{1F501} \u91CD\u7F6E\u5F15\u5BFC</button></div>'
    +'<div class="panel" id="guide-box"></div>';
  render_guide_content(document.getElementById('guide-box'));
}
function render_guide_mini(){
  var mount=document.getElementById('guide-mount');
  if(!mount) return;
  mount.innerHTML='<div class="panel" style="border-color:#58a6ff"><h3>\u{1F44B} \u6B22\u8FCE\u4F7F\u7528 iRouter v3.2.0\uFF08Cloudflare D1 \u7248\uFF09</h3><div id="guide-mini-body"></div><button class="btn ghost" onclick="document.getElementById(\\'guide-mount\\').innerHTML=\\''\\'">\u5173\u95ED</button></div>';
  render_guide_content(document.getElementById('guide-mini-body'), true);
  if(!localStorage.getItem('irouter_guide_dismissed')){
    setTimeout(function(){var b=document.getElementById('guide-mini-body');if(b) render_guide_content(b,true);},50);
  }
}
function render_guide_content(el, mini){
  if(!el) return;
  var steps = [
    {t:'\u2460 \u90E8\u7F72\u5B8C\u6210',d:'\u8BBF\u95EE\u300C\u5065\u5EB7\u68C0\u67E5\u300D<code>/health</code> \u5E94\u8FD4\u56DE <code>{"ok":true,"storage":"d1"}</code>\uFF1B\u540E\u53F0\u5404\u9875\u9762\u80FD\u6B63\u5E38\u663E\u793A\u6570\u636E\u5373\u8BF4\u660E D1 \u7ED1\u5B9A\u6B63\u5E38\u3002'},
    {t:'\u2461 \u6DFB\u52A0\u4F9B\u5E94\u5546',d:'\u300C\u4F9B\u5E94\u5546\u300D\u9875 \u2192 \uFF0B \u6DFB\u52A0\uFF0C\u586B\u5199\u540D\u79F0\u3001\u6807\u8BC6\u3001Base URL\u3001\u534F\u8BAE\uFF08openai/anthropic/gemini\uFF09\u3002'},
    {t:'\u2462 \u914D\u7F6E Key',d:'\u300CAPI Keys\u300D\u9875 \u2192 \u6DFB\u52A0\u771F\u5B9E Key\uFF08AES-GCM \u52A0\u5BC6\u5B58\u50A8\uFF0C\u4EC5\u4F60\u53EF\u89C1\uFF09\u3002'},
    {t:'\u2463 \u8BBE\u7F6E\u8DEF\u7531\u89C4\u5219',d:'\u300C\u8DEF\u7531\u89C4\u5219\u300D\u9875 \u2192 \uFF0B \u6DFB\u52A0\uFF0Cpattern \u652F\u6301 <code>*</code> \u901A\u914D\uFF0C\u547D\u4E2D\u540E\u6309\u4F9B\u5E94\u5546\u5217\u8868\u987A\u5E8F\u5C1D\u8BD5 + \u515C\u5E95\u3002'},
    {t:'\u2464 \u9A8C\u8BC1\u8F6C\u53D1',d:'\u590D\u5236\u4E0B\u65B9\u300C\u8C03\u7528\u4FE1\u606F\u300D\u5361\u7684 curl \u793A\u4F8B\uFF0C\u6216\u76F4\u63A5 POST <code>/v1/chat/completions</code>\uFF0CHeader \u5E26 <code>Authorization: Bearer &lt;API_TOKEN&gt;</code>\u3002'},
    {t:'\u2465 \u76D1\u63A7',d:'\u56DE\u5230\u300C\u9996\u9875\u300D\u770B\u6A21\u578B\u6392\u884C / \u4F9B\u5E94\u5546\u5065\u5EB7\u5EA6 / \u6700\u8FD1\u8BF7\u6C42\u3002'},
  ];
  el.innerHTML='<ol style="padding-left:20px">'+
    steps.map(function(s,idx){return '<li style="margin-bottom:12px"><b>'+s.t+'</b><br><span style="color:#c9d1d9;font-size:13px">'+s.d+'</span></li>';}).join('')+
    '</ol>'+
    (mini?'':'<p style="margin-top:16px;color:#8b949e;font-size:12px">\u{1F4A1} \u603B\u89C8\u9875\u7684\u300C\u8C03\u7528\u4FE1\u606F\u300D\u53EF\u968F\u65F6\u67E5\u770B Base URL \u4E0E Token\uFF0C\u5E76\u652F\u6301\u4FEE\u6539\uFF08\u4E0E\u767B\u5F55\u5BC6\u7801\u76F8\u4E92\u72EC\u7ACB\uFF09\u3002</p>');
  if(!mini) localStorage.setItem('irouter_guide_dismissed','1');
}

// ---- \u767B\u5F55 ----
function render_login(){
  document.getElementById('view').innerHTML='<div style="max-width:360px;margin:80px auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px">'
    +'<h2 style="text-align:center;margin-bottom:24px">\u{1F510} iRouter \u7BA1\u7406\u540E\u53F0</h2>'
    +'<label style="font-size:12px;color:#8b949e">\u7BA1\u7406\u5458\u5BC6\u7801</label>'
    +'<input id="login-pass" type="password" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#e6edf3;padding:10px;border-radius:6px;margin:8px 0 16px" placeholder="\u8BF7\u8F93\u5165\u5BC6\u7801">'
    +'<button class="btn" style="width:100%;padding:10px" onclick="doLogin()">\u767B\u5F55</button>'
    +'<p style="font-size:11px;color:#8b949e;margin-top:16px;text-align:center">\u9ED8\u8BA4\u5BC6\u7801\u89C1\u73AF\u5883\u53D8\u91CF DEFAULT_ADMIN_PASS</p></div>';
}
window.doLogin=function(){api('POST','/admin/api/login',{password:document.getElementById('login-pass').value}).then(function(){toast('\u2705 \u767B\u5F55\u6210\u529F');render();}).catch(function(e){toast('\u274C '+(e&&e.error||'\u767B\u5F55\u5931\u8D25'));});};

// ---- \u6A21\u6001\u6846 ----
function setModal(html){document.getElementById('modal-box').innerHTML=html+'<div style="margin-top:16px;text-align:right"><button class="btn ghost" onclick="closeModal()">\u53D6\u6D88</button></div>';document.getElementById('modal').className='modal show';}
window.closeModal=function(){document.getElementById('modal').className='modal';};

// ============ \u5BFC\u822A + \u81EA\u52A8\u5237\u65B0 ============
document.querySelectorAll('.nav a[data-view]').forEach(function(a){
  a.onclick=function(e){e.preventDefault();document.querySelectorAll('.nav a').forEach(function(x){x.classList.remove('active');});a.classList.add('active');currentView=a.dataset.view;location.hash='#'+a.dataset.view;render();};
});
document.getElementById('logout').onclick=function(e){e.preventDefault();document.cookie='irouter_sid=; Max-Age=0; Path=/';toast('\u5DF2\u9000\u51FA');render_login();};
window.onhashchange=function(){var v=location.hash.replace('#','');if(TITLES[v]){currentView=v;render();}};

// 30 \u79D2\u81EA\u52A8\u5237\u65B0\uFF08\u9875\u9762\u53EF\u89C1\u65F6\u624D\u8BF7\u6C42\uFF0C\u8282\u7701\u989D\u5EA6\uFF09
var refreshTimer=null;
function startAutoRefresh(){
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer=setInterval(function(){if(document.hidden) return;if(currentView==='dashboard') fetchDashboard();},30000);
}
startAutoRefresh();

// \u9996\u6B21\u6E32\u67D3
(function init(){
  if(location.hash) currentView=location.hash.replace('#','');
  if(TITLES[currentView]){var a=document.querySelector('.nav a[data-view="'+currentView+'"]');if(a)a.classList.add('active');}
  // \u7B80\u5355\u662F\u5426\u5DF2\u767B\u5F55\u63A2\u6D4B\uFF1A\u76F4\u63A5\u5C1D\u8BD5\u52A0\u8F7D dashboard\uFF0C401 \u5219\u5F39\u767B\u5F55
  api('GET','/admin/api/dashboard').then(function(){render();}).catch(function(){render_login();});
})();
<\/script>
</body></html>`;

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-rv8jVf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-rv8jVf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=bundledWorker-0.19403315534283783.mjs.map
