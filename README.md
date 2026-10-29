# Pawprint Park

A zoo builder and management game, inspired by titles like Planet Zoo.

Design your park, build habitats, care for animals, and keep your guests happy.

## Status

Early development. Nothing is playable yet. The art-direction mockup of the code-built animals is the current
milestone.

Everything is generated in code: the animals, the world, the light and (later) the sound. There are no asset
files. The game is free, has no ads and no accounts, and saves stay on your device.

## Getting started

Needs [Bun](https://bun.sh) 1.4.

```sh
bun install
bun run dev        # http://localhost:5427
bun test
```

- The game: <http://localhost:5427/>
- The animal art-direction mockup: <http://localhost:5427/mockups/body-plans/>

Design documents: [docs/PRD.md](docs/PRD.md) (what we're building), [docs/species.md](docs/species.md) (the
species catalogue), [docs/economy.md](docs/economy.md) (the economy numbers). Development notes: [CLAUDE.md](CLAUDE.md).

## Branching model

This project uses [git-flow](https://nvie.com/posts/a-successful-git-branching-model/):

- `main` — released, production-ready code. Every merge is a tagged release.
- `develop` — integration branch for the next release (default branch).
- `feature/*` — branched from `develop`, merged back into `develop`.
- `release/*` — branched from `develop`, merged into `main` and `develop`.
- `hotfix/*` — branched from `main`, merged into `main` and `develop`.
