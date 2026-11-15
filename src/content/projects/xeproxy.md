XeProxy is a DashLaunch plugin for modded Xbox 360 consoles (JTAG/RGH). It hooks the `NetDll_*` exports of `xam.xex`, the XNet and Winsock layer that every title and the dashboard go through, so the console's traffic can be sent somewhere other than Xbox Live. Where it goes is decided by an ini file the plugin re-reads whenever it changes: one build, no addresses baked into the xex.

It is tested on the latest dashboard, 17559. There are no prebuilt releases yet, so you [build the xex](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/building.md) yourself with the XDK.

## What it can do

- **Answer DNS itself:** `*.xboxlive.com = 192.168.1.50`, without asking a resolver.
- **Rewrite destinations** by address, CIDR block or port, for TCP and UDP, and undo the rewrite on replies so the title sees the address it asked for.
- **Tunnel through a proxy:** HTTP [`CONNECT`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/CONNECT) ([mitmproxy](https://mitmproxy.org)'s default mode) or [SOCKS5](https://en.wikipedia.org/wiki/SOCKS), done inside the hooked `connect()`, for blocking and non-blocking sockets alike.
- **Rewrite XHttp:** the server name and port passed to `XHttpConnect`, which some Live services use.
- **Force `XNetStartup` flags**, mainly `XNET_STARTUP_BYPASS_SECURITY`, so traffic isn't wrapped in Xbox Live's secure layer.
- **Drop traffic**, keep LAN destinations out of every rule, and log one line per intercepted call.

With mitmproxy running on a PC and `* = proxy` in the ini, every TCP connection the console makes shows up in mitmproxy, with XHttp's HTTPS decrypted. The [configuration docs](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/configuration.md) cover other setups and every section of the ini.

## How it works

At boot, the plugin resolves each export from xam by ordinal and detours it: four PowerPC instructions at the function's entry jump to the hook, and the instructions they replaced are moved into a trampoline that jumps back. Before installing anything, it checks that its trampoline memory is really executable by running two instructions out of it. The XDK has no intrinsic for `icbi`, the instruction needed to clear the instruction cache after patching code, so the plugin assembles its own small cache-flush routine by hand. When no rule matches, a hook calls the original function unchanged, and calls made by xbdm, the debug monitor, are never touched, so a bad rule can't cut off the connection you'd use to fix it. The [how it works](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/how-it-works.md) page goes further, including how proxy tunnels are set up on non-blocking sockets.

To read the console's HTTPS through a proxy, XHttp has to accept the proxy's certificate. Its certificate check turned out to be little more than a hostname match. The actual blocker is a bug in xam's TLS state machine: after the Certificate message it ends up in a state with no handler for the ServerHelloDone that follows, and the handshake stalls. XeProxy changes one instruction in xam to pick the working state, and only does it if the bytes in memory match the expected build. The [research notes](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/research/cert-trust/NOTES.md) have the traces and addresses behind it.

## Limits

Proxy tunnels carry TCP only, although UDP can still be redirected to a fixed address. Turning on all 23 hooks froze a console after a few minutes, while the default nine have stayed stable. The [limits page](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/limits.md) lists the rest, and [troubleshooting](https://git.tenshii.moe/Tenshii/XeProxy/src/branch/master/docs/troubleshooting.md) covers a missing log, a console that hangs, and what each log message means.

The build recipe for a DashLaunch plugin follows [dclstn/Xbox360AutoDNS](https://github.com/dclstn/Xbox360AutoDNS), and the export ordinals come from [Xenia](https://xenia.jp)'s xam table.
