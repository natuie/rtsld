const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const ws = require("socket.io")(server);
const fs = require("fs");
const utils = require("./utils");
const chokidar = require("chokidar");

var uploadInfo = { path: null, filename: null };
let _localPath = null; // 服务器
let _targetPath = null; // 客户端
var serverPort = 7274;
var isUpdate = false;
var isWatch = false;

//处理参数
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "-p":
      serverPort = argv[i + 1];
      i++;
      break;
    case "--local-path":
      _localPath = argv[i + 1];
      i++;
      break;
    case "--target-path":
      _targetPath = argv[i + 1];
      i++;
      break;
    case "-v":
      console.log("Rtsld Version: 1.0.1");
      console.log("Rtsld build date: 2023-01-04 01:47");
      process.exit(0);
    case "--help":
      console.log("Usage: rtsld-server [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  -s                             Enable file monitoring service for real-time file synchronization"
      );
      console.log("  -m                             Send message");
      console.log("  -u [targetPath, sourcePath]    Upload files");
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

app.get("/", function (req, res) {
  res.sendFile(
    __dirname.substring(0, __dirname.lastIndexOf("/") + 1) +
      "/public/" +
      "index.html"
  );
});

ws.on("connection", (client) => {
  utils.prints(1, "Enter server", client.id);
  client.emit("message", "Connect server success!");
  client.emit("targetPath", { localPath: _localPath, targetPath: _targetPath });
  client.on("message", (data) => {
    utils.prints(0, data, client.id);
  });

  client.on("demessage", (data) => {
    console.log(data);
  });

  client.on("upload", (data) => {
    upload(data, client);
  });

  client.on("pull", () => {
    client.emit("message", "Doing pull for client...");
    push(_localPath, client);
    client.emit("demessage", utils.log(2, "Pull complete"));
    client.emit("exit", 0);
  });

  client.on("mkdir", (data) => {
    if (!fs.existsSync(data)) {
      fs.mkdirSync(data);
    }
  });

  client.on("mkfile", (data) => {
    if (!fs.existsSync(data)) {
      fs.closeSync(fs.openSync(data, "w"));
    }
  });

  client.on("unlink", (data) => {
    if (fs.existsSync(data)) {
      fs.unlinkSync(data);
    }
  });

  client.on("rmdir", (data) => {
    utils.deleteFolder(data);
  });

  client.on("write", (data) => {
    client.emit("watch", false);
    fs.writeFileSync(data["path"], data["bytes"], "binary");
    client.emit("watch", true);
  });

  client.on("watch", (data) => {
    isWatch = data;
  });

  client.on("targetPath", (data) => {
    /*
    if (_localPath != null && data.targetPath != null) {
      client.emit(
        "demessage",
        utils.log(
          -2,
          "The target server has set the path, which cannot be set.",
          null
        )
      );
    }

    if (_localPath == null && data.targetPath != null) {
      _localPath = data.targetPath;
    } else if (_targetPath == null && data.localPath != null) {
      _targetPath = data.localPath;
    }
     */
    _localPath = data.targetPath;
    _targetPath = data.localPath;
  });

  client.on("exit", (data) => {
    process.exit(data);
  });

  client.on("disconnect", () => {
    utils.prints(1, "Exit server", client.id);
  });

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "-s":
        isWatch = true;
        i++;
        break;
      case "-m":
        client.emit("message", argv[i + 1]);
        i++;
        break;
      case "-u":
        var targetPath = argv[i + 1];
        var sourcePath = argv[i + 2];
        var filename = targetPath.substring(targetPath.lastIndexOf("/") + 1);
        client.emit("upload", {
          path: targetPath.substring(0, targetPath.lastIndexOf("/") + 1),
          filename: filename,
        });
        client.emit("upload", fs.readFileSync(sourcePath, "binary"));
        i++;
        i++;
        return;
      case "pull":
        client.emit("pull", client);
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
    client.emit(
      "demessage",
      utils.log(1, "File change listener is turned on", client.id)
    );
  }
  watcher
    .on("addDir", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(_localPath.length + 1);
      client.emit("mkdir", _targetPath + "/" + sourcePath);
      utils.echo("Dir " + _targetPath + "/" + sourcePath + " was add!");
      client.emit(
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
      client.emit("upload", {
        path: _targetPath + "/" + sourcePath,
        filename: filename,
      });
      client.emit("upload", fs.readFileSync(path, "binary"));
      utils.echo(
        "File " + _targetPath + "/" + sourcePath + "/" + filename + " was add!"
      );
      client.emit(
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

      client.emit("upload", {
        path: _targetPath + "/" + sourcePath,
        filename: filename,
      });
      client.emit("upload", fs.readFileSync(path, "binary"));
      utils.echo("File " + path + " was change!");
      client.emit("message", "File " + path + " was change!");
    })
    .on("unlink", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      const sourcePath = path.substring(_localPath.length + 1);
      client.emit("unlink", _targetPath + "/" + sourcePath);
      utils.echo("File " + _targetPath + "/" + sourcePath + " was deleted!");
      client.emit(
        "message",
        "File " + _targetPath + "/" + sourcePath + " was deleted!"
      );
    })
    .on("unlinkDir", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      const sourcePath = path.substring(_localPath.length + 1);
      client.emit("rmdir", _targetPath + "/" + sourcePath);
      utils.echo("Dir " + _targetPath + "/" + sourcePath + " was deleted!");
      client.emit(
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

console.log("Server is http://127.0.0.1:" + serverPort);
server.listen(serverPort);
