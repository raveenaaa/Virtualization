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
    const { force } = argv;

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

    // Import the VM using the box.ovf file and register it under new name.
    await VBoxManage.execute("import", `"${image}" --vsys 0 --vmname ${name}`);
    // Set memory size in bytes and number of virtual CPUs.
    await VBoxManage.execute("modifyvm", `"${name}" --memory 1024 --cpus 1`);
    // Disconnect serial port
    await VBoxManage.execute("modifyvm", `${name}  --uart1 0x3f8 4 --uartmode1 disconnected`);

    // Run your specific customizations for the Virtual Machine.
    await customize();

    // Start the VM.
    // Unlock any session.
    await VBoxManage.execute("startvm", `${name} --type emergencystop`).catch(e => e);
    // Real start.
    await VBoxManage.execute("startvm", `${name} --type headless`);

    // Explicit wait for boot
    let waitTime = 30000;
    console.log(`Waiting ${waitTime}ms for machine to boot.`);        
    await sleep(waitTime);
    console.log(`VM is currently: ${state}`);
    
    // Run your post-configuration customizations for the Virtual Machine.
    await postconfiguration();

}

async function customize()
{
    console.log(chalk.keyword('pink')(`Running VM customizations...`));
}

async function postconfiguration()
{
    console.log(chalk.keyword('pink')(`Running post-configurations...`));
     
    ssh("ls");
}

// Helper utility to wait.
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}