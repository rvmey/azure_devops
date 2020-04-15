const {app, shell, Tray, Menu, BrowserWindow, ipcMain} = require('electron');

// These are for the GUI editor:
var electron = require('electron');
var ipc = ipcMain;

var cp = require('child_process');
// var spawn = require('child_process').spawn;

var util = require('util');

var fs = require('fs');
var http = require('http');
var path = require('path');
const ChildProcess = require('child_process');


// For GUI editor
var myAppMenu, menuTemplate;

if (process.platform === 'win32') {
  var Service = require('node-windows').Service;
  var wincmd = require('node-windows');

  // Create a new service object - global so I can use it to install/remove/stop/start
  var serviceName = 'TRIGGERcmdAgent';
  var progPath = path.resolve(__dirname, 'service.js');
  var svc = new Service({
    name: serviceName,
    description: serviceName,
    script: progPath,
    wait: 2,
    grow: .5
  });
}

if (process.platform === 'linux') {
/*
  var Sudoer = require('electron-sudo').default;
  let options = {name: 'TRIGGERcmd Agent'};
  var sudoer = new Sudoer(options);
*/

  var sudo = require('sudo-prompt');
  var options = {
    name: 'TRIGGERcmd Agent'
    // icns: '/Applications/Electron.app/Contents/Resources/Electron.icns', // (optional)
  };
}

var doQuit = false;

var squirreltimeout = 1000;
// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  app.quit();
}

var agent = require('./agent');

var tokenfile;
var tokenFromFile;
var computeridfile;
var computeridFromFile;
var datafile;
var datapath;

agent.initFiles(null, function (tfile, cidfile, dfile, dpath) {
  tokenfile = tfile;
  computeridfile = cidfile;
  datafile = dfile;
  datapath = dpath;
  tokenFromFile = readMyFile(tokenfile);
  computeridFromFile = readMyFile(computeridfile);
});

var log_file = fs.createWriteStream(datapath + '/debug.log', {flags : 'w'});
log_file.on('error', function(err) {
  console.log("ERROR:" + err);
});

var log_stdout = process.stdout;
console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

const iconPath = path.join(__dirname, 'icon.png');
let appIcon = null;
let mainWindow;
let editorWindow;
var appWindow, exampleWindow;

var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
  // console.log('User ran triggercmdagent.');
  return true;
});

if (shouldQuit) {
  // console.log('Agent is already running, quiting this instance soon.');
  doQuit = true;
  setTimeout(app.quit, squirreltimeout+ 1000);
//   return;
}

