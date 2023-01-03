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
      console.log("Rtsld Version: 1.0.0");
      console.log("Rtsld build date: 2023-1-1 11.47");
      process.exit(0);
    case "--help":
      console.log("Usage: rtsld [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  -s                             Enable file monitoring service for real-time file synchronization"
      );
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

socket.emit('targetPath', {localPath: _localPath, targetPath: _targetPath});

socket.on("message", (data) => {
  utils.echo(data);
});

socket.on("demessage", (data) => {
  console.log(data);
});

socket.on("upload", (data) => {
  if (uploadInfo["path"] == null && !isUpdate) {
    uploadInfo["filename"] = data.filename;
    uploadInfo["path"] = data.path;
    isUpdate = true;
    return;
  }
  isUpdate = false;
  fs.writeFile(
    uploadInfo["path"] + "/" + uploadInfo["filename"],
    data,
    "binary",
    function (err) {
      if (err) {
        socket.emit("message", err);
      }
    }
  );
  socket.emit(
    "message",
    "File " + uploadInfo["path"] + "/" + uploadInfo["filename"] + " upload success!"
  );
  uploadInfo["filename"] = null;
  uploadInfo["path"] = null;
});

socket.on("pull", () => {
  socket.emit('message', "Doing pull for client...");
  push(_localPath, socket);
  socket.emit('demessage', utils.log(2, "Pull complete"));
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
  console.log(data)
  if (_localPath != null && data.targetPath != null) {
    socket.emit('demessage', utils.log(-2, "The target client has set the path, which cannot be set.", null));
  }

  if (_localPath == null && data.targetPath != null) {
    _localPath = data.targetPath;
  } else if (_targetPath == null && data.localPath != null ){
    _targetPath = data.localPath;
  }
});
socket.on('disconnect', () => {
  utils.print(1, "Server " + " close");
});
for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "-s":
      isWatch = true;
      i++;
      break;
      case "-m":
        socket.emit('message', argv[i +1]);
        i++;
        break;
    case "-u":
      _targetPath = argv[i + 1]; //target
      var sourcePath = argv[i + 2]; //source
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
      return;
  }
}

var watcher = chokidar.watch(_localPath, {
  ignored: /[\/\\]\./,
  persistent: true,
});

var scanReady = false;
watcher
  .on("addDir", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(_localPath.length + 1);
    socket.emit("mkdir", _targetPath + "/" + sourcePath);
    utils.echo("Dir " + _targetPath + "/" + sourcePath + " was add!");
  })
  .on("add", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(
      _localPath.length + 1,
      path.lastIndexOf("/") + 1
    );

    var filename = path.substring(path.lastIndexOf("/") + 1);
    socket.emit("upload", {
      path: _targetPath + "/" + sourcePath,
      filename: filename,
    });
    socket.emit("upload", fs.readFileSync(path, "binary"));
    utils.echo("File " + _targetPath + "/" + sourcePath + '/' +filename + " was add!");
  })
  .on("change", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(
      _localPath.length + 1,
      path.lastIndexOf("/") + 1
    );
    var filename = path.substring(path.lastIndexOf("/") + 1);
    if (!fs.existsSync(path)) {
      return;
    }

    socket.emit("upload", {
      path: _targetPath + "/" + sourcePath,
      filename: filename,
    });
    socket.emit("upload", fs.readFileSync(path, "binary"));
    utils.echo("File " + path + " was change!");
  })
  .on("unlink", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(_localPath.length + 1);
    socket.emit("unlink", _targetPath + "/" + sourcePath);
    utils.echo("File " + _targetPath + "/" + sourcePath + " was deleted!");
  })
  .on("unlinkDir", function (path) {
    if (!scanReady || !isWatch) {
      return;
    }
    var sourcePath = path.substring(_localPath.length + 1);
    socket.emit("rmdir", _targetPath + "/" + sourcePath);
    utils.echo("Dir " + _targetPath + "/" + sourcePath + " was deleted!");
  })
  .on("error", function (error) {
    utils.echo(error);
  })
  .on("ready", function () {
    scanReady = true;
  });

  function push(path, socket) {
    var pa = fs.readdirSync(path);
    var sourcePath = path.substring(_localPath.length + 1);
    pa.forEach(function (filename, index) {
      var info = fs.statSync(path + "/" + filename);
      if (info.isDirectory()) {
        socket.emit("mkdir", _targetPath + "/" + sourcePath + "/" + filename);
        push(path + "/" + filename, socket);
      } else {
        sourcePath = path.substring(_localPath.length + 1);
        utils.echo("Client " + socket.clientId + " pull " +  path + "/" + filename);
        socket.emit('message', "Pull " + path + "/" + filename);
        socket.emit("upload", {
          path: _targetPath + "/" + sourcePath,
          filename: filename,
        });
        socket.emit("upload", fs.readFileSync(path + "/" + filename, "binary"));
      }
    });
  }
