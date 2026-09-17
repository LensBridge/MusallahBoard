# MusallahBoard

Work-in-progress digital signage for mosques and Islamic centres. See also [the agent](https://github.com/LensBridge/agent) and [the backend](https://www.github.com/LensBridge/LensBridgeBackend)

## Overview

MusallahBoard aims to make digital signage for mosques and Islamic centres accessible, decentralized, easy to setup. Using a Raspberry Pi and a display, MusallahBoard can show prayer times, announcements, events, posters, and other content. The system is designed to be easy to use for both administrators and end-users, with a focus on reliability and security.

## Features

- Displays prayer times, powered by [Aladhan](https://aladhan.com/prayer-times-api)
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

## Epilogue

This README is vastly incomplete due to me focusing on development. Docs and setup instructions will lag behind actual development work for another ~month-ish or so. Rest assured, I do plan on writing high-quality docs from scratch (no AI :P) once the system is in a more stable state. For now, please feel free to open an issue if you have any questions or need help with setup. I will do my best to respond in a timely manner.