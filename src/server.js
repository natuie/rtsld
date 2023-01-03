const express = require("express");
const app = express();
const server = require("http").createServer(app);
const ws = require("socket.io")(server);
const fs = require("fs");
const utils = require("./utils");
const chokidar = require("chokidar");

var uploadInfo = { path: null, filename: null };
let _localPath = null; // 服务器
let _targetPath = null; // 客户端
let targetPathss = null; // 客户端
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
      _localPath = argv[i + 1];;
      i++;
      break;
    case "--target-path":
      _targetPath = argv[i + 1];;
      i++;
      break;
    case "-v":
      console.log("Rtsld Version: 1.0.0");
      console.log("Rtsld build date: 2023-1-1 11.47");
      process.exit(0);
    case "--help":
      console.log("Usage: rtsld-server [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  -s                             Enable file monitoring service for real-time file synchronization"
      );
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

ws.on("connection", (client) => {
  client.emit('message', "Connect server success!");

client.emit('targetPath', {localPath: _localPath, targetPath: _targetPath});
  console.log(_targetPath)
  client.on("message", (data) => {
    utils.prints(0, data, client.id);
  });

  client.on("demessage", (data) => {
    console.log(data);
  });

  client.on("upload", (data) => {
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
          client.emit("message", err);
        }
      }
    );
    client.emit(
      "message",
      "File " + uploadInfo["path"] + "/" + uploadInfo["filename"] + " upload success!"
    );
    uploadInfo["filename"] = null;
    uploadInfo["path"] = null;
  });

  client.on("pull", () => {
    client.emit('message', "Doing pull for client...");
    push(_localPath, client);
    client.emit('demessage', utils.log(2, "Pull complete"));
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
    if (_localPath != null && data.targetPath != null) {
      client.emit('demessage', utils.log(-2, "The target server has set the path, which cannot be set.", null));
    }

    if (_localPath == null && data.targetPath != null) {
      _localPath = data.targetPath;
    } else if (_targetPath == null && data.localPath !=null ){
      _targetPath = data.localPath;
    }
  });


  client.on('disconnect', () => {
    utils.print(1, "Client " + client.id + " exit");
  });


  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "-s":
        isWatch = true;
        i++;
        break;
        case "-m":
        client.emit('message', argv[i +1]);
        i++;
        break;
      case "-u":
        var targetPath = argv[i + 1]; //target
        var sourcePath = argv[i + 2]; //source
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
        return;
    }
  }
  if (_localPath == null) return;

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
      client.emit("mkdir ", targetPath + "/" + sourcePath);
      utils.echo("Dir " + targetPath + "/" + sourcePath + " was add!");
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
      client.emit("upload", {
        path: targetPath + "/" + sourcePath,
        filename: filename,
      });
      client.emit("upload", fs.readFileSync(path, "binary"));
      utils.echo("File " + targetPath + "/" + sourcePath + '/' +filename + " was add!");
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

      client.emit("upload", {
        path: targetPath + "/" + sourcePath,
        filename: filename,
      });
      client.emit("upload", fs.readFileSync(path, "binary"));
      utils.echo("File " + path + " was change!");
    })
    .on("unlink", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(_localPath.length + 1);
      client.emit("unlink", targetPath + "/" + sourcePath);
      utils.echo("File " + targetPath + "/" + sourcePath + " was deleted!");
    })
    .on("unlinkDir", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(_localPath.length + 1);
      client.emit("rmdir", targetPath + "/" + sourcePath);
      utils.echo("Dir " + targetPath + "/" + sourcePath + " was deleted!");
    })
    .on("error", function (error) {
      utils.echo(error);
    })
    .on("ready", function () {
      scanReady = true;
    });
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

console.log("Server is http://127.0.0.1:" + serverPort);
server.listen(serverPort);