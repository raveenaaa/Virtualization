const chalk = require('chalk');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const VBoxManage = require('../lib/VBoxManage');
const ssh = require('../lib/ssh');

exports.command = 'up';
exports.desc = 'Provision and configure a new development environment';
exports.builder = yargs => {
    yargs.options({
        force: {
            alias: 'f',
            describe: 'Force the old VM to be deleted when provisioning',
            default: false,
            type: 'boolean'
        }
    });
};


exports.handler = async argv => {
    const { force} = argv;

    (async () => {
    
        await up(force);

    })();

};

async function up(force)
{
    // Use current working directory to derive name of virtual machine
    let cwd = process.cwd().replace(/[/]/g,"-").replace(/\\/g,"-");
    let name = `V-${cwd}`;    
    console.log(chalk.keyword('pink')(`Bringing up machine ${name}`));

    // We will use the image we've pulled down with bakerx.
    let image = path.join(os.homedir(), '.bakerx', '.persist', 'images', 'bionic', 'box.ovf');
    if( !fs.existsSync(image) )
    {
        console.log(chalk.red(`Could not find ${image}. Please download with 'bakerx pull cloud-images.ubuntu.com bionic'.`))
    }

    // We check if we already started machine, or have a previous failed build.
    let state = await VBoxManage.show(name);
    console.log(`VM is currently: ${state}`);
    if( state == 'poweroff' || state == 'aborted' || force) {
        console.log(`Deleting powered off machine ${name}`);
        // Unlock
        await VBoxManage.execute("startvm", `${name} --type emergencystop`).catch(e => e);
        await VBoxManage.execute("controlvm", `${name} --poweroff`).catch(e => e);
        // We will delete powered off VMs, which are most likely incomplete builds.
        await VBoxManage.execute("unregistervm", `${name} --delete`);
    }
    else if( state == 'running' )
    {
        console.log(`VM ${name} is running. Use 'V up --force' to build new machine.`);
        return;
    }

    // Import the VM using the box.ovf file and register it under new name.
    await VBoxManage.execute("import", `"${image}" --vsys 0 --vmname ${name}`);
    // Set memory size in bytes and number of virtual CPUs.
    await VBoxManage.execute("modifyvm", `"${name}" --memory 1024 --cpus 1`);
    // Disconnect serial port
    await VBoxManage.execute("modifyvm", `${name}  --uart1 0x3f8 4 --uartmode1 disconnected`);

    // Run your specific customizations for the Virtual Machine.
    await customize(name);

    // Start the VM.
    // Unlock any session.
    await VBoxManage.execute("startvm", `${name} --type emergencystop`).catch(e => e);
    // Real start.
    await VBoxManage.execute("startvm", `${name} --type headless`);

    // Explicit wait for boot
    await pause(name, 60000);
    
    // Run your post-configuration customizations for the Virtual Machine.
    await postconfiguration(name);
}
exports.up = up

async function pause(name, waitTime)
{   
    console.log(`Waiting ${waitTime}ms for machine to boot.`);        
    await sleep(waitTime);
    state = await VBoxManage.show(name);
    console.log(`VM is currently: ${state}`);
}
exports.pause = pause


async function customize(name)
{   
    // Add NIC with NAT networking
    await VBoxManage.execute("modifyvm", `${name} --nic1 nat`);

    // Adding HOst-only network
    const ifname = 'VirtualBox Host-Only Ethernet Adapter'
    await VBoxManage.execute("modifyvm", `${name} --nic2 hostonly --hostonlyadapter2 "${ifname}"`);

    // Port forwarding for guestssh
    await VBoxManage.execute("modifyvm", `${name} --natpf1 "guestssh,tcp,,2800,,22"`);

    // Port forwarding for node application
    await VBoxManage.execute("modifyvm", `"${name}" --natpf1 "nodeport,tcp,,8080,,9000"`);
    
    console.log(chalk.keyword('pink')(`Running VM customizations...`));
}

async function postconfiguration(name)
{   
    console.log(chalk.keyword('pink')(`Running post-configurations...`));
    
    console.log(chalk.keyword('orange')('Command: ls /'));
    await ssh("ls /");

    console.log(chalk.keyword('orange')('Command: sudo apt-get update'));
    await ssh("sudo apt-get update");

    console.log(chalk.keyword('orange')('Command: Install npm nodejs and git'));
    await ssh("sudo apt-get --yes install npm nodejs git");

    console.log(chalk.keyword('orange')('Command: Cloning repository'));
    await ssh("git clone https://github.com/CSC-DevOps/App");
    
    console.log(chalk.keyword('orange')('Command: Installing node modules'));
    await ssh("cd App ; sudo npm install");
    
    // Extra credit
    await sharedsyncfolders(name);
    await hostonlyconfigs();
}

async function hostonlyconfigs()
{   
    // Extra Credit: Set up Host-only network
    console.log(chalk.keyword('green')(`Setting up Host-only additional configurations...`));
    console.log(chalk.keyword('orange')('Command: Installing ifupdown'));
    await ssh("sudo apt install ifupdown"); 
    console.log(chalk.keyword('orange')('Command: Modifying /etc/network/interfaces'));
    await ssh(`"echo 'iface enp0s8 inet dhcp' | sudo tee -a /etc/network/interfaces"`);
    console.log(chalk.keyword('orange')('Command: Setting enp0s8 link UP'));
    await ssh("sudo ifup enp0s8; ifconfig");
}
exports.hostonlyconfigs = hostonlyconfigs

async function sharedsyncfolders(name)
{   
    // Extra-credit: Set up shared sync folder
    console.log(chalk.keyword('green')(`Setting up shared sync folder`));
    let state = await VBoxManage.show(name);

    // Add optical drive
    const guestadditionspath = "C:\\Program Files\\Oracle\\VirtualBox\\VBoxGuestAdditions.iso"
    await VBoxManage.execute("storageattach", `${name} --storagectl "IDE" \
                                                       --port 0 \
                                                       --type dvddrive \
                                                       --medium "${guestadditionspath}" \
                                                       --device 1`);
    
    const hostpath = process.cwd();
    console.log(chalk.keyword('orange')(`Adding shared folder: ${hostpath}`));
    const sharename = "fileshare"
    const guestpath = "share/"
    await VBoxManage.execute("sharedfolder", `add ${name} \
                                            --name ${sharename} \
                                            --hostpath "${hostpath}" \
                                            --transient \
                                            --readonly`);

    
    console.log(chalk.keyword('orange')(`Mounting shared folder to guest os in share/`));
    await ssh(`sudo usermod -aG vboxsf vagrant`);
    await ssh(`sudo mkdir ${guestpath}; ls`);
    await ssh(`sudo mount -t vboxsf ${sharename} ${guestpath}`); 
}

// Helper utility to wait.
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