app.on('ready', function(){
  var pap = require("posix-argv-parser");
  var args = pap.create();
  var v = pap.validators;

  // Errors and quits unless you allow the squirrel parameters.
  args.createOption(["--squirrel-install", "--squirrel-updated", "--removeShortcut", "--squirrel-obsolete", "--squirrel-uninstall", "--createShortcut", "--squirrel-firstrun"], {
    description: "Internal use only - for the squirrel installer.",
    hasValue: false
  });
  args.createOption(["--shortcut-locations"], {
    description: "Internal use only - for the squirrel installer.",
    hasValue: true
  });

  args.createOption(["-t", "--trigger", "--command"], {
    description: "Trigger name on the remote computer",
    hasValue: true
  });

  args.createOption(["-c", "--computer"], {
      description: "Remote computer name on TRIGGERcmd site",
      hasValue: true
  });

  args.createOption(["--help", "-h"], { description: "Show this text" });

  // Hack for Electron - process.defaultApp is undefined if it's running packaged.
  // console.log(process.defaultApp);
  var n;
  if (typeof process.defaultApp == 'undefined') {
    n = 1;
  } else {
    n = 2;
  }
  // console.log(n);

  args.parse(process.argv.slice(n), function (errors, options) {
    if (errors) { 
      if (!errors[0].includes("psn")) {
        console.log(errors[0]);
        doQuit = true;
        app.quit();
        // return console.log(errors[0])
      }; 

      appIcon = new Tray(iconPath);

      if (!tokenFromFile) {
        console.log('First time run after download.  No token exists.  Login to request one.');
        createWindow();
      } else {
        agent.computerExists(tokenFromFile, computeridFromFile, function(exists) {
          if (exists) {
            agent.foreground(tokenFromFile,null,computeridFromFile);
            startTrayIcon();
          } else {
            createWindow();
          }
        });
      }      
    } else {
 
      if (options["-h"].isSet) {
          args.options.forEach(function (opt) {
            console.log(opt.signature + ": " + opt.description);
            doQuit = true;
            app.quit();
          });
      } else {
        if (options["--trigger"].isSet && options["--computer"].isSet) {
          options["--trigger"].value
          var computername = options["--computer"].value;
          var triggername = options["--trigger"].value;
          console.log('computer: ' + computername + '  trigger: ' + triggername);
          agent.triggerCmd(tokenFromFile,computername,triggername, function (message) {
            console.log(message);
            doQuit = true;
            app.quit();
          });
        } else {  // not trying to run a remote command so run the agent.

          // Not the first run after download, so add a Login item if on a mac.  
          // I put this here so it doesn't run during the first run after download because it was adding a second Login item if the user already had one.   
          if (process.platform === 'darwin') {
            function isDirSync(aPath) {
              try {
                return fs.statSync(aPath).isDirectory();
              } catch (e) {
                if (e.code === 'ENOENT') {
                  return false;
                } else {
                  throw e;
                }
              }
            }
          
            var macappPath = '/Applications/TRIGGERcmdAgent.app'
          
            if (isDirSync(macappPath)) {
              var AutoLaunch = require('auto-launch'); 
              var AutoLauncher = new AutoLaunch({
                  name: 'TRIGGERcmd Agent',
                  path: macappPath,
              });
              AutoLauncher.enable();   
            }
          }

          appIcon = new Tray(iconPath);

          if (!tokenFromFile) {
            console.log('No token exists.  Login to request one.');
            createWindow();
          } else {
            agent.computerExists(tokenFromFile, computeridFromFile, function(exists) {
              if (exists) {
                agent.foreground(tokenFromFile,null,computeridFromFile);
                startTrayIcon();
              } else {
                createWindow();
              }
            });
          }
        }
      }
    }
  });

  appWindow = new BrowserWindow({    
    show: false,
    width: 900,
    height: 700
  }); //appWindow

  exampleWindow = new BrowserWindow({    
    show: false
  }); //exampleWindow  

});

app.on('window-all-closed', app.quit);

app.on("before-quit", (event) => {
  if (doQuit) {    
    console.log("Quitting")    
  } else {
    console.log("Don't quit yet");
    event.preventDefault();
  }
});

function openEditor() {
  editorWindow = new BrowserWindow({width: 800, height: 600, icon: __dirname + '/icon.png'});
  editorWindow.setMenu(null);
  // and load the index.html of the editor.
  editorWindow.loadURL('file://' + __dirname + '/editorindex.html');
  // Emitted when the window is closed.
  editorWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    editorWindow = null;
  });
}

function toggleWindow(whichWindow) {
  if (whichWindow.isVisible()) {
    whichWindow.hide();
  } else {
    whichWindow.show();
  }
}

function openguiEditor() {
  agent.fetchexamples();
  
  // Paste from /app/main.js, but change this line: 
  //    this line: appWindow.loadURL('file://' + __dirname + '/index.html');
  //    to this:   appWindow.loadURL('file://' + __dirname + '/../app/index.html');
  // and this line:  exampleWindow.loadURL('file://' + __dirname + '/examples.html');
  //       to this:  exampleWindow.loadURL('file://' + __dirname + '/../app/examples.html');

  appWindow.loadURL('file://' + __dirname + '/../app/index.html');

/*  appWindow.once('ready-to-show', function() {
    appWindow.show();
  }); //ready-to-show
*/
  appWindow.show();

  appWindow.on('close', function (event) {
    exampleWindow.hide();
    appWindow.hide();
    event.preventDefault();
  })
  
  exampleWindow.loadURL('file://' + __dirname + '/../app/examples.html');

  exampleWindow.on('close', function (event) {
    exampleWindow.hide();
    event.preventDefault();
  })  

  ipc.on('exampleAdded', function(event, arg){
    // console.log('exampleAdded received by main.js')
    event.returnValue='';
    appWindow.webContents.send('reloadCommands', 'Reloading commands');    
  }); //closeexampleWindow 

  ipc.on('openexampleWindow', function(event, arg){
    event.returnValue='';
    exampleWindow.show();
  }); //closeexampleWindow

  ipc.on('closeexampleWindow', function(event, arg){
    event.returnValue='';
    exampleWindow.hide();
  }); //closeexampleWindow

  myAppMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(myAppMenu);
}

