// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Allow unused variables in the mocks to have leading underscore
// tslint:disable: variable-name

import { createFakeExtensionContext, createFakeGet, createFakeVSCode, Mocked } from "./test/helpers";
import { IRemoteTargetJson } from "./utils";

jest.mock("vscode", () => null, { virtual: true });

describe("utils", () => {
    let utils: typeof import("./utils");
    let mockGetHttp: jest.Mock;
    let mockGetHttps: jest.Mock;

    beforeEach(async () => {
        jest.doMock("http");
        jest.doMock("https");
        jest.doMock("vscode", () => createFakeVSCode(), { virtual: true });
        jest.resetModules();

        mockGetHttp = jest.requireMock("http").get;
        mockGetHttps = jest.requireMock("https").get;

        utils = await import("./utils");
    });

    describe("fixRemoteWebSocket", () => {
        it("replaces address and port correctly", async () => {
            const target = {
                webSocketDebuggerUrl: "ws://127.0.0.1:1000/devtools/page/ABC",
            } as IRemoteTargetJson;

            const expectedHostName = "machine";
            const expectedPort = 8080;
            const fixed = utils.fixRemoteWebSocket(expectedHostName, expectedPort, target);
            expect(fixed.webSocketDebuggerUrl).toBe(`ws://${expectedHostName}:${expectedPort}/devtools/page/ABC`);
        });

        it("replaces no port with the specified port correctly", async () => {
            const target = {
                webSocketDebuggerUrl: "ws://localhost/devtools/page/DEF",
            } as IRemoteTargetJson;

            const expectedHostName = "remote";
            const expectedPort = 8081;
            const fixed = utils.fixRemoteWebSocket(expectedHostName, expectedPort, target);
            expect(fixed.webSocketDebuggerUrl).toBe(`ws://${expectedHostName}:${expectedPort}/devtools/page/DEF`);
        });

        it("makes no changes to invalid websocket url", async () => {
            const expectedWSUrl = "unknown websocket";
            const target = {
                webSocketDebuggerUrl: expectedWSUrl,
            } as IRemoteTargetJson;

            const fixed = utils.fixRemoteWebSocket("localhost", 9222, target);
            expect(fixed.webSocketDebuggerUrl).toBe(expectedWSUrl);
        });
    });

    describe("fetchUri", () => {
        beforeEach(() => {
            mockGetHttp.mockClear();
            mockGetHttps.mockClear();
        });

        it("uses 'get' response object correctly for chunking", async () => {
            const fake = createFakeGet(() => "[]", () => 200);
            mockGetHttp.mockImplementation(fake.get);

            await utils.fetchUri("http://somedomain.com/json/list");
            expect(fake.on).toHaveBeenNthCalledWith(1, "data", expect.any(Function));
            expect(fake.on).toHaveBeenNthCalledWith(2, "end", expect.any(Function));
        });

        it("requests http url correctly", async () => {
            const expectedHttpResponse = "[{},{}]";
            mockGetHttp.mockImplementation(
                createFakeGet(() => expectedHttpResponse, () => 200).get);

            const response = await utils.fetchUri("http://fake-http-url.test/json/list");
            expect(response).toBe(expectedHttpResponse);
        });

        it("requests https url correctly", async () => {
            const expectedHttpsResponse = "[{}]";
            mockGetHttps.mockImplementation(
                createFakeGet(() => expectedHttpsResponse, () => 200).get);

            const response = await utils.fetchUri("https://fake-https-url.test/json/list");
            expect(response).toBe(expectedHttpsResponse);
        });

        it("rejects 'get' errors correctly", async () => {
            let onErrorCallback: ((e: string) => void) | undefined;

            // Setup the get mock so that we store the on("error") callback
            const httpGetMock = mockGetHttp;
            const mockOnReturn = jest.fn((_name, callback) => {
                onErrorCallback = callback;
            });
            httpGetMock.mockImplementationOnce((_options: object, _callback: (resp: object) => void) => {
                return {
                    on: mockOnReturn,
                };
            });

            // Call the fetchUri api and handle the rejection so that debugging won't stop on an
            // unhandled exception
            let promiseRejectCount = 0;
            const responsePromise = utils.fetchUri("http://fake-http-url.test/json/list").catch((e) => {
                promiseRejectCount++;
                return Promise.reject(e);
            });

            // Trigger the error callback to simulate an http get error
            const expectedErrorReason = "some error";
            expect(onErrorCallback).toBeDefined();
            onErrorCallback!(expectedErrorReason);

            // Ensure that the fetchUri call rejects with the expected reason
            await expect(responsePromise).rejects.toBe(expectedErrorReason);
            expect(promiseRejectCount).toEqual(1);
            expect(mockOnReturn).toBeCalledWith("error", expect.any(Function));
        });

        it("rejects 'statusCode' errors correctly", async () => {
            let onEndCallback: ((e: string) => void) | undefined;

            // Setup the get mock so that we store the on("end") callback
            const expectedResponse = "";
            const getOnMock = jest.fn()
                .mockImplementationOnce((_name, onCallback) => {
                    onCallback(expectedResponse);
                }).mockImplementationOnce((_name, onCallback) => {
                    onEndCallback = onCallback;
                });
            const fake = createFakeGet(
                () => expectedResponse,
                () => 404,
                getOnMock,
            );
            const httpGetMock = mockGetHttp;
            httpGetMock.mockImplementation(fake.get);

            // Call the fetchUri api and handle the rejection so that debugging won't stop on an
            // unhandled exception
            const responsePromise = utils.fetchUri("http://fake-http-url/json/list").catch((e) => {
                return Promise.reject(e);
            });

            // Trigger the end callback to simulate an status code of fakeStatusCode 404
            expect(onEndCallback).toBeDefined();
            onEndCallback!(expectedResponse);

            // Ensure that the fetchUri call rejects with the current response
            await expect(responsePromise).rejects.toThrow(expectedResponse);
        });
    });

    describe("getListOfTargets", () => {
        let expectedListResponse = "";

        beforeEach(() => {
            mockGetHttp.mockClear();
            mockGetHttp.mockImplementation(
                createFakeGet(() => expectedListResponse, () => 200).get);

            mockGetHttps.mockClear();
            mockGetHttps.mockImplementation(
                createFakeGet(() => expectedListResponse, () => 200).get);
        });

        it("returns a parsed json result", async () => {
            const expectedTargets = [{ title: "1" }, { title: "2" }];
            expectedListResponse = JSON.stringify(expectedTargets);

            const targets = await utils.getListOfTargets(
                utils.SETTINGS_DEFAULT_HOSTNAME,
                utils.SETTINGS_DEFAULT_PORT,
                utils.SETTINGS_DEFAULT_USE_HTTPS);
            expect(targets).toEqual(expect.arrayContaining(expectedTargets));
        });

        it("returns empty array for bad json", async () => {
            expectedListResponse = "Error: 404";

            const targets = await utils.getListOfTargets(
                utils.SETTINGS_DEFAULT_HOSTNAME,
                utils.SETTINGS_DEFAULT_PORT,
                utils.SETTINGS_DEFAULT_USE_HTTPS);
            expect(targets).toEqual([]);
        });

        it("uses correct remote address", async () => {
            const expectedHostName = "127.0.0.1";
            const expectedPort = 8080;
            const httpGetMock = mockGetHttp;

            await utils.getListOfTargets(expectedHostName, expectedPort, utils.SETTINGS_DEFAULT_USE_HTTPS);
            expect(httpGetMock).toHaveBeenCalledWith(expect.objectContaining({
                hostname: expectedHostName,
                port: "" + expectedPort,
            }), expect.any(Function));
        });

        it("uses correct protocol", async () => {
            const httpsGetMock = mockGetHttps;
            const httpGetMock = mockGetHttp;

            // HTTPS
            await utils.getListOfTargets(
                utils.SETTINGS_DEFAULT_HOSTNAME,
                utils.SETTINGS_DEFAULT_PORT,
                /* useHttps = */ true);
            expect(httpsGetMock).toHaveBeenCalledWith(expect.objectContaining({
                protocol: "https:",
            }), expect.any(Function));

            // HTTP
            await utils.getListOfTargets(
                utils.SETTINGS_DEFAULT_HOSTNAME,
                utils.SETTINGS_DEFAULT_PORT,
                /* useHttps = */ false);
            expect(httpGetMock).toHaveBeenCalledWith(expect.objectContaining({
                protocol: "http:",
            }), expect.any(Function));
        });

        it("retries with alternative endpoint if the first one fails", async () => {
            const expectedTargets = [{ title: "1" }];
            expectedListResponse = JSON.stringify(expectedTargets);

            // Setup the get mock so that we fail the first get but succeed on subsequent ones
            const httpGetMock = mockGetHttp;
            httpGetMock.mockClear();

            const mockOn = jest.fn()
                .mockImplementationOnce((_name, callback) => {
                    setTimeout(() => callback("error"), 0); // Async to allow the await to work
                }).mockImplementationOnce((_name, onCallback) => {
                    onCallback(expectedListResponse);
                }).mockImplementationOnce((_name, onCallback) => {
                    onCallback();
                });

            httpGetMock.mockImplementationOnce((_options: object, callback: (resp: object) => void) => {
                return {
                    on: mockOn,
                };
            }).mockImplementationOnce((_options: object, callback: (resp: object) => void) => {
                const resp = {
                    on: mockOn,
                    statusCode: 200,
                };
                callback(resp);
                return {
                    on: jest.fn(),
                };
            });

            // Ensure that calling getListOfTargets ends up calling both json endpoints
            const targets = await utils.getListOfTargets(
                utils.SETTINGS_DEFAULT_HOSTNAME,
                utils.SETTINGS_DEFAULT_PORT,
                utils.SETTINGS_DEFAULT_USE_HTTPS);
            expect(targets).toEqual(expect.arrayContaining(expectedTargets));
            expect(httpGetMock)
                .toHaveBeenNthCalledWith(1, expect.objectContaining({ path: "/json/list" }), expect.any(Function));
            expect(httpGetMock)
                .toHaveBeenNthCalledWith(2, expect.objectContaining({ path: "/json" }), expect.any(Function));
        });
    });

    describe("getRemoteEndpointSettings", () => {
        it("returns the stored settings", async () => {
            const expected = {
                defaultUrl: "url",
                hostname: "someHost",
                port: 9999,
                useHttps: true,
                userDataDirectory: "default",
            };

            // Override the configuration mock to return our custom test values
            const configMock = {
                get: (name: string) => (expected as any)[name],
            };
            const vscodeMock = await jest.requireMock("vscode");
            vscodeMock.workspace.getConfiguration.mockImplementationOnce(() => configMock);

            // Ensure the new values are returned
            const { hostname, port, useHttps, defaultUrl, userDataDir } = utils.getRemoteEndpointSettings();
            expect(hostname).toBe(expected.hostname);
            expect(port).toBe(expected.port);
            expect(useHttps).toBe(expected.useHttps);
            expect(defaultUrl).toBe(expected.defaultUrl);
            expect(userDataDir).toBe(expected.userDataDirectory);
            expect(vscodeMock.workspace.getConfiguration).toBeCalledWith(utils.SETTINGS_STORE_NAME);
        });

        it("uses user config", async () => {
            const config = {
                hostname: "someHost",
                port: 9999,
                url: "url",
                useHttps: true,
                userDataDirectory: "default",
            };

            const { hostname, port, useHttps, defaultUrl, userDataDir } = utils.getRemoteEndpointSettings(config);
            expect(hostname).toBe(config.hostname);
            expect(port).toBe(config.port);
            expect(useHttps).toBe(config.useHttps);
            expect(defaultUrl).toBe(config.url);
            expect(userDataDir).toBe(config.userDataDirectory);
        });

        it("uses correct fallbacks on failure", async () => {
            const { hostname, port, useHttps, defaultUrl, userDataDir } = utils.getRemoteEndpointSettings();
            expect(hostname).toBe(utils.SETTINGS_DEFAULT_HOSTNAME);
            expect(port).toBe(utils.SETTINGS_DEFAULT_PORT);
            expect(useHttps).toBe(utils.SETTINGS_DEFAULT_USE_HTTPS);
            expect(defaultUrl).toBe(utils.SETTINGS_DEFAULT_URL);
            expect(userDataDir).toBe(utils.SETTINGS_DEFAULT_USER_DATA_DIR);
        });
    });

    describe("createTelemetryReporter", () => {
        const mockReporter = {};
        beforeEach(async () => {
            jest.doMock("../package.json", () => ({}), { virtual: true });
            jest.doMock("./debugTelemetryReporter", () => function debug() { return mockReporter; });
            jest.resetModules();

            utils = await import("./utils");
        });

        it("returns a debug version when no package info in debug env", async () => {
            jest.doMock("../package.json", () => null, { virtual: true });
            jest.resetModules();

            const mockContext = createFakeExtensionContext();
            const reporter = utils.createTelemetryReporter(mockContext);
            expect(reporter).toBeDefined();
            expect(reporter).toEqual(mockReporter);
        });

        it("returns a debug version when valid package in debug env", async () => {
            const mockContext = createFakeExtensionContext();
            const reporter = utils.createTelemetryReporter(mockContext);
            expect(reporter).toBeDefined();
            expect(reporter).toEqual(mockReporter);
        });

        it("returns a retail version when valid package in retail env", async () => {
            const retailReporter = {};
            jest.doMock("vscode-extension-telemetry", () => function retail() { return retailReporter; });
            jest.resetModules();
            jest.requireMock("vscode").env.machineId = "12345";

            utils = await import("./utils");

            const mockContext = createFakeExtensionContext();
            const reporter = utils.createTelemetryReporter(mockContext);
            expect(reporter).toBeDefined();
            expect(reporter).toEqual(retailReporter);
        });
    });

    describe("getPlatform", () => {
        it("returns the correct platform", async () => {
            jest.doMock("os");
            jest.resetModules();
            utils = await import("./utils");

            const os: Mocked<typeof import("os")> = jest.requireMock("os");
            os.platform.mockReturnValue("darwin");
            expect(utils.getPlatform()).toEqual("OSX");

            os.platform.mockReturnValue("win32");
            expect(utils.getPlatform()).toEqual("Windows");

            os.platform.mockReturnValue("linux");
            expect(utils.getPlatform()).toEqual("Linux");

            os.platform.mockReturnValue("openbsd");
            expect(utils.getPlatform()).toEqual("Linux");
        });
    });

    describe("getBrowserPath", () => {
        let fse: Mocked<typeof import("fs-extra")>;
        let os: Mocked<typeof import("os")>;

        beforeEach(async () => {
            jest.doMock("fs-extra");
            jest.doMock("os");
            jest.resetModules();
            utils = await import("./utils");

            fse = jest.requireMock("fs-extra");
            os = jest.requireMock("os");

            // Mock that the path always exists
            fse.pathExists.mockImplementation(() => Promise.resolve(true));

            // Mock no path in settings
            const configMock = {
                get: (name: string) => "",
            };
            const vscodeMock = await jest.requireMock("vscode");
            vscodeMock.workspace.getConfiguration.mockImplementation(() => configMock);
        });

        it("returns the custom path or empty string", async () => {
            const config = {
                browserPath: "someCustomPath.exe",
            };

            // Ensure we get a valid path back
            fse.pathExists.mockImplementation(() => Promise.resolve(true));
            expect(await utils.getBrowserPath(config)).toEqual(config.browserPath);

            // Ensure we get "" on bad path
            fse.pathExists.mockImplementation(() => Promise.resolve(false));
            expect(await utils.getBrowserPath(config)).toEqual("");
        });

        it("returns the settings path", async () => {
            const expectedPath = "someCustomPath.exe";
            const configMock = {
                get: (name: string) => expectedPath,
            };
            const vscodeMock = await jest.requireMock("vscode");
            vscodeMock.workspace.getConfiguration.mockImplementationOnce(() => configMock);

            expect(await utils.getBrowserPath()).toEqual(expectedPath);
        });

        it("searches for path", async () => {
            // Check Windows
            global.process.env.LOCALAPPDATA = "";
            os.platform.mockReturnValue("win32");
            fse.pathExists.mockImplementation(() => {
                return Promise.resolve(fse.pathExists.mock.calls.length === 8);
            });
            expect(await utils.getBrowserPath()).toEqual(expect.stringMatching(/.+msedge.exe/g));

            fse.pathExists.mockClear();

            // Check OSX
            os.platform.mockReturnValue("darwin");
            fse.pathExists.mockImplementation(() => {
                return Promise.resolve(fse.pathExists.mock.calls.length === 4);
            });
            expect(await utils.getBrowserPath()).toEqual(expect.stringMatching(/.+Microsoft Edge Canary/g));

            fse.pathExists.mockClear();

            // Check Linux
            os.platform.mockReturnValue("linux");
            fse.pathExists.mockImplementation(() => Promise.resolve(false));
            expect(await utils.getBrowserPath()).toEqual("");
        });
    });

    describe("launchBrowser", () => {
        it("spawns the process", async () => {
            jest.doMock("child_process");
            jest.resetModules();
            utils = await import("./utils");

            const cp = jest.requireMock("child_process");
            cp.spawn.mockReturnValue({
                unref: jest.fn(),
            });

            const expectedPath = "somePath";
            const expectedPort = 9222;
            const expectedUrl = "http://example.com";
            const expectedUserDataDir = "profile";
            utils.launchBrowser(expectedPath, expectedPort, expectedUrl, expectedUserDataDir);

            expect(cp.spawn).toHaveBeenCalledWith(
                expectedPath,
                expect.arrayContaining([
                    `--user-data-dir=${expectedUserDataDir}`,
                    `--remote-debugging-port=${expectedPort}`,
                    expectedUrl]),
                expect.any(Object));

            utils.launchBrowser(expectedPath, expectedPort, expectedUrl);
            expect(cp.spawn).toHaveBeenCalledWith(
                expectedPath,
                expect.arrayContaining([
                    `--remote-debugging-port=${expectedPort}`,
                    expectedUrl]),
                expect.any(Object));
        });
    });

    describe("openNewTab", () => {
        it("uses endpoint to request tab", async () => {
            const expectedTarget = { title: "1" };
            const expectedListResponse = JSON.stringify(expectedTarget);

            mockGetHttp.mockClear();
            mockGetHttp.mockImplementation(
                createFakeGet(() => expectedListResponse, () => 200).get);

            const expectedHost = "localhost";
            const expectedPort = 9222;
            const expectedUrl = "http://www.bing.com";
            const target = await utils.openNewTab(expectedHost, expectedPort, expectedUrl);
            expect(target).toEqual(expectedTarget);
        });

        it("returns undefined on an exception", async () => {
            mockGetHttp.mockClear();
            mockGetHttp.mockImplementation(
                createFakeGet(() => { throw new Error(); }, () => 200).get);

            const target = await utils.openNewTab("localhost", 8080);
            expect(target).toBeUndefined();
        });
    });

    describe("removeTrailingSlash", () => {
        it("returns a string without a trailing slash", async () => {
            expect(utils.removeTrailingSlash("hello/")).toEqual("hello");
            expect(utils.removeTrailingSlash("hello//")).toEqual("hello/");
            expect(utils.removeTrailingSlash("/")).toEqual("");
        });

        it("does nothing to strings without a trailing slash", async () => {
            expect(utils.removeTrailingSlash("hello")).toEqual("hello");
            expect(utils.removeTrailingSlash("hello\\")).toEqual("hello\\");
            expect(utils.removeTrailingSlash("")).toEqual("");
        });
    });
});
