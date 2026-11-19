# MusallahBoard

Work-in-progress digital signage for mosques and Islamic centres. See also [the agent](https://github.com/LensBridge/agent) and [the backend](https://www.github.com/LensBridge/LensBridgeBackend)

## Overview

MusallahBoard aims to make digital signage for mosques and Islamic centres accessible, decentralized, easy to setup. Using a Raspberry Pi and a display, MusallahBoard can show prayer times, announcements, events, posters, and other content. The system is designed to be easy to use for both administrators and end-users, with a focus on reliability and security.

## Features

- Displays prayer times, computed on the board with [adhan](https://github.com/batoulapps/adhan-js) to [Aladhan](https://aladhan.com/calculation-methods)'s method definitions (no internet needed)
- Displays announcements, events, and posters
- Works with no network at all: a board is set up and updated with a USB stick. Boards with internet can also sync from LensBridge, but nothing depends on it
- Supports multiple locations and screens, with centralized management via LensBridge

## Setup

> [!NOTE]
> Very much a work in progress for now. Expect setup to be rough until ~September

At a minimum, you will need a Raspberry Pi 4 or newer. I've personally tested this on a Pi 4B and a Pi 5 - The Pi 5 is a _much_ smoother experience. A Pi 3 will work _in theory_, however the frontend may be too heavy to run smoothly on the modest hardware of a Pi 3. This is untested, though. If you try it, open an issue! I'd be curious to see how it goes.

Content (announcements, events, posters, board settings) is written in the LensBridge console ([backend](https://www.github.com/LensBridge/LensBridgeBackend) and [frontend](https://www.github.com/LensBridge/LensBridgeFrontend)). A board never talks to it unless you choose to connect it.

> [!NOTE]
> Eventually LensBridge will transition into Minbar, and will drop the crowd-sourced media features entirely. Minbar aims to be a more focused and polished experience for mosques and Islamic centres, with
> a focus on community and collaboration.

Prep the hardware: flash a copy of Raspberry Pi OS for your Pi onto an SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/), insert it, and boot. Once you reach the Pi OS Desktop (with the Pi on the network for this one step), open a terminal as a normal user with sudo access (not as root, the script refuses) and install the agent:

```bash
curl -fsSL https://raw.githubusercontent.com/LensBridge/agent/main/setup.sh | bash
```

This installs the agent and its dependencies and configures the window manager and the system. It asks for the content signing public key from your LensBridge console; for an unattended install, pass it as an environment variable (see the header of [`setup.sh`](https://github.com/LensBridge/agent/blob/main/setup.sh)). After the reboot the board shows a screen saying it is not set up yet.

To set the board up, export its USB stick from the console (add the board, then download its USB kit) and plug the stick into the board. The board reads the setup file, the board app, and the content from it, and the screen says when to remove the stick. To update it later, plug in a new stick.

## Running on a board

Every board runs this app from its own disk. The [device agent](https://github.com/LensBridge/agent) serves it at `http://127.0.0.1:8080/` together with the day's content, and the kiosk always loads that address, online or not. The network only changes how fresh the content is. The agent's `docs/architecture.md` is the contract for all of this.

The page is same-origin with the agent: it fetches today's payload from `/api/musallah/payload`, learns its device id from `/api/local/status`, and `/api/local/events` tells it when new content (re-fetch in place) or a new app release (reload) is installed. With no content installed yet it shows a "Waiting for content" screen saying whether it is downloading or needs a USB stick or a laptop on its ethernet port.

Prayer times never depend on content: the board computes them itself from its location. When the installed content has run out the agent marks the payload `expired`, and the board keeps the countdown, prayer list, clock and weather, drops posters, agenda, quotes, socials and ticker messages, and says "Announcements are out of date. Plug in an update stick." Plugging in a stick with newer content brings everything back without a restart.

Alt+Shift+F shows diagnostics: app and agent versions, installed content and sync status.

### Developing

`npm run dev` serves the app on port 3000 and proxies `/api` (including the `/api/local/events` stream) and `/media` to a device agent, `http://127.0.0.1:8080` by default. To develop against a real board's content, forward its agent port first:

```bash
ssh -L 8080:127.0.0.1:8080 <board>
npm run dev
```

Set `VITE_DEV_AGENT` to proxy to an agent somewhere else instead (`VITE_DEV_AGENT=http://127.0.0.1:18080 npm run dev`).

`npm test` runs the unit tests and `npm run typecheck` checks the API layer. The shapes the board reads from the agent (the payload and `/api/local/status`) are described by hand in `src/api/types.d.ts`; `src/api/__fixtures__/payload-expired.json` is an example payload for run-out.

### Releasing the board app

Boards only install app packages (`.mbu`) signed with the release key, so the key is created once and kept out of the repo:

```bash
# prints the seed (keep secret), the public key (give to the agent) and the key id
go install github.com/LensBridge/agent/cmd/mbpack@<commit>
mbpack keygen
```

Store the seed as the repository secret `MB_RELEASE_SIGNING_KEY`, and compile the public key into the agent (or add it with `musallahboard-agent trust add release <public key>`).

To release, bump `version` in `package.json` (`MAJOR.MINOR.PATCH`), commit, and push a matching tag (`v2.1.0`). The `Release` workflow tests, builds and signs `musallahboard-app-<version>.mbu`, and attaches it and `app-channel.json` to the GitHub release; online boards pick it up from the channel within a few hours, offline ones from a USB stick.

The package is built by the agent repository's `mbpack` (the workflow pins the agent commit in `MBPACK_REF`). Locally, with `mbpack` on your `PATH`, `MB_RELEASE_SIGNING_KEY=<seed> npm run package` writes both files to `release/`. `MB_RELEASE_BASE_URL` changes where `app-channel.json` says the package can be downloaded.

## Epilogue

This README is vastly incomplete due to me focusing on development. Docs and setup instructions will lag behind actual development work for another ~month-ish or so. Rest assured, I do plan on writing high-quality docs from scratch (no AI :P) once the system is in a more stable state. For now, please feel free to open an issue if you have any questions or need help with setup. I will do my best to respond in a timely manner.