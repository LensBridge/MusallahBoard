# MusallahBoard

Work-in-progress digital signage for mosques and Islamic centres. See also [the agent](https://github.com/LensBridge/agent) and [the backend](https://www.github.com/LensBridge/LensBridgeBackend)

MusallahBoard aims to make digital signage for mosques and Islamic centres accessible and easy to setup. Using a Raspberry Pi and a display, MusallahBoard can show prayer times, announcements, events, posters, and other content. The system is designed to be easy to use for both administrators and end-users, with a focus on reliability and security.

## Features

- Displays prayer times, powered by [Aladhan](https://aladhan.com/prayer-times-api)
- Displays announcements, events, and posters
- Supports multiple locations and screens, with centralized management via LensBridge

## Setup

> [!NOTE]
> Very much a work in progress for now. Expect setup to be rough until ~September

At a minimum, you will need a Raspberry Pi 4 or 5 (arm64) [or some other thinclient machine with relatively similar specs], a display, and a network connection. I am working on releasing a pre-built image for Raspberry Pis to immediately get started, but for now you will need to use the [setup.sh](./setup.sh) script to provision your Pi and install the MusallahBoard agent.

Once installed, the agent will run as a systemd service and automatically start on boot. Until the agent is enrolled in a LensBridge tenancy, it will display a "Waiting for Enrollment" screen. Once enrolled, it will display the configured content.

## Epilogue 

This README is vastly incomplete due to me focusing on development. Docs and setup instructions will lag behind actual development work for another ~month-ish or so. Rest assured, I do plan on writing high-quality docs from scratch (no AI :P) once the system is in a more stable state. For now, please feel free to open an issue if you have any questions or need help with setup. I will do my best to respond in a timely manner.