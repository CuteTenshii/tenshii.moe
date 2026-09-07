---
title: "Rebuilding Paradise Bay's server so I could play it again"
description: "King shut Paradise Bay down in 2018. The server list turned out to be plain JSON sitting inside the Windows package, so I wrote my own server in Go and spent three months writing perfectly valid zlib the wrong way."
pubDate: 2026-09-07
---

Paradise Bay was an island game King and Z2 released in 2015. You harvested goods, traded them with passing boats, and slowly turned a beach into a village. I played it a lot. In 2018 King discontinued it and took the servers down, and that was that: the client still installs, it just cannot get past the point where it needs a server.

I wanted to play it again. So I gave it someone to talk to.

The result is [paradise-bay-server](https://github.com/CuteTenshii/paradise-bay-server), a Go reimplementation of enough of the backend to get an island running. The [first commit](https://github.com/CuteTenshii/paradise-bay-server/commit/4d4da33) is from December 2025. The one called [`feat: IT WORKS`](https://github.com/CuteTenshii/paradise-bay-server/commit/5527ecc) is from March 26th, 2026. Most of this post is about that gap.

Three things made the project possible at all, and King shipped every one of them: the server list sits in a plain JSON file, the release build still has its logging turned on, and the client keeps its own save data and will hand it to whoever answers the phone. I had to work for the rest. Those three I was given.

## The file that made this possible at all

Paradise Bay was on the Microsoft Store, which is lucky, because a Store package is a zip file you are allowed to open. You can pull it from [store.rg-adguard.net](https://store.rg-adguard.net/) by ProductId (`9nblggh5l706`), and the file you want is `king.com.ParadiseBay_3.9.0.0_x86__kgqvnymyfvs32.appx`.

Inside, next to the game data, is `game-info.json`. And in it, unobfuscated, uncompiled, not even minified:

```
http://tk1-win.z2live.com/
```

No certificate pinning to defeat, no server list compiled into the binary, nothing to patch in a hex editor. Just a URL in a JSON array. Replace it with `http://localhost:3300` and the game will happily ask my machine where to connect. The package signature covers that file, but a signature you can simply delete is not much of an obstacle, as the next section gets into.

That is the first of the three. Half the reverse engineering work on this project was done by King's own build system.

## Getting a patched client to install

I work on Linux and Paradise Bay is a Windows Store app, so the client half of this lives in a Windows VM the whole way through, with the Go server on the host. That setup needs the `zp://` URI further down to point at the VMware network address rather than `127.0.0.1`. Everything below assumes the arrangement the installer ships instead, where the server runs on the same Windows machine as the game, because that is the one other people are going to use.

Editing the package means the signature no longer matches, so you cannot install it normally. The path that works:

1. Extract the appx to a folder.
2. Delete `AppxSignature.p7x`.
3. Turn on Developer Mode in Windows settings.
4. `Add-AppxPackage -Register .\AppxManifest.xml` to register the app straight from that folder, no repacking.

Two things bit me here. The first is silly: whatever extracts the appx leaves `%20` in filenames, so `bundle\data` ends up full of files the game cannot find. The installer script renames them back.

The second one took a real detour. The game registered fine, launched fine, and could not reach my server. UWP apps are sandboxed away from loopback, so `localhost` is a black hole for them. My first attempt was to patch `AppxManifest.xml` and add the `privateNetworkClientServer` capability, which sounds right and does nothing for this. The actual answer is a one-liner that exempts the package from network isolation:

```powershell
CheckNetIsolation LoopbackExempt -a -n="king.com.ParadiseBay_kgqvnymyfvs32"
```

Four days between [shipping the wrong fix](https://github.com/CuteTenshii/paradise-bay-server/commit/0bd653c) and [replacing it](https://github.com/CuteTenshii/paradise-bay-server/commit/5b4d42a).

## What the game actually says

There are two channels. The HTTP one is trivial. The client asks `/api/game_servers/available` and expects a list of servers, each pointing at a socket with a custom scheme:

```json
[{ "game_server": { "uri": "zp://127.0.0.1:3301/" } }]
```

That is the entire discovery protocol. Everything else happens on that TCP socket.

Framing inside the socket is a seven-character ASCII decimal length followed by that many bytes of JSON. `0000123{"cmd":...}`. Fixed width, so a message can be at most 9,999,999 bytes, which nobody was ever going to hit.

The messages themselves are small and flat:

```json
{ "cmd": "heartbeat", "data": null, "req": 41, "res": 96, "ses": "session" }
```

`req` and `res` are two independent sequence counters, and I had them backwards until March. My original code had a single counter called `nextReq` that it wrote into the `req` field of everything it sent, and no `res` field at all. That is inside out. `req` belongs to the client: it tags a request, and you echo the same value back so it knows which reply is which. `res` is your own counter, which you increment on every message you send, including the ones nobody asked for. Two directions, two sequences, and only after [splitting the incoming and outgoing message structs](https://github.com/CuteTenshii/paradise-bay-server/commit/ee8e922) into separate types did any of it line up.

`ses` looks like the important one and is not: it is a per-frame cookie the client echoes back and never validates, so the literal string `"session"` is a perfectly good implementation of it.

While I am confessing: the first version kept its counter and its transaction map in package-level variables shared by every connection, guarded by one mutex. It worked because there was exactly one player. Both are per-connection locals now.

## King left the logging on

The release build still logs. Whatever the reason, the last version King shipped to the Store was not built with its logging stripped, so attaching Visual Studio 2022 to the running app gets you the game narrating itself into the output window.

![Visual Studio 2022 with Paradise Bay running in a floating window, showing a beach, a turtle and the caption "Give Skippy the turtle a net". Behind it, a terminal prints the Go server's heartbeat traffic, and Visual Studio's output pane prints ZPSocketChannel timer lines.](/img/paradise-bay-debugging.webp)

*Everything at once: the game, the Go server logging heartbeats in the terminal on the left, and `ZPSocketChannel` narrating its own response timer in the output pane at the bottom. The clock reads March 26th, so this is the day of `IT WORKS`.*

That log is worth more than it sounds. Reverse engineering a protocol with no feedback means staring at a stuck loading screen and guessing which of your last forty changes caused it. The log answers the two questions that actually unblock you: did the login succeed, and what is this thing called. `resumeSessionCookie` is a name I got from the log rather than from any amount of squinting at the binary.

That is the second of the three things King handed me, and it is the one I would least like to give back.

## The Lua layer underneath

Most of the game logic is not in the executable. The `.dat` files in the package are Lua bytecode, which [luadec](https://github.com/viruscamp/luadec) turns back into something readable, and the readable version is where the real protocol lives. The C++ side is mostly plumbing: the class you care about is `ZPSocketChannel`, the one printing those timer lines in the screenshot, which I read in Binary Ninja and attached to with its DBGENG plugin whenever the decompiled Lua left me guessing.

The Lua layer has its own envelope riding inside the transport. A message with `cmd: "luaSessionMessage"` carries a `data` object whose `type` field is the real command: `sessionConfiguration`, `transactionAccepted`, `requestDocumentsResponse`, `commandSucceeded`. Two protocols stacked, and only the outer one is visible in the C++.

## Guessing the connect payload out of Pseudo-C

The connect response came out of Binary Ninja's Pseudo-C view, which is a rough way to learn a JSON structure. The object is not a struct you can look at; it is assembled through a chain of accessor calls, so what the decompiler shows you is a scattering of string constants and lookups, and you have to infer the shape around them. I was pasting chunks of that output into Perplexity to help me make sense of it at the time.

Between that and the log I ended up with a good list of field names and no sense of which ones mattered, so I sent all of them and filled the values with whatever seemed plausible. Here is a composite of the things my server was sending over that winter, drawn from [December](https://github.com/CuteTenshii/paradise-bay-server/commit/15428d0) and [January](https://github.com/CuteTenshii/paradise-bay-server/commit/775e75b#diff-5bbc0182584739004c6ad9b1479cfd3dd1c31e43db4bf8a51da3045f4ff2228d):

```go
"resumeSessionCookie": "8d0ed094-4f5c-417e-bd29-489ce818e570",
"uit":                 "8d0ed094-4f5c-417e-bd29-489ce818e570",
"bundleID":            "king.com.ParadiseBay",
"allowsFastConnect":     true,
"fastConnectIsPossible": true,
"fastConnectDataResponse": map[string]interface{}{},
"sessionConfig": map[string]interface{}{
	"adsUseProductionUnits": false,
	"serverTimeDelta":       0,
	"accountName":           "accountName",
},
```

None of it was read by anything. What `onConnectResponse` actually needs is `cid`, `kid`, a `loginResponse`, `connectResponseData`, and a `sessionConfig` carrying a server timestamp. Every field in the block above was eventually deleted and nothing missed any of them. Once I could follow the function properly rather than guess at it, most of my progress consisted of removing code. It is a strange feeling to make a protocol work by deleting things.

## Two more things from the guessing era

The same instinct produced [my favourite bad idea in the repo](https://github.com/CuteTenshii/paradise-bay-server/commit/775e75b#diff-5bbc0182584739004c6ad9b1479cfd3dd1c31e43db4bf8a51da3045f4ff2228d). `validateOnDemandFiles` sends the server a map of filenames to SHA1 hashes, and I decided the server should answer with hashes too, so I sent back the SHA1 of each filename:

```go
files[name] = fmt.Sprintf("%x", sha1.Sum([]byte(name)))
```

Which is a real hash of the wrong thing. The response is not hashes at all: it is a map of filename to download URL, and an empty string means "this file is fine, do not download anything". Every value should have been `""`. I had written a checksum for a string nobody had ever hashed.

And until the end of March, every player was the same person. The UUID `8d0ed094-4f5c-417e-bd29-489ce818e570` was a literal in the connect payload, and by March `bestAlias` was hardcoded to my own name. [SQLite landed](https://github.com/CuteTenshii/paradise-bay-server/commit/4b0653a#diff-ac94c91f8ea84762d55b6932ef1466a2165984591d3e646360c5bb31b2130900) the same day as `IT WORKS`, and players [stopped being a constant](https://github.com/CuteTenshii/paradise-bay-server/commit/f66ae11#diff-5bbc0182584739004c6ad9b1479cfd3dd1c31e43db4bf8a51da3045f4ff2228d) the day after that, when `resolvePlayer` started looking accounts up by `cid`, falling back to the device id, and creating a row when it had never seen either.

## Three months of writing valid zlib the wrong way

Everything above is what I did between December and late March. Here is why almost none of it moved the project forward.

The socket traffic is zlib compressed. Reading was never the problem, and from the very first commit the server did the obvious thing:

```go
zlibReader, err := zlib.NewReader(conn)
decoder := json.NewDecoder(zlibReader)
```

One reader wrapping the connection, decoding messages out of it forever. That works, because the client opens a single zlib stream when it connects and writes every message of the entire session into that one stream.

Writing did the other obvious thing, and the asymmetry is exactly what hid the bug for three months:

```go
// The version that shipped from December to March.
func writeFrame(conn net.Conn, jsonBytes []byte) error {
	var zlibBuf bytes.Buffer
	zlibWriter := zlib.NewWriter(&zlibBuf)
	zlibWriter.Write([]byte(fmt.Sprintf("%07d", len(jsonBytes))))
	zlibWriter.Write(jsonBytes)
	zlibWriter.Close()
	_, err := conn.Write(zlibBuf.Bytes())
	return err
}
```

Every message got its own complete, self-contained, entirely valid zlib stream. Compress, close, send. If you had captured a single frame and inspected it you would have found nothing wrong with it, which is the annoying part: there was no malformed byte to find. The client's decompressor reads the first stream, hits its end marker, and has no reason to expect a fresh zlib header behind it. Message one arrives. Nothing after it does.

Which explains the shape of that whole winter. The connect response is the first thing the server sends, so it always got through, and it was the only thing that ever got through. That is why three months of commits are almost entirely about one message, why I was tuning invented fields in a payload nobody rejected, and why the log could tell me the login succeeded and nothing after it. I was polishing the only thing the client could still hear.

The fix is structural, not a bug fix in the usual sense. Hoist the writer to the lifetime of the connection, and flush instead of closing:

```go
// One continuous zlib stream for writing. MUST NOT close until connection ends.
zlibWriter := zlib.NewWriter(conn)
defer zlibWriter.Close()
```

```go
func writeFrame(w *zlib.Writer, jsonBytes []byte) error {
	fmt.Fprintf(w, "%07d", len(jsonBytes))
	w.Write(jsonBytes)
	return w.Flush() // Z_SYNC_FLUSH, so the client can read it now
}
```

`Flush` is the load-bearing call. It writes a sync point so the client can decompress everything received so far without the stream being finalised. `Close` would finalise it, which is what I was doing, once per message, for three months.

That change is in the commit named [`feat: IT WORKS`](https://github.com/CuteTenshii/paradise-bay-server/commit/5527ecc#diff-5bbc0182584739004c6ad9b1479cfd3dd1c31e43db4bf8a51da3045f4ff2228d). I stand by the commit message.

## The client already has your save file

Here is the third thing King left open, and the one that shaped everything after March.

Paradise Bay is optimistic. The client applies your action immediately, then sends a transaction describing what it did and waits to be told the server agrees. The server does not simulate your island, and it does not know how long anything takes to grow. It gets an `executeTransaction` with a facade name, a method name, some arguments, and a set of hashes, and its job is to say yes.

Better still, `sessionConfiguration` has a flag called `sendClientBlobsWithTransaction`. Turn it on, and every transaction arrives with the client's own serialised state attached, in the `verifyHashes` entries, as JSON. The client hands you its save file, fragment by fragment, unprompted.

So my server is essentially a key-value store with opinions. It writes each blob into SQLite keyed by things like `GamePlayer:storage:P[uuid]`, and when the client reconnects and asks for its documents back, it reads them out again. All the game logic stays where King put it, on the client.

Getting blobs *back* into the client took two corrections, though, because a document fragment is not just a bag of JSON.

The first: my code answered every fragment request with `{}`. An empty object is valid JSON and completely useless here, because the client deserialises these blobs into typed Lua objects and every one carries a `_t` tag saying what it is. The game ships its own offline placeholders for exactly this situation, so I mirrored those shapes instead:

```go
"VIRTUAL_PlayerCurrency": `{"currencyBalances":{...},"_t":"VirtualPlayerCurrency:v1"}`,
"VIRTUAL_PlayerInfo":     `{"bestAlias":"...","_t":"VirtualPlayerInfo:v1"}`,
```

That placeholder is also where the 150,000 gems in the screenshot come from. I did not earn those.

The second is a naming trap. `requestDocuments` and `requestDocumentFragments` look like the same call with different words, and they are not. The keys in `requestDocuments` have two parts, `docType:documentId`, and they are a *prefix*: the real fragment key has a third segment in the middle. I was echoing those two-part keys straight back as `documentFragmentId` values, producing ids that were malformed by exactly one segment, which the client's parser did not enjoy. The fix is to treat the request as a [prefix query](https://github.com/CuteTenshii/paradise-bay-server/commit/4b0653a#diff-ac94c91f8ea84762d55b6932ef1466a2165984591d3e646360c5bb31b2130900), look up every stored fragment matching `docType:*:documentId`, and return those.

## The reconnect loop

Later on, once real transactions were flowing, the client would connect, play for about twenty seconds, drop, reconnect, and do it again forever. The server log looked healthy. Every transaction was being accepted.

The problem is that `transactionAccepted` is an unsolicited Lua message. It has no `req`, because in the transport's eyes it is not a reply to anything. But the client had sent a `luas` request and started a `ResponseTimeoutTimer` on it, and only a message carrying the matching `req` clears that pending request. So the Lua layer was perfectly happy while the transport layer sat there watching a request go unanswered, and after roughly twenty seconds it declared the connection dead and forced a reconnect, which replayed `startPlaySession`, which sent another transaction, which timed out again.

That timer is visible in the screenshot further up, bottom of the Visual Studio output pane, months before it caused me any trouble: `startResponseTimer: (1376E3B0:session) isSuspended=0, timeout=20000`.

The fix is [one extra message](https://github.com/CuteTenshii/paradise-bay-server/commit/21d306b): send the Lua response, then also ack the `luas` request by `req`, so both layers agree the exchange finished.

Two independently sequenced layers are unreadable without tracing, so there is now a [`PB_TRACE=1` env var](https://github.com/CuteTenshii/paradise-bay-server/commit/6d0bd6c) that logs every incoming `cmd/req/ack` and every outgoing `cmd/res` with its Lua type.

## Keani asks your name and waits forever

The last real blocker was a dialog that never opened. Early in the game a character called Keani asks what you want to be called, and on my server that moment just did not happen.

It turned out there is a third message type I had not implemented. Normal gameplay uses `executeTransaction`, but a facade marked `serverOnly` (invoked in Lua as `.txn.serverOnly:method()`) goes out as `executeCommand` instead, and the client blocks until it receives a `commandSucceeded` Lua message with a matching `commandId` and a `result` field. My server did not answer, so the client waited, and the dialog never opened. [Two commands](https://github.com/CuteTenshii/paradise-bay-server/commit/8aca9c7#diff-5bbc0182584739004c6ad9b1479cfd3dd1c31e43db4bf8a51da3045f4ff2228d) drive the naming flow: `getAliases` to open it, `setGameAlias` to submit.

Now every unknown `executeCommand` gets acked with a literal `"null"` result, so nothing can ever block on a command I have not implemented yet.

There was one last detail I got backwards. My first version always returned a `gameAlias` in `getAliases`, and the text box came up pre-filled with a name the player never chose. The client uses the presence of that field to decide whether you have already named yourself, so the server has to leave it out entirely until you have:

```go
aliases := map[string]interface{}{"bestAlias": alias}
if gameAlias != "" {
	aliases["gameAlias"] = gameAlias
}
```

Absence is the signal. Empty string is not.

## What still does not work

The friends list is a stub. In-app purchases return an empty product list, which is at least thematically correct for a game with no store behind it. Facebook account linking is understood but not implemented, because making it work needs client patching and I decided I was not interested enough.

And some things are gone for good. Anything the client used to download from King's CDN is not coming back. I have the last shipped package and nothing else, so whatever assets lived on their servers stay lost, and no amount of protocol work fixes that.

The rest of it runs. A URL in a config file, a release build that still talks to its debugger, and a client that carries its own save data: none of that was left there for me, and all of it is why a discontinued game boots in 2026. My island lives in a SQLite file on my own machine now, with the game in its Windows VM talking to a Go process on my Linux host, and King has nothing to do with it.

The code is at [github.com/CuteTenshii/paradise-bay-server](https://github.com/CuteTenshii/paradise-bay-server) if you want to bring yours back too.
