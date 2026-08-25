const fs = require("fs");

if (fs.readlink) {
  const originalReadlink = fs.readlink;
  fs.readlink = function (path, options, callback) {
    const cb = typeof options === "function" ? options : callback;
    const opt = typeof options === "function" ? undefined : options;
    originalReadlink(path, opt, (err, linkString) => {
      if (err && (err.code === "EISDIR" || err.code === "EINVAL")) {
        const error = new Error("EINVAL: invalid argument, readlink");
        error.code = "EINVAL";
        error.syscall = "readlink";
        return cb(error);
      }
      return cb(err, linkString);
    });
  };
}

if (fs.readlinkSync) {
  const originalReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function (path, options) {
    try {
      return originalReadlinkSync(path, options);
    } catch (err) {
      if (err && (err.code === "EISDIR" || err.code === "EINVAL")) {
        const error = new Error("EINVAL: invalid argument, readlink");
        error.code = "EINVAL";
        error.syscall = "readlink";
        throw error;
      }
      throw err;
    }
  };
}

if (fs.promises && fs.promises.readlink) {
  const originalPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function (path, options) {
    try {
      return await originalPromisesReadlink(path, options);
    } catch (err) {
      if (err && (err.code === "EISDIR" || err.code === "EINVAL")) {
        const error = new Error("EINVAL: invalid argument, readlink");
        error.code = "EINVAL";
        error.syscall = "readlink";
        throw error;
      }
      throw err;
    }
  };
}
