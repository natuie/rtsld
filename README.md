# rtsld
Real time data synchronization in the same LAN can be used for multiple devices to implement time consuming compilation projects, as well as for backup and file transfer.

## Installation

``` bash
# Way 1: Github 
# curl https://github.com/naucye/rtsld/raw/main/setup.sh -o setup.sh
# Way 1: Gitee
curl https://gitee.com/naucye/rtsld/raw/main/setup.sh -o setup.sh

# Start installation
bash setup.sh -i
```

## Usage
Use command `rtsld --help` to view usage

`rtsld` is client, and `rtsld-server` is server

## Tips
The maximum size of the file transferred in the current version is 160Kb. Only one-way synchronization is supported, but the direction can be changed. The next version will be repaired.If there is a bug, please send the email to `naucye@qq.com`.

## Uninstall
```
bash setup.sh -r
```