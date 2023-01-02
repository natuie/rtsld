const express = require("express");
const app = express();
const server = require("http").createServer(app);
const ws = require("socket.io")(server);
const fs = require("fs");
const utils = require("./utils");
const chokidar = require("chokidar");
var uploadInfo = { path: null, filename: null };
var localPath = "~"; // 服务器
var targetPath = "~"; // 客户端
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
      var path = argv[i + 1];
      localPath = path;
      i++;
      break;
    case "--target-path":
      var path = argv[i + 1];
      targetPath = path;
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
  console.log("client enter");
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
      "'File '" + uploadInfo["filename"] + "' upload success!"
    );
    uploadInfo["filename"] = null;
    uploadInfo["path"] = null;
  });

  client.on("pull", () => {
    push(localPath);
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

  client.on("message", (data) => {
    console.log(client.id + ": " + data);
  });

  client.on("watch", (data) => {
    isWatch = data;
  });
  console.log(argv);
  for (let i = 0; i < argv.length; i++) {
    console.log(argv[i]);
    switch (argv[i]) {
      case "-s":
        isWatch = true;
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
        console.log("Doing pull for client...");
        client.emit("pull");
        return;
      default:
        console.log("Unknown parameter: " + argv[i]);
    }
  }

  var watcher = chokidar.watch(localPath, {
    ignored: /[\/\\]\./,
    persistent: true,
  });

  var scanReady = false;
  watcher
    .on("addDir", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(localPath.length + 1);
      client.emit("mkdir", targetPath + "/" + sourcePath);
      console.log("Di " + targetPath + "/" + sourcePath + " was add!");
    })
    .on("add", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(
        localPath.length + 1,
        path.lastIndexOf("/") + 1
      );

      var filename = path.substring(path.lastIndexOf("/") + 1);
      console.log("11111: " + sourcePath, targetPath + "/" + sourcePath);
      client.emit("upload", {
        path: targetPath + "/" + sourcePath,
        filename: filename,
      });
      client.emit("upload", fs.readFileSync(path, "binary"));
      console.log("File " + targetPath + "/" + sourcePath + '/' +filename + " was add!");
    })
    .on("change", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(
        localPath.length + 1,
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
      console.log("File " + path + " was change!");
    })
    .on("unlink", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(localPath.length + 1);
      client.emit("unlink", targetPath + "/" + sourcePath);
      console.log("File " + targetPath + "/" + sourcePath + " was deleted!");
    })
    .on("unlinkDir", function (path) {
      if (!scanReady || !isWatch) {
        return;
      }
      var sourcePath = path.substring(localPath.length + 1);
      client.emit("rmdir", targetPath + "/" + sourcePath);
      console.log("Dir " + targetPath + "/" + sourcePath + " was deleted!");
    })
    .on("error", function (error) {
      console.log(error);
    })
    .on("ready", function () {
      scanReady = true;
      console.log("Scaning complete");
    });
});

function push(path, socket) {
  console.log("client push");
  var pa = fs.readdirSync(path);
  var sourcePath = path.substring(localPath.length + 1);
  pa.forEach(function (filename, index) {
    var info = fs.statSync(path + "/" + filename);
    if (info.isDirectory()) {
      socket.emit("mkdir", targetPath + "/" + sourcePath + "/" + filename);
      push(path + "/" + filename, socket);
    } else {
      sourcePath = path.substring(localPath.length + 1);
      console.log(path + "/" + sourcePath + "/" + filename);
      socket.emit("upload", {
        path: targetPath + "/" + sourcePath,
        filename: filename,
      });
      socket.emit("upload", fs.readFileSync(path + "/" + filename, "binary"));
    }
  });
}

console.log("Server is 127.0.0.1:" + serverPort);
server.listen(serverPort);