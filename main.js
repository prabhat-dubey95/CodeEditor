const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const fs = require("fs");
const path = require('path');
const os = require("os");
let mainWindow;

const projectRoot = path.join(os.homedir(), ".CodeEditor");

if (!fs.existsSync(projectRoot)) {
    fs.mkdirSync(projectRoot, { recursive: true });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile("codeEditor.html");

const template = [
  {
    label: "File",

    submenu: [

      {
        label: "New File",
        accelerator: "Ctrl+N",

        click: () => {

          console.log("New File menu clicked");

          mainWindow.webContents.executeJavaScript(`

            if (window.editorInstance) {

              window.editorInstance.createUntitledTab();

            } else {

              console.error(
                "editorInstance not found"
              );

            }

          `);

        }
      },


      {
        label: "New Folder",
        accelerator: "Ctrl+Shift+N",

        click: async () => {

          const result =
            await dialog.showSaveDialog(
              mainWindow,
              {
                title: "Create New Folder",

                defaultPath:
                  path.join(
                    projectRoot,
                    "New Folder"
                  ),

                buttonLabel:
                  "Create Folder",

                properties: [
                  "createDirectory"
                ]
              }
            );


          if (result.canceled) {
            return;
          }


          try {

            fs.mkdirSync(
              result.filePath,
              {
                recursive: true
              }
            );


            console.log(
              "Folder Created:",
              result.filePath
            );


            mainWindow.webContents
              .executeJavaScript(`

                if (window.editorInstance) {

                  window.editorInstance
                    .loadProjects();

                }

              `);

          }
          catch (err) {

            console.error(
              "Create Folder Error:",
              err
            );

          }

        }
      },


      {
        type: "separator"
      },


      {
        label: "Logout",

        click: () => {

          mainWindow.webContents
            .executeJavaScript(`

              localStorage.removeItem(
                "isLoggedIn"
              );

              localStorage.removeItem(
                "userData"
              );

              location.reload();

            `);

        }

      },


      {
        type: "separator"
      },


      {
        role: "quit"
      }

    ]

  },


  {
    role: "editMenu"
  },

  {
    role: "viewMenu"
  },

  {
    role: "windowMenu"
  }

];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
console.log("Main.js loaded");

ipcMain.handle("saveFile", async (event, data) => {
    try {
        let filePath = data.filePath;

if (!filePath) {
    const result = await dialog.showSaveDialog({
        defaultPath: path.join(
            projectRoot,
            data.defaultName || "untitled.js"
        )
    });

    if (result.canceled) {
        return {
            success: false,
            canceled: true
        };
    }

    filePath = result.filePath;
}

        fs.writeFileSync(filePath, data.content, "utf8");

        return {
            success: true,
            filePath,
            fileName: path.basename(filePath)
        };

    } catch (err) {

        console.error(err);

        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle("getProjects", async () => {

    try {

        if (!fs.existsSync(projectRoot)) {

            fs.mkdirSync(
                projectRoot,
                {
                    recursive: true
                }
            );

        }


        function readFolder(folder) {

            if (!fs.existsSync(folder)) {
                return [];
            }


            return fs
                .readdirSync(
                    folder,
                    {
                        withFileTypes: true
                    }
                )
                .sort(function (a, b) {

                    // Folder first
                    if (
                        a.isDirectory() &&
                        !b.isDirectory()
                    ) {
                        return -1;
                    }


                    if (
                        !a.isDirectory() &&
                        b.isDirectory()
                    ) {
                        return 1;
                    }


                    return a.name.localeCompare(
                        b.name
                    );

                })
                .map(function (item) {

                    var fullPath =
                        path.join(
                            folder,
                            item.name
                        );


                    if (item.isDirectory()) {

                        return {

                            type: "folder",

                            name: item.name,

                            path: fullPath,

                            children:
                                readFolder(
                                    fullPath
                                )

                        };

                    }


                    return {

                        type: "file",

                        name: item.name,

                        path: fullPath

                    };

                });

        }


        return {

            success: true,

            root: projectRoot,

            items:
                readFolder(
                    projectRoot
                )

        };

    }
    catch (err) {

        console.error(
            "getProjects Error:",
            err
        );


        return {

            success: false,

            error: err.message

        };

    }

});


ipcMain.handle(
    "readProjectFile",
    async function (event, filePath) {

        try {

            if (!filePath) {

                return {

                    success: false,

                    error: "File path is required."

                };

            }


            if (!fs.existsSync(filePath)) {

                return {

                    success: false,

                    error: "File not found."

                };

            }


            var stat =
                fs.statSync(
                    filePath
                );


            if (!stat.isFile()) {

                return {

                    success: false,

                    error: "Selected path is not a file."

                };

            }


            var content =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );


            return {

                success: true,

                content: content

            };

        }
        catch (err) {

            console.error(
                "readProjectFile Error:",
                err
            );


            return {

                success: false,

                error: err.message

            };

        }

    }
);


ipcMain.handle("createProjectFolder",async function (event, folderPath) {
    try {
        if (!folderPath) {
            return {
                success: false,
                error: "Folder path is required."
            };
        }

        fs.mkdirSync(folderPath, {
            recursive: true
        });
        return {
            success: true,
            path: folderPath
        };

    }
    catch (err) {
        console.error("createProjectFolder Error:",err);
        return {
            success: false,
            error: err.message
        };
    }
});


ipcMain.handle("createProjectFile",async function (event, filePath) {
    try {
        if (!filePath) {
            return {
                success: false,
                error: "File path is required."
            };
        }
        var parentFolder = path.dirname(filePath);
        if (!fs.existsSync(parentFolder)) {

            fs.mkdirSync(parentFolder,{
                recursive: true
            });
        }

        if (fs.existsSync(filePath)) {
            return {
                success: false,
                error: "File already exists."
            };
        }

        fs.writeFileSync(filePath,"","utf8");

        return {
            success: true,
            path: filePath,
            fileName:
            path.basename(filePath)
        };

    }
    catch (err) {
        console.error("createProjectFile Error:",err);
        return {
            success: false,
            error: err.message
        };
    }
});
ipcMain.handle("deleteProjectFile",async function (event, filePath) {
    try {
        if (!filePath) {
            return {
                success: false,
                error: "File path is required."
            };
        }

        if (!fs.existsSync(filePath)) {
            return {
                success: false,
                error: "File not found."
            };
        }

        var stat = fs.statSync(filePath);

        if (!stat.isFile()) {
            return {
                success: false,
                error: "Selected path is not a file."
            };
        }
        fs.unlinkSync(filePath);
        console.log("Project file deleted:",filePath);
        return {
            success: true,
            path: filePath
        };

    } catch (err) {
        console.error("deleteProjectFile Error:",err);
        return {
            success: false,
            error: err.message
        };
    }
});
ipcMain.handle("fileExists",async function (event, filePath) {
    try {
        if (!filePath) {
            return false;
        }
        return fs.existsSync(filePath);

    }
    catch (err) {
        console.error("fileExists Error:",err);
        return false;

    }
});

app.whenReady().then(() => {
  // Configure session to accept cookies
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Credentials': ['true']
      }
    });
  });

  // Enable third-party cookies
  session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
    console.log('Cookie event:', cause, removed ? 'removed' : 'added', cookie.name);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

