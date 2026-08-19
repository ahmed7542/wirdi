# وِرد

*Automatically synced with your [Teable](https://app.teable.ai/base/bseYzsmAxanGNy08jE6/app/appTMKQPXBRXxuqXFz1) app.*

[![Built with Teable](https://img.shields.io/badge/Built%20with-Teable-blue)](https://teable.io)

## Overview

This repository stays in sync with **وِرد** on Teable: changes made in
the app builder are pushed here automatically, and commits pushed to this
repository sync back into the app.

## Continue building

Continue building your app on:

**[https://app.teable.ai/base/bseYzsmAxanGNy08jE6/app/appTMKQPXBRXxuqXFz1](https://app.teable.ai/base/bseYzsmAxanGNy08jE6/app/appTMKQPXBRXxuqXFz1)**

## Run locally

```bash
pnpm install
# create .env first (see below), then:
pnpm dev
```

Create a `.env` file in the project root: open the app in Teable and click
**Copy local env variables** in the GitHub panel, then paste the copied
content into `.env`. Never commit this file — it contains access
credentials.

## How it works

1. Edit in the Teable app builder — every version is pushed to this repository.
2. Push commits to the `main` branch — they become new app versions and appear in the preview.
3. If histories diverge your work is never overwritten — the app's changes land on the `teable-sync` branch; merge it into `main` to resolve.
