const io = require("socket.io-client");
const fs = require("fs");
const chokidar = require("chokidar");
const utils = require("./utils");
let _localPath = null; // 服务器
let _targetPath = null; // 客户端
var serverPort = 7274;
var serverUrl = "http://127.0.0.1";
var uploadInfo = { path: null, filename: null };
var isUpdate = false;
var isWatch = false;

//处理参数
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "--local-path":
      _localPath = argv[i + 1];
      i++;
      break;
    case "--target-path":
      _targetPath = argv[i + 1];
      i++;
      break;
    case "-i":
      serverUrl = argv[i + 1];
      i++;
      break;
    case "-p":
      serverPort = argv[i + 1];
      i++;
      break;
    case "-v":
      console.log("Rtsld Version: 1.0.1");
      console.log("Rtsld build date: 2023-01-04 01:47");
      process.exit(0);
    case "--help":
      console.log("Usage: rtsld [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  -s                             Enable file monitoring service for real-time file synchronization"
      );
      console.log("  -m                             Send message");
      console.log("  -u [targetPath, sourcePath]    Upload files");
      console.log(
        "  -i                             The url of the rstld service"
      );
      console.log(
        "  -p                             The port of the url of the rstld service"
      );
      console.log(
        "  --local-path                   Local file path, for file transfer"
      );
      console.log(
        "  -target-path                   Destination file path, for file transfer"
      );
      console.log("  -v                             Get package information");
      console.log("  --help                         Get help information");
      process.exit(0);
  }
}

console.log("Connect " + serverUrl + ":" + serverPort);
const socket = io.connect(serverUrl + ":" + serverPort);

socket.emit("targetPath", { localPath: _localPath, targetPath: _targetPath });

socket.on("message", (data) => {
  utils.echo(data);
});

socket.on("demessage", (data) => {
  console.log(data);
});

socket.on("upload", (data) => {
  upload(data, socket);
});

socket.on("pull", () => {
  socket.emit("message", "Doing pull for client...");
  push(_localPath, socket);
  socket.emit("demessage", utils.log(2, "Pull complete", null));
  socket.emit("exit", 0);
});

socket.on("mkdir", (data) => {
  if (!fs.existsSync(data)) {
    fs.mkdirSync(data);
  }
});

socket.on("mkfile", (data) => {
  if (!fs.existsSync(data)) {
    fs.closeSync(fs.openSync(data, "w"));
  }
});

socket.on("unlink", (data) => {
  if (fs.existsSync(data)) {
    fs.unlinkSync(data);
  }
});

socket.on("rmdir", (data) => {
  utils.deleteFolder(data);
});

socket.on("write", (data) => {
  socket.emit("watch", false);
  fs.writeFileSync(data["path"], data["bytes"], "binary");
  socket.emit("watch", true);
});

socket.on("targetPath", (data) => {
  /*
  if (_localPath != null && data.targetPath != null) {
    socket.emit(
      "demessage",
      utils.log(
        -2,
        "The target client has set the path, which cannot be set.",
        null
      )
    );
  }
  */

  if (_localPath == null && data.targetPath != null) {
    _localPath = data.targetPath;
  } else if (_targetPath == null && data.localPath != null) {
    _targetPath = data.localPath;
  }
});

socket.on("exit", (data) => {
  process.exit(data);
});

socket.on("disconnect", () => {
  utils.print(1, "Server " + " close");
});
for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "-s":
      isWatch = true;
      i++;
      break;
    case "-m":
      socket.emit("message", argv[i + 1]);
      i++;
      break;
    case "-u":
      _targetPath = argv[i + 1];
      var sourcePath = argv[i + 2];
      var filename = _targetPath.substring(_targetPath.lastIndexOf("/") + 1);
      socket.emit("upload", {
        path: _targetPath.substring(0, _targetPath.lastIndexOf("/") + 1),
        filename: filename,
      });
      socket.emit("upload", fs.readFileSync(sourcePath, "binary"));
      i++;
      i++;
      return;
    case "pull":
      socket.emit("pull");
  }
}

if (_localPath == null) return;

const watcher = chokidar.watch(_localPath, {
  ignored: /[\/\\]\./,
  persistent: true,
});

