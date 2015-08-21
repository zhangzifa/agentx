'use strict';

var fs = require('fs');
var path = require('path');
var through = require('through2');
var split = require('split2');
var helper = require('../utils');

var MAX_LINES = 200; // 最多200行数据
var buffered = [];
exports.logdir = ''; // 日志路径

var map = new Map();

var patt = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{6}\] \[(.+)\] \[(.+)\] \[(\d+)\] (.*)/g;
var reg = /([^\s]*): (\d+)/g;

function getNodeLog(msg) {
  var matched;
  var result = {ok: true, data: []};
  while ((matched = patt.exec(msg)) !== null) {
    var pid = matched[3];
    var detail = matched[4];

    var pair;
    while ((pair = reg.exec(detail)) !== null)  {
      result.data.push({
        pid: pid,
        item: pair[1],
        value: parseFloat(pair[2])
      });
    }
  }
  return result;
}

var getCurrentLogPath = function () {
  var now = new Date();
  var date = helper.getYYYYMMDD(now);
  return path.join(exports.logdir, 'node-' + date + '.log');
};

var readFile = function (filepath, callback) {
  fs.stat(filepath, function (err, stats) {
    if (err) {
      return callback(err);
    }

    if (!stats.isFile()) {
      err = new Error(filepath + ' is not a file');
      return callback(err);
    }

    var start = map.get(filepath) || 0;
    if (stats.size === start) {
      return callback(null);
    }

    var readable = fs.createReadStream(filepath, {start: start});
    readable.pipe(split()).pipe(through(function (line, _, next) {
      if (line.length) {
        buffered.push(line);
        if (buffered.length > MAX_LINES) {
          buffered.shift(); // 删掉前面的
        }
      }
      next();
    }));

    readable.on('data', function (data) {
      start += data.length;
    });

    readable.on('end', function () {
      map.set(filepath, start);
      callback(null);
    });
  });
};

var readLog = function (callback) {
  var currentPath = getCurrentLogPath();
  var current = map.get('currentFile');

  if (currentPath !== current) {
    map.set('currentFile', currentPath);
    readFile(current, function (err) {
      if (err) {
        return callback(err);
      }
      readFile(currentPath, callback);
    });
  } else {
    readFile(currentPath, callback);
  }
};

exports.init = function (config) {
  exports.logdir = config.logdir;
  var currentPath = getCurrentLogPath();
  map.set('currentFile', currentPath);
  buffered = [];
};

exports.run = function (callback) {
  if (!exports.logdir) {
    return callback(new Error("Not specific logdir in agentx config file"));
  }

  readLog(function (err) {
    if (err) {
      return callback(err);
    }

    var message = buffered.join('\n');
    // clean
    buffered = [];
    callback(null, {
      type: 'node_log',
      metrics: getNodeLog(message)
    });
  });
};
