
<h1 align="center">
  <br>
  VS Code - Elements for Chromium Browsers
  <br>
</h1>

<h4 align="center">Show the browser's Elements tool inside the VSCode editor and use it to fix styling, layout, and CSS issues with your site.</h4>

A VS Code extension that allows you to use the browser's Elements tool from within the editor. The Elements tool will connect to an instance of a Chromium browser (Chrome, Edge, Brave, Opera, etc) giving you the ability to see the runtime HTML structure, alter layout, and fix styling issues. All without leaving VS Code.

![Elements for Chromium - Demo](demo.gif)

**Supported Features**
* Debug configurations for launching the browser in remote-debugging mode and auto attaching the tools,
* Side Bar view for listing all the debuggable targets, including tabs, extensions, service workers, etc.
* Fully featured Elements tool with views for HTML, CSS, accessibility and more.
* Screen-casting feature to allow you to see your page without leaving VSCode.

# Using the Extension
## Getting Started
For use inside VS Code:

1. Make sure you have installed a Chromium browser
1. Install the extension
1. Open the folder containing the project you want to work on

## Using the tools
The extension operates in two modes - it can launch an instance of Chromium navigated to your app, or it can attach to a running instance of Chromium. Both modes requires you to be serving your web application from local web server, which is started from either a VS Code task or from your command-line. Using the `url` parameter you simply tell VS Code which URL to either open or launch in the browser.

### Debug Configuration
You can launch the Elements for Chromium extension like you would a debugger, by using a `launch.json` config file. However, Elements for Chromium isn't a debugger and so any breakpoints set in VS Code won't be hit, you can of course use a different debug extension instead and attach the Elements for Chromium extension once debugging has started.

To add a new debug configuration, in your `launch.json` add a new debug config with the following parameters:

* `type` - The name of the debugger which must be `vscode-chromium-devtools.debug.` **Required.**
* `request` - `launch` to open a new browser tab or `attach` to connect to an existing tab. **Required.**
* `name` - A friendly name to show in the VS Code UI. **Required.**
* `url` - The url for the new tab or of the existing tab. **Optional.**
* `file` - The local file path for the new tab or of the existing tab. **Optional.**

```
{
    "version": "0.1.0",
    "configurations": [
        {
            "type": "vscode-chromium-devtools.debug",
            "request": "launch",
            "name": "Launch Chromium and open the Elements tool",
            "file": "${workspaceFolder}/index.html"
        },
        {
            "type": "vscode-chromium-devtools.debug",
            "request": "attach",
            "name": "Attach to Chromium and open the Elements tool",
            "url": "http://localhost:8000/"
        }
    ]
}
```

### Launching the browser via the side bar view
* Start Chromium via the side bar
  * Click the `Elements for Chromium` view in the side bar.
  * Click the `Open a new tab` icon to launch the browser (if it isn't open yet) and open a new tab.
* Attach the Elements tool via the side bar view
  * Click the `Attach` icon next to the tab to open the Elements tool.

### Launching the browser manually
* Start Chromium with remote-debugging enabled on port 9222:
  * `$browser --remote-debugging-port=9222`
  * Navigate the browser to the desired URL.
* Attach the Elements tool via a command:
  * Run the command `Elements for Chromium: Attach to a target`
  * Select a target from the drop down.
