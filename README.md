# MusallahBoard

Work-in-progress digital signage for mosques and Islamic centres. See also [the agent](https://github.com/LensBridge/agent) and [the backend](https://www.github.com/LensBridge/LensBridgeBackend)

## Overview

MusallahBoard aims to make digital signage for mosques and Islamic centres accessible, decentralized, easy to setup. Using a Raspberry Pi and a display, MusallahBoard can show prayer times, announcements, events, posters, and other content. The system is designed to be easy to use for both administrators and end-users, with a focus on reliability and security.

## Features

- Displays prayer times, computed on the board with [adhan](https://github.com/batoulapps/adhan-js) to [Aladhan](https://aladhan.com/calculation-methods)'s method definitions (no internet needed)
- Displays announcements, events, and posters
- Supports multiple locations and screens, with centralized management via LensBridge

## Setup

> [!NOTE]
> Very much a work in progress for now. Expect setup to be rough until ~September

At a minimum, you will need a Raspberry Pi 4 or newer. I've personally tested this on a Pi 4B and a Pi 5 - The Pi 5 is a _much_ smoother experience. A Pi 3 will work _in theory_, however the frontend may be too heavy to run smoothly on the modest hardware of a Pi 3. This is untested, though. If you try it, open an issue! I'd be curious to see how it goes.

You will also need to have a hosted instance of [the backend](https://www.github.com/LensBridge/LensBridgeBackend) running, and a hosted instance of [the LensBridge frontend](https://www.github.com/LensBridge/LensBridgeFrontend) running. The LensBridge frontend is used to manage the content and configuration of MusallahBoards. 

> [!NOTE]
> Eventually LensBridge will transition into Minbar, and will drop the crowd-sourced media features entirely. Minbar aims to be a more focused and polished experience for mosques and Islamic centres, with 
> a focus on community and collaboration.

Once you have everything set up and running, it's time to prep the hardware. Flash a copy of Raspberry Pi OS for your respective Pi onto an SD Card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/). Once the OS is flashed, insert the SD card into your Pi and boot it up.

Once you've reached the Pi OS Desktop, the fun begins! Install the agent using 

```bash
curl -fsSL https://raw.githubusercontent.com/LensBridge/agent/main/setup.sh | sudo bash
```

This will install the agent and all of its dependencies, setup the configuration for the window manager, and configure the system. Upon reboot, the board will display a "Waiting for Enrollment" screen until you enroll it in your Minbar tenancy.

## Running on a board

Every board runs this app from its own disk. The [device agent](https://github.com/LensBridge/agent) serves it at `http://127.0.0.1:8080/` together with the day's content, and the kiosk always loads that address, online or not. The network only changes how fresh the content is. The agent's `docs/architecture.md` is the contract for all of this.

The page is same-origin with the agent: it fetches today's payload from `/api/musallah/payload`, learns its device id from `/api/local/status`, and `/api/local/events` tells it when new content (re-fetch in place) or a new app release (reload) is installed. With no content installed yet it shows a "Waiting for content" screen saying whether it is downloading or needs a USB stick or a laptop on its ethernet port.

Alt+Shift+F shows diagnostics: app and agent versions, installed content and sync status.

### Developing

`npm run dev` serves the app on port 3000 and proxies `/api` (including the `/api/local/events` stream) and `/media` to a device agent, `http://127.0.0.1:8080` by default. To develop against a real board's content, forward its agent port first:

```bash
ssh -L 8080:127.0.0.1:8080 <board>
npm run dev
```

Set `VITE_DEV_AGENT` to proxy to an agent somewhere else instead (`VITE_DEV_AGENT=http://127.0.0.1:18080 npm run dev`).

`npm test` runs the unit tests and `npm run typecheck` checks the API layer. The payload types in `src/api/schema.d.ts` are generated from the backend's `openapi.yaml` (`MusallahBoardPayload`); regenerate them with `npm run api:generate`, with LensBridgeBackend checked out beside this repository or `OPENAPI_SPEC` pointing at the spec.

### Releasing the board app

Boards only install app packages (`.mbu`) signed with the release key, so the key is created once and kept out of the repo:

```bash
# in the agent repo
mbpack keygen
# or with Node alone: prints the seed (keep secret) and the public key (give to the agent)
node -e "const c=require('crypto');const s=c.randomBytes(32);const k=c.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),s]),format:'der',type:'pkcs8'});const p=c.createPublicKey(k).export({format:'der',type:'spki'}).subarray(-32);console.log('seed:  ',s.toString('base64'));console.log('public:',p.toString('base64'));console.log('keyId: ',c.createHash('sha256').update(p).digest().subarray(0,8).toString('hex'))"
```

Store the seed as the repository secret `MB_RELEASE_SIGNING_KEY`, and compile the public key into the agent (or add it with `musallahboard-agent trust add release <public key>`).

To release, bump `version` in `package.json` (`MAJOR.MINOR.PATCH`), commit, and push a matching tag (`v2.1.0`). The `Release` workflow tests, builds and signs `musallahboard-app-<version>.mbu`, and attaches it and `app-channel.json` to the GitHub release; online boards pick it up from the channel within a few hours, offline ones from a USB stick or `mbpush`.

Locally, `MB_RELEASE_SIGNING_KEY=<seed> npm run package` writes both files to `release/`. `MB_RELEASE_BASE_URL` changes where `app-channel.json` says the package can be downloaded.

## Epilogue

This README is vastly incomplete due to me focusing on development. Docs and setup instructions will lag behind actual development work for another ~month-ish or so. Rest assured, I do plan on writing high-quality docs from scratch (no AI :P) once the system is in a more stable state. For now, please feel free to open an issue if you have any questions or need help with setup. I will do my best to respond in a timely manner.