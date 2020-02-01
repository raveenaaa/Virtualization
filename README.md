# CSC 519: DevOps HW 1

Practice with basic virtualization technology and provision and set up Virtual Machines from the commandline using VirtualBox VBoxManage commands and ssh.

## Preparing the GitHub Repo.

### Clone and set-url

Clone the following repo. Then modify the remote so that it now will point to HW1-DevOps repo.

```bash
git clone http://github.com/CSC-DevOps/V
cd V
git remote -v
git remote set-url origin https://github.ncsu.edu/rmdcosta/HW1-DevOps
```

### Install and test

Install the npm packages, then create a symlink for running your program.
```bash
npm install
npm link
```

## Base Requirements

### VM setup: customize(name) inside commands/up.js

* Adding NIC with NAT networking: `VBoxManage modifyvm <vmname> --nic1 --nat`
* Add a port forward from 2800 => 22 for guestssh: `VBoxManage modifyvm <vmname> --natpf1 "guestssh,tcp,,2800,,22"`
* Add a port forward from 8080 => 9000 for a node application: `VBoxManage modifyvm <vmname> --natpf1 "nodeport,tcp,,8080,,9000"`

After these steps are done you can see two port-forwarding rules in the machine's Settings > Network > Advanced > Port Forwarding

### Post-Configuration: postconfiguration(name) inside commands/up.js
Made use of the ssh wrapper in lib/ssh.js

* Install nodejs, npm, git: 
```bash
sudo apt-get update
sudo-apt-get --yes install npm nodejs git
```
* Clone https://github.com/CSC-DevOps/App: `git clone https://github.com/CSC-DevOps/App`
* Install the npm packages: 
```bash
cd App
sudo npm install
```

### SSH into the VM using spawn

Added a new command by creating a ssh.js inside the commands directory. 

* Implemented and demonstrate running `v ssh`.
* Visit `localhost:8080` to see your running App.

### Extra Requirements

#### Create a second NIC with either host-only networking enabled
This command is in the `customize(name)` function. Added a second NIC with Host-only networking: `VBoxManage modifyvm <vmname> --nic2 hostonly --hostonlyadapter2 <adaptername>`.
The adapter name can be found out using the following [code snippet](https://stackoverflow.com/c/ncsu/questions/1315/1316#1316)

The rest of the commands for these are in the `hostonlyconfigs()` function. All steps were performed using ssh wrapper:
* Install ifupdown: `sudo apt install ifupdown`
* Modifying `/etc/network/interfaces` to make `enp0s8` discoverable: `"echo 'iface enp0s8 inet dhcp' | sudo tee -a /etc/network/interfaces"`
* Set the link up: `sudo ifup enp0s8`

Upon doing this you will be able to see the hostonly link and its IP address using `ifconfig`. Using that IP address you can visit your running app using `<ip>:9000`

#### Create a shared sync folder
* Attach an optical drive to your VM and insert the guest additions CD image: 
```bash
VBoxManage storageattach <vmname> --storagectl "IDE" --port 0 --type dvdrive --medium <isopath> --device 1
``` 

The `<isopath>` is generally: `C:/Program Files/Oracle/VirtualBox/VBoxGuestAdditions.iso`

* Create a virtual shared folder using: 
```bash
VBoxManage sharedfolder add <vmname> --name <guestfoldername> --hostpath <hostfolderpath> --transient --readonly
```

   Where `<sharername>` is the *unique* name to be assigned to the share. **Mandatory** 
   
   `<hostfolderpath>` is the full path to the folder to be shared on the Host-os. **Mandatory**.
   
   `--transient` is **optional** and means that the share is transient and can be added and removed at runtime and doesn't persist. 
   
   `--readonly` is **optional** and allow read-only access.
   
* Adding the user to `vboxsf` group to access shared folder: `sudo usermod -aG vboxsf vagrant`
* Making the shared directory and mounting shared file to the shared directory:
```bash
sudo makedir <guestpath>
sudo mount -t vboxsf <sharename> <guestpath>
```

After performing these steps you will be able to see your files in the shared directory on the guest OS. For more detailed explanation visit [this](https://helpdeskgeek.com/virtualization/virtualbox-share-folder-host-guest/)

### Video Links:

* https://youtu.be/1ZlSpJzpiHM
* https://drive.google.com/file/d/12aBhzp7iR0b--GUZpiOGG1r9QRv37eQA/view?usp=sharing
