#!/usr/bin/env bash
CYAN="$(printf '\033[36m')"
GREEN="$(printf '\033[32m')"
YELLOW="$(printf '\033[33m')"
RED="$(printf '\033[31m')"
RESET="$(printf '\033[m')"

install() {
    if read -p "${CYAN}Continue to install the rtsld?[Y/n]${RESET}" yes ;then
    	if ! [[ -z $yes || "$yes" = "Y" || "$yes" = "y" ]];then
	    	exit 0;
    	fi
    fi

    if [ -x "$(command -v rtsld)" ]; then
    	echo "${YELLOW}warning: You have already installed, will reinstall${RESET}"
    fi

    echo "[${GREEN}*${RESET}] Fetch https://github.com/naucye/rtsld"
    cd /usr/share/
    if ! [ -d  /usr/share/rtsld ];then
        git clone https://github.com/naucye/rtsld
    else
        cd /usr/share/rtsld
        git fetch --all
    fi
    
    if ! [ -f  /usr/share/rtsld/package.json ];then
        echo "[${RED}*${RESET}] ${RED}Fetch failed!${RESET}"
        exit 0
    fi

    echo "[${GREEN}*${RESET}] Install related modules for you..."
    cd /usr/share/rtsld
    if [ -x "$(command -v yarn)" ]; then
        yarn install
    else
        if [ -x "$(command -v npm)" ]; then
            echo "${YELLOW}warning: It is detected that you have not installed yarn, and npm will be used${RESET}"
    	    npm install
    	else
    	    echo "${RED}error: You do not have npn installed${RESET}"
    	    exit 0
        fi
    fi
    echo ''
    echo "[${GREEN}*${RESET}] Setting permissions for the executable..."
    chmod -v 777 /usr/share/rtsld/bin/*
    if ! [[ -f /usr/bin/rtsld || -f /usr/bin/rtsld-server ]];then
        echo "[${GREEN}*${RESET}] Link executable"
        ln -sv /usr/share/rtsld/bin/rtsld /usr/bin/rtsld
        ln -sv /usr/share/rtsld/bin/rtsld-server /usr/bin/rtsld-server
    fi
    echo "[${GREEN}*${RESET}] ${GREEN}Installtion success!${RESET}"
}

uninstall() {
    if ! [[ -d  /usr/share/rtsld && -x "$(command -v rtsld)" ]];then
        echo "${RED}error: You do not have rtsld installed${RESET}"
      exit 0
    fi

    if read -p "${CYAN}Continue to remove the rtsld?[Y/n]${RESET}" yes ;then
    	if ! [[ -z $yes || "$yes" = "Y" || "$yes" = "y" ]];then
    		exit 0
    	fi
    fi

    rm -rfv /usr/share/rtsld
    rm -rfv /usr/bin/rtsld
    rm -rfv /usr/bin/rtsld-server
    echo "[${GREEN}*${RESET}] ${GREEN}Remove success!${RESET}"
}

main() {
    for((i=0;i<=$#;i++));do
    	case "$(eval echo '$'${i})" in
	    	"-i" | "--install")
		        install
		    	exit 0 ;;
	    	"-r" | "--uninstall")
		    	uninstall
	    		exit 0 ;;
	    	"-f" | "--fetch")
	    	    echo "[${GREEN}*${RESET}] Fetch https://github.com/naucye/rtsld"
		    	cd /usr/share/rtsld
                git fetch --all
	    		exit 0 ;;
    		"-h" | "--help")
    		    echo "Usage: bash setup.sh [parm]"
    		    echo ''
    			echo "  -i | --install        Install package"
	    		echo "  -r | --uninstall      UnInstall package"
	    		echo "  -f | --fetch          Update package"
    			exit 0;;
    	esac
    done
}

main "$@"