let scanReady = false;
if (isWatch) {
  utils.print(1, "File change listener is turned on");
  socket.emit(
    "demessage",
    utils.log(1, "File change listener is turned on", null)
  );
}
watcher
  .on("addDir", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(_localPath.length + 1);
    socket.emit("mkdir", _targetPath + "/" + sourcePath);
    utils.echo("Dir " + _targetPath + "/" + sourcePath + " was add!");
    socket.emit(
      "message",
      "Dir " + _targetPath + "/" + sourcePath + " was add!"
    );
  })
  .on("add", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    const sourcePath = path.substring(
      _localPath.length + 1,
      path.lastIndexOf("/") + 1
    );

    const filename = path.substring(path.lastIndexOf("/") + 1);
    socket.emit("upload", {
      path: _targetPath + "/" + sourcePath,
      filename: filename,
    });
    socket.emit("upload", fs.readFileSync(path, "binary"));
    utils.echo(
      "File " + _targetPath + "/" + sourcePath + "/" + filename + " was add!"
    );
    socket.emit(
      "message",
      "File " + _targetPath + "/" + sourcePath + "/" + filename + " was add!"
    );
  })
  .on("change", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    const sourcePath = path.substring(
      _localPath.length + 1,
      path.lastIndexOf("/") + 1
    );
    const filename = path.substring(path.lastIndexOf("/") + 1);
    if (!fs.existsSync(path)) {
      return;
    }

    socket.emit("upload", {
      path: _targetPath + "/" + sourcePath,
      filename: filename,
    });
    socket.emit("upload", fs.readFileSync(path, "binary"));
    utils.echo("File " + path + " was change!");
    socket.emit("message", "File " + path + " was change!");
  })
  .on("unlink", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    const sourcePath = path.substring(_localPath.length + 1);
    socket.emit("unlink", _targetPath + "/" + sourcePath);
    utils.echo("File " + _targetPath + "/" + sourcePath + " was deleted!");
    socket.emit(
      "message",
      "File " + _targetPath + "/" + sourcePath + " was deleted!"
    );
  })
  .on("unlinkDir", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    const sourcePath = path.substring(_localPath.length + 1);
    socket.emit("rmdir", _targetPath + "/" + sourcePath);
    utils.echo("Dir " + _targetPath + "/" + sourcePath + " was deleted!");
    socket.emit(
      "message",
      "Dir " + _targetPath + "/" + sourcePath + " was deleted!"
    );
  })
  .on("error", function (error) {
    utils.print(-1, error.message);
  })
  .on("ready", function () {
    scanReady = true;
  });

function push(path, socket) {
  const pa = fs.readdirSync(path);
  let sourcePath = "/" + path.substring(_localPath.length + 1);
  pa.forEach(function (filename, index) {
    const info = fs.statSync(path + "/" + filename);
    if (info.isDirectory()) {
      socket.emit("mkdir", _targetPath + sourcePath + "/" + filename);
      push(path + "/" + filename, socket);
    } else {
      sourcePath = "/" + path.substring(_localPath.length + 1);
      utils.prints(0, "Pull " + path + "/" + filename, socket.id);
      socket.emit("message", "Pull " + path + "/" + filename);
      socket.emit("upload", {
        path: _targetPath + sourcePath,
        filename: filename,
      });
      socket.emit("upload", fs.readFileSync(path + "/" + filename, "binary"));
    }
  });
}

function upload(data, socket) {
  if (uploadInfo["path"] == null && !isUpdate) {
    uploadInfo["filename"] = data.filename;
    uploadInfo["path"] = data.path;
    isUpdate = true;
    return;
  }
  isUpdate = false;

  if (socket.id == undefined) {
    socket.emit(
      "demessage",
      utils.log(
        -2,
        "The server has been disconnected, unable to continue pulling.",
        null
      )
    );
    return;
  }

  fs.writeFile(
    uploadInfo["path"] + "/" + uploadInfo["filename"],
    data,
    "binary",
    function (err) {
      if (err) {
        socket.emit("demessage", utils.log(-2, err.message, null));
        return;
      }
    }
  );
  socket.emit(
    "message",
    "File " +
      uploadInfo["path"] +
      "/" +
      uploadInfo["filename"] +
      " upload success!"
  );

  uploadInfo["filename"] = null;
  uploadInfo["path"] = null;
}