var menuTemplate = [
  {
    label: 'TRIGGERcmd',
    submenu: [
      {
        role: 'help',
        label: 'Website',
        click() { electron.shell.openExternal('http://www.triggercmd.com')}
      },        
    ]
  },{
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload()
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        },
        {type: 'separator'},
        {role: 'resetzoom'},
        {role: 'zoomin'},
        {role: 'zoomout'},
        {type: 'separator'},
        {role: 'togglefullscreen'}
      ]
    },
    {
      label: "Edit",
      submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]
    }
];


function readMyFile(file) {
  try {
    return fs.readFileSync(file).toString();
  }
  catch (e) {
    return null;
  }
}

function createWindow() {
    handleSubmission();
    // mainWindow = new BrowserWindow({ title: 'TRIGGERcmd Agent Sign In', width: 700, height: 390, titleBarStyle: 'hidden', icon: __dirname + '/icon.png' });
    mainWindow = new BrowserWindow({ title: 'TRIGGERcmd Agent Sign In', width: 700, height: 390, icon: __dirname + '/icon.png' });
    
    // mainWindow.toggleDevTools();
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    myAppMenu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(myAppMenu);
    
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        doQuit = true;
        app.quit();
        mainWindow = null;
    });
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('did-finish-load');
    });
}

function submissionFunction() {
  console.log('Submitted...');
  tokenFromFile = readMyFile(tokenfile);
  if (tokenFromFile) {
    console.log('Token file exists now.  Closing login window and starting tray icon.');
    startTrayIcon();
    mainWindow.hide();
  }
}

function handleSubmission() {
    ipcMain.on('did-submit-form', (event, argument) => {
        var { token } = argument;
        token = token.trim();
        console.log('Attempting to log in with token ' + token);

        // agent.getToken(email,password,submissionFunction);
        agent.tokenLogin(token,function (token) {
          console.log('handleSubmission token ' + token)
          if (token) {
            agent.createComputer(token,null, function (computerid) {
              if (computerid == 'MustSubscribe') {
                mainWindow.loadURL(`file://${__dirname}/subscribefirst.html`);
              } else {
                agent.foreground(token,null,computerid);
                startTrayIcon();
                mainWindow.hide();
              }              
            });
          }
        });
    });
}

function startTrayIcon () {
  appIcon.setToolTip('TRIGGERcmd');
  appIcon.setContextMenu(contextMenu);
}

function installService () {
  console.log('Installing background service.');
  if (process.platform === 'win32') {
    console.log('Installing service.');
    var homedir = (process.platform === 'win32') ? process.env.HOMEPATH : process.env.HOME;
    var cmd = 'node svcmgr --install ' + homedir;
    wincmd.elevate(cmd,function(error, stdout, stderr){
      if (error !== null) {
          console.log('Service install error: ' + error);
      }
      console.log(stdout);
      console.log(stderr);
    });
  }
  if (process.platform === 'linux') {
    console.log('Installing daemon.');
    var cmd = '/bin/sh ' + __dirname + '/daemonmgr.sh --add ' + datapath;
    console.log('Running: ' + cmd);
    sudo.exec(cmd, options, function(error, stdout, stderr) {});
  }
}

