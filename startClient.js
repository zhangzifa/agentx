#!/usr/bin/env node

'use strict';

var cfork = require('cfork');
var util = require('util');

var printUsage = function () {
  console.log('请指定配置文件, 用法:');
  console.log('  agentx <config.json>');
};

var readConfig = function () {
  var argv = process.argv.slice(2);
  if (argv.length < 1) {
    printUsage();
    process.exit(1);
  }
  return argv[0];
};


cfork({
  exec: './client.js',
  args: [readConfig()],
  count: 1
})
.on('fork', function (worker) {
  console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
})
.on('disconnect', function (worker) {
  console.warn('[%s] [master:%s] wroker:%s disconnect, suicide: %s, state: %s.',
    Date(), process.pid, worker.process.pid, worker.suicide, worker.state);
})
.on('exit', function (worker, code, signal) {
  var exitCode = worker.process.exitCode;
  var err = new Error(util.format('worker %s died (code: %s, signal: %s, suicide: %s, state: %s)',
    worker.process.pid, exitCode, signal, worker.suicide, worker.state));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] wroker exit: %s', Date(), process.pid, err.stack);
})

// if you do not listen to this event
// cfork will output this message to stderr
.on('unexpectedExit', function (worker, code, signal) {
  // logger what you want
});

