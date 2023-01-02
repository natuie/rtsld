cd /usr/share/
git clone https://github.com/naucye/rtsld
yarn install
chmod -v 777 /usr/share/rtsld/bin/*
ln -sv /usr/share/rtsld/bin/* /usr/bin
echo "install success!"