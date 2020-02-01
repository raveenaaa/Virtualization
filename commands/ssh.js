const os    = require('os');
const path  = require('path');
const VBoxManage = require('../lib/VBoxManage');
const up = require('./up')
var spawn = require('child_process').spawn;

let identifyFile = path.join(os.homedir(), '.bakerx', 'insecure_private_key');
let sshExe = `ssh -i "${identifyFile}" -p 2800 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null  vagrant@127.0.0.1`;

exports.command = 'ssh'

async function startVM(){
    let cwd = process.cwd().replace(/[/]/g,"-").replace(/\\/g,"-");
    let name = `V-${cwd}`;

    // Check VM's current state
    let state = await VBoxManage.show(name);

    // If State is poweroff or paused, start the vm
    if( state == 'poweroff' || state == 'paused' ) {
        console.log(`VM ${name} is in ${state} state`);
        console.log(`Starting the VM: ${name}`);
        // Unlock any session.
        await VBoxManage.execute("startvm", `${name} --type emergencystop`).catch(e => e);
        // Real start.
        await VBoxManage.execute("startvm", `${name} --type headless`);
        await up.pause(name, 60000);
        await up.hostonlyconfigs();
    }
    // If running proceed to spawning
    else if( state == 'running' ) {
        console.log(`VM ${name} is running.`);
    }
    // If aborted
    else {
        // Set up and run the VM using code in up.js
        await up.up(true);
    }    
}

async function ssh(){
    await startVM();
    spawn('sh', ['-c', sshExe], {stdio: 'inherit'});
}

exports.handler =  (async () => {
    
        await ssh();

});