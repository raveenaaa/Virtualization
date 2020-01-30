
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const exec = require('child_process').exec;

let identifyFile = path.join(os.homedir(), '.bakerx', 'insecure_private_key');
let sshExe = `ssh -i "${identifyFile}" -p 2800 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null  vagrant@127.0.0.1`;

module.exports = async function(cmd) {
    return new Promise(function (resolve, reject) {   
        exec(`${sshExe} ${cmd}`, (error, stdout, stderr) => {

            console.log(error || stderr);
            console.log(stdout);
            resolve()

        });
    });
}