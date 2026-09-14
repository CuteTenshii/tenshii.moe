---
title: "How I reversed guns.lol's profile views"
description: "Every guns.lol profile view has to solve a WebAssembly proof-of-work before it counts. This is how that challenge works, and how I reversed it through every format change guns.lol shipped between September 2025 and July 2026."
pubDate: 2026-09-14
---

guns.lol is a bio link site. You get a page at `guns.lol/yourname`, and the page shows how many times it has been viewed. That number is not a plain counter. Before a browser is allowed to record a view, it has to solve a proof-of-work challenge in WebAssembly inside a web worker, solve a Cloudflare Turnstile challenge on top of that, and send both answers back in an obfuscated payload.

I wanted to know how that worked. The result is [guns-solver](https://github.com/CuteTenshii/guns-solver), a Go program that records a view with no browser involved. The short version:

| Date | What happened |
| --- | --- |
| September 25, 2025 | [First commit](https://github.com/CuteTenshii/guns-solver/commit/4ff3725): `wasm2c` output and a hand-written Go solver |
| September 27, 2025 | All five static `__hcm` hashes matched, the result value still unknown |
| December 20, 2025 | guns.lol ships a new solver and payload format |
| January 5, 2026 | Research files updated, project put down |
| March 16, 2026 | [`feat: it works now`](https://github.com/CuteTenshii/guns-solver/commit/0d75772), with guns.lol's own binary running under wazero |
| April 10 and 26, 2026 | Random noise inserted into the seal |
| July 14, 2026 | guns.lol regenerates the wasm-bindgen glue |
| July 24, 2026 | The proof-of-work module starts rotating |

Two Cloudflare protections sit on top of the proof-of-work: a Turnstile widget on the profile page, whose token goes into the payload, and a Managed Challenge on the current analytics endpoint, which answers any request without a `cf_clearance` cookie with a 403. The tool hands both to a captcha solving service, and neither is what this post is about.

## What a view costs

Through every version I have looked at, the flow has kept the same shape:

1. The profile page ships with the challenge embedded in it: a challenge string, a nonce, a timestamp and a difficulty.
2. A script on the page starts a web worker, which loads a Rust crate compiled to WebAssembly with [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen).
3. The worker hands the challenge to a `GunsSolver` object and calls its solve method.
4. The page takes the result, adds a Turnstile token, and POSTs everything to an analytics endpoint.

This is the worker as it appeared inline in profile pages in September 2025:

```js
import init, { GunsSolver } from 'https://assets.guns.lol/pkg/_gunslolpow.js';
self.onmessage = async function (event) {
    const { ps, d, c, _n, org_ts } = event.data;
    await init();
    const _get_s = new GunsSolver(ps, c, parseInt(d), false, _n);
    const ts = Math.floor(Date.now() / 1000);
    const _tsoff = ts - Number(org_ts);
    const tsp = ts - _tsoff;
    const _res = await _get_s.solve_pow();
    if (_res !== null) {
        self.postMessage({ _res, ps, tsp, _n, c });
    }
};
```

`ps` is a public salt, `c` the challenge, `d` the difficulty and `_n` the nonce. The timestamp arithmetic cancels itself out: `ts - (ts - org_ts)` is `org_ts` again, so `tsp` is just `org_ts`, the timestamp that came with the challenge.

## September: reading the binary

The obvious plan was to understand the algorithm and rewrite it in Go. The binary was 116 KB. `wasm2wat` turned it into 49,782 lines of text format, and `wasm2c` turned it into 53,656 lines of C. I pulled `gunssolver_new` and `gunssolver_solve_pow` out of the C into their own files and renamed variables until they were something I could read. It was built with Rust 1.85.0 and pulled in `rayon`, `rand_chacha`, `generic-array` and `once_cell`.

[The README from that first commit](https://github.com/CuteTenshii/guns-solver/blob/4ff3725/README.md?plain=1#L5) opened with a plea:

> If you know anything about WASM or C, please help the project by contributing!

**Spoiler:** there was a much simpler way, and it did not involve reading any of those lines.

### The `__hcm` payload

The solver was only half of it. The analytics request carried an object called `__hcm`, and this is what it looked like in [a real request I captured](https://github.com/CuteTenshii/guns-solver/blob/c723e91/assets/request.http):

```json
"__hcm": {
  "ywp26tf5QK": "4253cfedbc28a8730f8f76824692f420a7c652fe986a7cbe57aab4be2743aed5",
  "I8H65VeT": "c864aa4295175a1d9db116812dadad6fbadb7856e973439acd38671f20ef57f5",
  "kJf0eDITy": "f1855b6bcde7a8dd7b4a5e49dcefab44216893142c7e3eef04b99db5cdc5e44e",
  "lYgzwCy6Wh": "e9ebff6bf216860c51cc636be2e4369d04bdbf82a72b1e954d77cb8d171f4938",
  "YrE924fCRj": "95b532111c4b4d07bcd008fb5525eca3ce711dd9eb4d87fe356cf7afb7e26d67",
  "yp6aDpn6": "5-chr",
  "_": "d55a23d0b42c5536992ebee9513c03ede044b6966d05c6c9b53f1cc56cea19a7",
  "__meta": {
    "b6fcfa2cdea7e75": 64,
    "e4e4ee6c3d24319": 64,
    "eacbb24995c6109": 64,
    "cffa1b927d128da": 64,
    "3de5a6b97825303": 5,
    "989c7889dfda718": 64
  },
  "_2": "d2b4d6583c6326cd2a23a210863e305e8d5fba2edcd0ab73f90d87801c7a068f",
  "_s": "db54e"
}
```

[My first README](https://github.com/CuteTenshii/guns-solver/blob/4ff3725/README.md?plain=1#L111-L130) documented that object with all the confidence it deserved:

```jsonc
"_": "sha-256 hash, idk what it's for",
"_2": "another sha-256 hash, idk what it's for either",
"__meta": {
  // the values here never change, they're always 5x "64" and 1x "5"
  "maybe hex?": 64,
  "maybe hex?": 64,
  "maybe hex?": 64,
  "maybe hex?": 64,
  "maybe hex?": 64,
  "maybe hex?": 5,
},
"random string 1": "sha-256 hash of: public salt + challenge",
"random string 2": "sha-256 hash of: idk",
"random string 3": "sha-256 hash of: idk",
"random string 4": "sha-256 hash of: idk",
"random string 5": "sha-256 hash of: idk",
"random string 6": "sha-256 hash of: idk",
```

To make sense of it, I ran the WASM locally over and over with the same salt, challenge and nonce, and sorted what came out into two piles. Some values were static: identical on every run for the same inputs. Others were dynamic and changed every single time. The random-looking key names changed on every solve, but the hashes under them did not. The `__meta` keys changed too, and its values were always five 64s and one 5.

The static hashes turned out to be SHA-256 over concatenations of the inputs. Over [three days](https://github.com/CuteTenshii/guns-solver/compare/4ff3725...c723e91) I [matched all five](https://github.com/CuteTenshii/guns-solver/blob/c723e91/hcm.go#L77-L98):

```go
// val1 - SHA256(wasmResult + challenge)
hash1 := sha256.Sum256([]byte(wasmResult + challenge))
values[0] = hex.EncodeToString(hash1[:])

// val2 - SHA256(publicSalt + challenge)
hash2 := sha256.Sum256([]byte(publicSalt + challenge))
values[1] = hex.EncodeToString(hash2[:])

// val3 - SHA256(nonce + challenge)
hash3 := sha256.Sum256([]byte(nonce + challenge))
values[2] = hex.EncodeToString(hash3[:])

// val4 - SHA256(nonce + publicSalt)
hash4 := sha256.Sum256([]byte(nonce + publicSalt))
values[3] = hex.EncodeToString(hash4[:])

// val5 - SHA256(wasmResult + challenge + publicSalt + nonce)
hash5 := sha256.Sum256([]byte(wasmResult + challenge + publicSalt + nonce))
values[4] = hex.EncodeToString(hash5[:])
```

### The value I could not compute

Two of those five take `wasmResult` as input, and that was the one value I never managed to compute. It is the five-character hex string in `_s`. My Go solver brute-forced SHA-256 over the inputs until the hash met the difficulty, and I did not know what "difficulty 5" meant, so it supported [both readings](https://github.com/CuteTenshii/guns-solver/blob/c723e91/solver.go#L15-L20):

```go
const (
	// LeadingHexNibbles difficulty = number of leading "0" nibbles in hex string.
	LeadingHexNibbles DifficultyMode = iota
	// LeadingZeroBits difficulty = number of leading zero bits in the raw hash.
	LeadingZeroBits
)
```

Neither reading was ever confirmed against a real result. The clearest record of where the project stood is [this line from `main.go`](https://github.com/CuteTenshii/guns-solver/blob/c723e91/main.go#L53-L54) at the time, which throws away the solver's output and uses the `_s` from my captured request instead:

```go
ResultHash:        "db54e", //res.Hash,
TurnstileResponse: "",      // TODO: Implement Turnstile challenge solving
```

### Faking the random parts

The dynamic values went worse. The C code calls `crypto.getRandomValues` and `crypto.randomFillSync`, which fits values that change on every run, so I faked them.

[The code that faked the random key names](https://github.com/CuteTenshii/guns-solver/blob/c723e91/hcm.go#L47-L74) was written by GitHub Copilot, and Copilot had ideas. Each key is a hash of the inputs plus a label:

```go
case 0:
	keyInput = baseSeed + "key_alpha"
case 1:
	keyInput = baseSeed + "key_beta"
case 2:
	keyInput = baseSeed + "key_gamma"
case 3:
	keyInput = baseSeed + "key_delta"
case 4:
	keyInput = baseSeed + "key_epsilon"
```

`baseSeed` is the challenge, salt and nonce glued together, so this produces the same five names every time for the same challenge. The one thing the real key names did was change on every solve. Copilot reached for the Greek alphabet and landed on the single property they did not have.

That was not Copilot's only contribution. Whenever it decided it might be onto something, it generated an HTML file for me to open in a browser and test. None of those made it into a commit, which is probably for the best.

[The stand-in for `_` and `_2`](https://github.com/CuteTenshii/guns-solver/blob/c723e91/hcm.go#L105-L126) hashed the inputs together with the current time and 32 random bytes:

```go
baseInput := challenge + publicSalt + nonce + wasmResult + time.Now().String()
baseHash := sha256.Sum256([]byte(baseInput))
```

And in case `crypto/rand` ever failed:

```go
_, err := rand.Read(randomSalt)
if err != nil {
	// Fallback to time-based generation if crypto/rand fails
	timestamp := time.Now().UnixNano()
	for i := 0; i < 32; i++ {
		randomSalt[i] = byte(timestamp >> (i % 8 * 8))
	}
}
```

The fake randomness had a backup plan. The output is a 64-character hex string, and that is the only thing it has in common with the real one. The `"5-chr"` value got the same treatment: I assumed the 5 was the difficulty and wrote `fmt.Sprintf("%d-chr", difficulty)`.

## December: the format changes

On December 20th, 2025, guns.lol shipped a new solver. [The worker](https://github.com/CuteTenshii/guns-solver/blob/5b85c28/assets/next.js) became:

```js
import init, {GunsSolver} from 'https://assets.guns.lol/wasm/gpp_gunslol.js';

self.onmessage = async function (event) {
    const {_2xa, _org_ts, _n, d, o09} = event.data;
    await init();
    const _get_s = new GunsSolver(o09, parseInt(d), _org_ts, _n, _2xa);
    const ts = Math.floor(Date.now() / 1000);
    const _tsoff = ts - Number(_org_ts);
    const tsp = ts - _tsoff;
    const _res = await _get_s.solve_pow();
    if (_res && _res._oo && _res.seal) {
        self.postMessage({_n, o09, _res, _2xa, tsp});
    }
};
```

The constructor arguments were renamed and reordered, the solve result became an object with `_oo` (the proof) and `seal`, and `__hcm` was gone from the payload entirely. The binary also went from 116 KB to 59 KB. Everything I had worked out in September described a format that no longer existed.

I updated the research files [on January 5th](https://github.com/CuteTenshii/guns-solver/commit/5b85c28). That commit deletes 121,384 lines, nearly all of it the C and WAT output from September. The Go side kept the same brute forcer with the new inputs plugged in, under [field names](https://github.com/CuteTenshii/guns-solver/blob/5b85c28/worker_data.go#L26-L32) that show exactly how well I understood them:

```go
// TODO: find better names
type WorkerData struct {
	Nonce             string
	O09               string
	Underscore2xa     string
	OriginalTimestamp int64
}
```

The `_oo` and `seal` fields were empty strings, which did not matter, because `SubmitSolution` still did not submit anything. It printed the payload between `=== PAYLOAD STRUCTURE ===` banners, and the line that would have sent it was commented out. The commit message ends in `WIP`, and after it I put the project down.

## March: running it instead

In March 2026 I paid for a Claude subscription and picked the project back up. The idea that got it working came from Claude: stop trying to reproduce what the binary computes, and run the binary itself from Go with [wazero](https://github.com/tetratelabs/wazero). Honestly, it was a good idea. Six months earlier, Copilot's contribution had been Greek letters. This time the AI's suggestion was to stop reading the C altogether.

wasm-bindgen is what makes that practical. A Rust crate built for the browser never talks to JavaScript directly. wasm-bindgen generates a JS glue module that sits between the two, and the binary only ever sees the functions that module passes in as imports. For the December build, `gpp_gunslol.js` was 308 lines long and passed in eight functions: create an object, set a property, box a number, box a string, clone a reference, drop a reference, throw, rethrow. Implement those eight in Go and the binary has no way to know it is not in a browser.

### The heap

The one piece of real state in that glue is the heap. WebAssembly can only pass numbers across the boundary, so the glue keeps JavaScript values in an array called `heap` and gives the binary indexes into it. The first slots are reserved: 128 `undefined` entries, followed by `undefined`, `null`, `true` and `false`, which puts the first real object at index 132. Free slots hold the index of the next free slot, so the array doubles as its own free list:

```js
function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}
```

[The Go port](https://github.com/CuteTenshii/guns-solver/blob/0d75772/wasm.go#L22-L57) mirrors it slot for slot:

```go
func (h *jsHeap) add(obj any) int32 {
	if h.freeNext == len(h.objects) {
		h.objects = append(h.objects, len(h.objects)+1)
	}
	idx := h.freeNext
	if next, ok := h.objects[idx].(int); ok {
		h.freeNext = next
	} else {
		h.freeNext = idx + 1
	}
	for len(h.objects) <= idx {
		h.objects = append(h.objects, nil)
	}
	h.objects[idx] = obj
	return int32(idx)
}

func (h *jsHeap) drop(idx int32) {
	if idx < 132 {
		return
	}
	h.objects[idx] = h.freeNext
	h.freeNext = int(idx)
}
```

### The imports

Each import then becomes a few lines of wazero host function. [This one](https://github.com/CuteTenshii/guns-solver/blob/0d75772/wasm.go#L91-L99) is `obj[key] = val`, which the binary uses to build its result object:

```go
hb.NewFunctionBuilder().
	WithGoModuleFunction(api.GoModuleFunc(func(_ context.Context, _ api.Module, stack []uint64) {
		obj := hp.get(api.DecodeI32(stack[0])).(map[string]any)
		key := hp.take(api.DecodeI32(stack[1])).(string)
		val := hp.take(api.DecodeI32(stack[2]))
		obj[key] = val
	}), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, nil).
	Export("__wbg_set_3807d5f0bfc24aa7")
```

### Calling in

Calls in the other direction follow the glue just as closely. A string goes in by calling the binary's exported allocator, writing the bytes into its linear memory, and passing the pointer and length. The constructor takes four strings and the difficulty, which makes nine arguments. The solve method cannot return three values, so the glue moves the WASM stack pointer down 16 bytes and passes that address as a return slot, and the binary writes three 32-bit integers into it: the heap index of the result, the heap index of an error, and a flag saying which one to believe.

```go
mem := mod.Memory()
r0 := int32(binary.LittleEndian.Uint32(readMem(mem, retptr+0, 4)))
r1 := int32(binary.LittleEndian.Uint32(readMem(mem, retptr+4, 4)))
r2 := int32(binary.LittleEndian.Uint32(readMem(mem, retptr+8, 4)))

if r2 != 0 {
	return nil, fmt.Errorf("solve_pow error: %v", hp.take(r1))
}
```

By the time the solve returns, the binary has built its result through the create-object and set-property imports, so `_oo` and `seal` are already sitting in a Go map at heap index `r0`.

I still do not know what the algorithm inside that binary does. After March I did not need to. The commit is called [`feat: it works now`](https://github.com/CuteTenshii/guns-solver/commit/0d75772), and it did.

## April: noise in the seal

The next change came from the page's JavaScript, not the binary. [On April 10th](https://github.com/CuteTenshii/guns-solver/commit/1729608) the submission had to insert one random hex character into the seal, at a position taken from the timestamp, to match what the worker did to it. [Sixteen days later](https://github.com/CuteTenshii/guns-solver/commit/594b7d8) it needed a second one:

```go
insertPos1 := int(payload.Timestamp % 10)
seal := payload.Seal[:insertPos1] + string(hexChars[rand.Intn(16)]) + payload.Seal[insertPos1:]

insertPos2 := 16 + int(payload.Timestamp+int64(payload.Nonce[len(payload.Nonce)-1]))%24
seal = seal[:insertPos2] + string(hexChars[rand.Intn(16)]) + seal[insertPos2:]
```

The inserted characters are random, so they carry no information. The positions come from the timestamp and the character code of the nonce's last character, which are values guns.lol issued in the first place, so the server can find the noise and strip it back out. [The seal in the request I captured](https://github.com/CuteTenshii/guns-solver/blob/594b7d8/assets/request.http#L11) for that commit is **66 characters long**: a 64-character hex string with two passengers. Forwarding the seal exactly as the WASM returned it was the bug both commits fixed.

## July 14th: the glue gets regenerated

guns.lol updated the solver again, and when I [caught up three days later](https://github.com/CuteTenshii/guns-solver/commit/35d4d5d), the parts I had copied by hand out of the glue had moved:

| | December build | July 14th build |
| --- | --- | --- |
| Import module | `wbg` | `./gpp_gunslol_bg.js` |
| Imports | 8 | 7 (`__wbindgen_object_drop_ref` is gone) |
| Boxing a number | `__wbindgen_number_new` | `__wbindgen_cast_0000000000000001` |
| Boxing a string | `__wbindgen_string_new` | `__wbindgen_cast_0000000000000002` |
| Reserved heap slots | 132 (128 `undefined` + 4 constants) | 1028 (1024 `undefined` + 4 constants) |

The heap row is the easy one to miss, because nothing about it shows up in the binary's import list. The new glue's `dropObject` returns early for any index below 1028. Get that number wrong and the Go heap and the binary disagree about which index means `null`.

The payload moved to `/api/analytics/view` with new obfuscated key names, and the seal insertion disappeared from it. The new endpoint is also where the Managed Challenge first shows up: the old `/api/analytics/record` never asked for `cf_clearance`, and a POST to `/api/analytics/view` without one gets a 403 challenge page instead of a recorded view.

## July 24th: the module starts rotating

The embedded binary stopped working. The constructor threw **error code 1003** on every challenge.

guns.lol had moved the solver off `assets.guns.lol` and onto `guns.lol` itself, under `/_challenge/pow/<id>/`, and started rotating it roughly every hour. A rotation replaces some things and leaves others alone:

| Changes on every rotation | Stays the same |
| --- | --- |
| The WASM binary | Host import names |
| Constructor and solve export names | Allocator and stack pointer export names |
| Worker and glue filenames | Constructor argument order |
| The worker's XOR key | Function indices inside the binary (constructor 8, solve 7) |
| The key the constructor checks the seal against | |

Each binary carries a rotation-specific key that the constructor uses to validate the challenge's seal. A binary from an earlier rotation rejects a current seal, and that rejection is 1003. The seal in question is the fifth constructor argument, the value I had named `Underscore2xa` back in January. Fetching the right binary for each challenge is what [the rework](https://github.com/CuteTenshii/guns-solver/commit/84522ef) is about.

### The new challenge format

The challenge itself moved into the Next.js flight payload as `_gpp_ch`, with single-letter keys. This is the fixture from [the parser's test](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/wasm_validate_test.go#L135-L136):

```json
{
  "v": 3,
  "e": "pUYewMGcOW2C5cSCBaiUiQ",
  "u": "/_challenge/pow/pUYewMGcOW2C5cSCBaiUiQ/_a9dee1fa9e512fc3736ee20",
  "t": 1784905110,
  "n": "ms1Wd6PfYqbA9ntoS7rjEceSvNIhgyuN",
  "s": "akAFEQ",
  "c": "62e9a3fa26732e6b8de941ed4eedbddebb6990a328e077d236999e6a3c276c50",
  "d": 5,
  "cd": "62e9a3fa26732e6b8de941ed4eedbddebb6990a328e077d236999e6a3c276c50",
  "a": "guns_view"
}
```

| Key | Meaning |
| --- | --- |
| `v` | Payload schema version (3) |
| `e` | Challenge id, which only changes when the module rotates |
| `u` | Path of the proof-of-work worker |
| `t` | Issue timestamp in unix seconds, passed to the solver as a string |
| `n` | Nonce |
| `s` | Seal, checked by the constructor |
| `c` | 64-character hex challenge |
| `d` | Difficulty |
| `cd` | Turnstile `data-cdata` |
| `a` | Turnstile `data-action` (`guns_view`) |

An embedded binary cannot survive this, so the tool now fetches the worker, then the glue, then the binary, for every challenge it has not seen before.

### Finding the glue

The worker never names the glue module in plain text. Its strings are stored as arrays of numbers XORed with a key and decoded by a helper at runtime, and the real import sits among other encoded strings. The shape, from [the test fixture](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/wasm_validate_test.go#L53-L55):

```js
self[_h([106,107,104,96,118,118,100,98,96],5)]=async function(e){const n=await import(_h([43,42,90,100,103,102],5));}
```

XOR every number with 5 and the first array reads `onmessage` and the second reads `./_abc`. The key changes with each rotation, but it sits right next to the array, so [the decoder](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/pow_module.go#L106-L130) takes every array-and-key pair it finds and keeps the one that decodes to a relative path:

```go
func decodeGlueImport(workerJS string) string {
	for _, m := range xorCallRe.FindAllStringSubmatch(workerJS, -1) {
		key, err := strconv.Atoi(m[2])
		if err != nil {
			continue
		}
		parts := strings.Split(m[1], ",")
		b := make([]byte, 0, len(parts))
		ok := true
		for _, p := range parts {
			n, err := strconv.Atoi(p)
			if err != nil {
				ok = false
				break
			}
			b = append(b, byte(n^key))
		}
		if ok {
			if s := string(b); strings.HasPrefix(s, "./") {
				return s
			}
		}
	}
	return ""
}
```

### Finding the export names

`gunssolver_new` and `gunssolver_solve_pow` became hex names starting with an underscore, different for each rotation. The glue has to call them, though, and [the calls have shapes](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/pow_module.go#L143-L151) the hashing does not touch. The constructor is the only export called with nine arguments. The solve method and the destructor both take two, but only solve passes `this.__wbg_ptr` second; the destructor passes the pointer and a `0`.

```go
for _, m := range glueWasmCallRe.FindAllStringSubmatch(glueJS, -1) {
	args := strings.Split(m[2], ",")
	switch {
	case len(args) == 9:
		ctorExport = m[1]
	case len(args) == 2 && strings.Contains(args[1], "__wbg_ptr"):
		solveExport = m[1]
	}
}
```

With both names recovered, the runtime from March barely changed. It takes the two export names as parameters now instead of constants, and the module is cached on disk under its rotation id, since a module never changes under a given id.

The embedded binary still has a job. guns.lol also answers some profile requests with a 401 interstitial that sets a `guns_clearance` cookie, and that one runs the same kind of proof-of-work with a binary that did not rotate. The file that used to solve views solves that now.

## Proving it matches the browser

The best test in the repo came from a capture. In [the request I recorded](https://github.com/CuteTenshii/guns-solver/blob/35d4d5d/assets/request.http#L12) while catching up with the July 14th update, the browser solved a challenge and sent the proof `YgU5OTM1ZQAAAAAmST5X7i4dUg`. [The test](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/wasm_validate_test.go#L32-L50) feeds the same challenge, timestamp, nonce and seal through wazero and fails unless it gets that exact string back:

```go
res, err := SolveWithWasm(context.Background(), clearancePowModule(), o09, 5, orgTs, nonce, twoXa)
if err != nil {
	t.Fatalf("SolveWithWasm: %v", err)
}
if res.Oo != expectOo {
	t.Fatalf("_oo mismatch:\n got  %q\n want %q", res.Oo, expectOo)
}
```

It passes. Given the same inputs, a Go process running the binary produces the same proof the browser did, down to the byte. That is the thing I spent September trying to achieve by reading C.

Rotation cannot be tested offline, so there is also [a live test](https://github.com/CuteTenshii/guns-solver/blob/caeaf60/pow_live_test.go#L15) behind `GUNS_LIVE=1` that fetches whatever module is current, solves the current challenge with it, and fails if the solve errors or returns an empty proof. That test is the one that catches a 1003.

## What it looks like now

Recording a view is a positional JSON array:

```text
[token, [v, e, t, n, s, c, proof], username, deviceNum, referrer]
```

The inner array is the `_gpp_ch` challenge echoed back with the proof from the binary appended, and `deviceNum` is 0 for desktop, 1 for mobile and 2 for tablet.

Looking back, September went into the part I did not need. The glue is the part guns.lol cannot hide, because every visitor's browser has to download and run it, and most of what guns.lol has changed since March has been aimed at it: hashed names, XORed strings, noise in the seal, rotation. So far, each of those changes has been answered in the Go code that reads the page and the glue, while the code that runs the binary has barely moved.

The code is at [github.com/CuteTenshii/guns-solver](https://github.com/CuteTenshii/guns-solver). And if you are shopping for a bio page, I make [Miwa.lol](https://miwa.lol).
