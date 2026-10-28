# Pawprint Park

A zoo builder and management game, inspired by titles like Planet Zoo.

Design your park, build habitats, care for animals, and keep your guests happy.

## Status

Early development — nothing playable yet.

## Branching model

This project uses [git-flow](https://nvie.com/posts/a-successful-git-branching-model/):

- `main` — released, production-ready code. Every merge is a tagged release.
- `develop` — integration branch for the next release (default branch).
- `feature/*` — branched from `develop`, merged back into `develop`.
- `release/*` — branched from `develop`, merged into `main` and `develop`.
- `hotfix/*` — branched from `main`, merged into `main` and `develop`.
