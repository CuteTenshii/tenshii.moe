Uber Eats MCP is an [MCP](https://modelcontextprotocol.io) server for your Uber Eats customer account, written in Go. Add it to Claude Code, Codex, OpenCode or GitHub Copilot, and the agent can read your profile and orders, look up restaurants and menus, and fill carts for you. It never places, changes or cancels an order: checkout always happens on [ubereats.com](https://www.ubereats.com).

## How it works

Uber has no public API for customers, so the server calls the same internal JSON API (`/_p/api/...`) that ubereats.com uses in the browser, logged in with the session cookie you copy from your browser. It also sends that browser's User-Agent, because Cloudflare ties its clearance cookie to it. The API is undocumented and can change without notice, and automated use is outside Uber's terms.

## What it can do

- **Orders:** past orders with every fee, discount and tax line, the official receipt with payment methods and courier, and live tracking for orders on their way.
- **Your usual spots:** the restaurants you order from most with the items you usually get, and whether they're open right now.
- **Restaurants:** search near your current delivery address, the home feed (or only the stores running an offer), and full menus with every item's options and prices.
- **Carts:** create one, add or change items, or reorder a past order like the site's "order again" button. Every item and option is checked against the menu first, so an invalid cart is rejected with the list of problems before anything is sent. Each cart tool returns Uber's own subtotal, promotions included, and a checkout link.

MCP clients see the cart tools as not read-only, and removing items or discarding a cart as destructive, so they ask before running them.

## Using it

1. Build it with Go 1.25 or newer: `go build -o bin/ubereats-mcp ./cmd/ubereats-mcp`.
2. Log in at ubereats.com, open the Network tab in DevTools, and copy the `Cookie` and `User-Agent` headers of any `_p/api` request. Save the cookie to a file only you can read: it's a full login to your account.
3. Add the server to your client. For Claude Code, from the repository root:

```sh
claude mcp add --scope user ubereats \
  -e UBER_EATS_COOKIE_FILE="$HOME/.config/ubereats-mcp/cookie.txt" \
  -e UBER_EATS_USER_AGENT="<your browser's User-Agent>" \
  -- "$PWD/bin/ubereats-mcp"
```

The [README](https://git.tenshii.moe/Tenshii/ubereats-mcp) has the setup for the other clients and for Windows, the full list of tools, and the optional locale and time zone settings.