function addToPath() {
  console.log('Adding to path.');
  if (process.platform === 'win32') {
    // console.log('Installing service.');
    var i = 250;
    if (__dirname.includes('\\resources\\app\\src')){
      i = __dirname.indexOf('\\resources\\app\\src')
    }
    var exepath = __dirname.substring(0,i);
    console.log(exepath);
    var cmd = 'node winpath --add ' + exepath;
    wincmd.elevate(cmd,function(error, stdout, stderr){
      if (error !== null) {
          console.log('Path update error: ' + error);
      }
      console.log(stdout);
      console.log(stderr);
    });
  }
}

function removeFromPath() {
  console.log('Removing from path.');
  if (process.platform === 'win32') {
    // console.log('Installing service.');
    var i = 250;
    if (__dirname.includes('\\resources\\app\\src')){
      i = __dirname.indexOf('\\resources\\app\\src')
    }
    var exepath = __dirname.substring(0,i);

    var cmd = 'node winpath --remove ' + exepath;
    wincmd.elevate(cmd,function(error, stdout, stderr){
      if (error !== null) {
          console.log('Path update error: ' + error);
      }
      console.log(stdout);
      console.log(stderr);
    });
  }
}


function startService () {
    console.log('Starting background service.');
    svc.start();
}

function removeService () {
  console.log('Removing background service.');
  if (process.platform === 'win32') {
    wincmd.elevate('node svcmgr --remove',function(error, stdout, stderr){
      if (error !== null) {
          console.log('Service remove error: ' + error);
      }
      console.log(stdout);
      console.log(stderr);
    });
  }
  if (process.platform === 'linux') {
    console.log('Removing daemon.');
    var cmd = '/bin/sh ' + __dirname + '/daemonmgr.sh --remove';
    console.log('Running: ' + cmd);
    sudo.exec(cmd, options, function(error, stdout, stderr) {});
  }
}

function stopService () {
  console.log('Stopping background service.');
  svc.stop();
}

function launchComputerList(){
  var clWindow;
  clWindow = new BrowserWindow();
  clWindow.loadURL('https://www.triggercmd.com/user/auth/login');
}

