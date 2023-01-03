const fs = require("fs");
const colors = require("colors");
const sd = require("silly-datetime");

// 递归删除文件夹
function deleteFolder(path) {
  var files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file, index) {
      var curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        deleteFolder(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function log(type, message, attach){
  let msg = sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss') + ' ';
  if (message == null) {
    message = "NULL point";
    type = -1;
  }
  if (type == 0) {
    type = "[INFO]";
  } else if(type == 1) {
    type = "[WARN]".yellow;
    message = message.yellow;
  } else if(type == 2) {
    type = "[SUCCESS]".green;
    message = message.green;
  } else if (type == 3) {
    type = "[TEST]".gray;
    message = message.gray;
  } else if (type == -1) {
    type = "[ERROR]".red;
    message = message.red;
  } 
  msg += type + ' ';
  if (attach != null) {
    msg += attach + ': ';
  }
  msg += message;
  return msg;
}

function prints(type, message, attach){
  console.log(log(type, message, attach));
}

function print(type, message){
  prints(type, message, null);
}

function echo(message){
  prints(0, message, null);
}

module.exports = {
  deleteFolder,
  log,
  print,
  prints,
  echo
};