if (process.platform === 'linux') {
  var contextMenu = Menu.buildFromTemplate([
    {
      label: 'TRIGGERcmd.com',
      click: function() {
        console.log('Launching online computer list.');
        shell.openExternal('https://www.triggercmd.com/user/computer/list');
        // launchComputerList();  <- don't use this because it closes the app when the window closes.
      }
    },
    {
      label: 'Background Service',
      submenu: [
        {
          label: 'Install Background Service',
          click: function() {
            console.log('Installing background service');
            installService();
          }
        },
        {
          label: 'Remove Background Service',
          click: function() {
            console.log('Removing background service');
            removeService();
          }
        },
      ]
    },
    {
      label: 'Text Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening commands.json');        
        openEditor();        
      }
    },
    {
      label: 'GUI Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening GUI editor');
        openguiEditor();
      }
    },
    { label: 'Quit',
      selector: 'terminate:',
      click: function() {
        doQuit = true;
        app.exit(0);
      }
    }
  ]);
} else if (process.platform === 'win32') {
  var contextMenu = Menu.buildFromTemplate([
    {
      label: 'TRIGGERcmd.com',
      click: function() {
        console.log('Launching online computer list.');
        shell.openExternal('https://www.triggercmd.com/user/computer/list');
      }
    },
    {
      label: 'Update Agent',
      click: function() {
        console.log('Updating the TRIGGERcmd agent');
        updateAgent();
      }
    },    
    {
      label: 'Background Service',
      submenu: [
        {
          label: 'Install Background Service',
          click: function() {
            console.log('Installing background service');
            installService();
          }
        },
        {
          label: 'Remove Background Service',
          click: function() {
            console.log('Removing background service');
            removeService();
          }
        },
      ]
    },
    {
      label: 'System PATH',
      submenu: [
        {
          label: 'Add to system PATH',
          click: function() {
            console.log('Add to path selected.');
            addToPath();
          }
        },
        {
          label: 'Remove from system PATH',
          click: function() {
            console.log('Remove from path selected.');
            removeFromPath();
          }
        },
      ]
    },
    {
      label: 'Text Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening commands.json');
        openEditor();
      }
    },
    {
      label: 'GUI Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening GUI editor');
        openguiEditor();
      }
    },
    { label: 'Quit',
      selector: 'terminate:',
      click: function() {
        doQuit = true;
        app.exit(0);
      }
    }
  ]);
} else {
  var contextMenu = Menu.buildFromTemplate([
    {
      label: 'TRIGGERcmd.com',
      click: function() {
        console.log('Launching online computer list.');
        shell.openExternal('https://www.triggercmd.com/user/computer/list');
      }
    },
    {
      label: 'Text Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening commands.json');
        openEditor();
      }
    },
    {
      label: 'GUI Command Editor',
      // accelerator: 'Alt+Command+N',
      click: function() {
        console.log('Opening GUI editor');
        openguiEditor();
      }
    },
    { label: 'Quit',
      selector: 'terminate:',
      click: function() {
        doQuit = true;
        app.exit(0);
      }
    }
  ]);
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  // const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));

  // log.auditSuccess(updateDotExe);

  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];

  
  /* 
  var homedir = (process.platform === 'win32') ? process.env.HOMEPATH : process.env.HOME;
  var sqlog_file = fs.createWriteStream(homedir + '/' + squirrelEvent + '.log', {flags : 'w'});
  function sqlog (d) { //
    sqlog_file.write(util.format(d) + '\n');
  }; 

  sqlog(process.argv);
  sqlog('exeName ' + exeName);
  sqlog('squirrelEvent ' + squirrelEvent);
  sqlog('updateDotExe ' + updateDotExe);
  sqlog('rootAtomFolder ' + rootAtomFolder);
  sqlog('appFolder ' + appFolder);  */
  
  console.log('squirrelEvent ' + squirrelEvent);


  switch (squirrelEvent) {
    case '--squirrel-updated':
    case '--squirrel-install':
    
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName, '--shortcut-locations=Desktop,Startup,StartMenu']);
      // addToPath();

      setTimeout(app.quit, squirreltimeout);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Russ:      
      var cmd = path.resolve(__dirname, 'cleanup.bat');      
      ChildProcess.spawn(cmd, [], {detached: true});

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName, '--shortcut-locations=Desktop,Startup,StartMenu']);

      setTimeout(app.quit, squirreltimeout);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated
      var cmd = path.resolve(__dirname, 'cleanup.bat');      
      ChildProcess.spawn(cmd, [], {detached: true});

      setTimeout(app.quit, squirreltimeout);
      return true;
  }
};

function updateAgent() {
    // Remove current background service.
    var cmd = path.resolve(__dirname, 'cleanup.bat');
    ChildProcess.spawn(cmd, [], {detached: true});    

    var messagecmd = path.resolve(__dirname, 'winupgrademessage.bat');
    ChildProcess.spawn(messagecmd, [], {detached: true}); 

    var file = path.join(datapath, 'TRIGGERcmdAgentSetup.exe')
    download('http://s3.amazonaws.com/triggercmdagents/TRIGGERcmdAgentSetup.exe', file, function (err) {
      if (err) { 
        console.log(err)
      } else {
        var installer = path.join(datapath, 'TRIGGERcmdAgentSetup.exe');
        console.log(installer);
        ChildProcess.spawn(installer, [], {detached: true});
      }
    });
}

var download = function(url, dest, cb) {
    var file = fs.createWriteStream(dest);
    var request = http.get(url, function(response) {

        // check if response is success
        if (response.statusCode !== 200) {
            return cb('Response status was ' + response.statusCode);
        }

        response.pipe(file);

        file.on('finish', function() {
            file.close(cb);  // close() is async, call cb after close completes.
        });
    });

    // check for request error too
    request.on('error', function (err) {
        fs.unlink(dest);
        return cb(err.message);
    });

    file.on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result) 
        return cb(err.message);
    });
};