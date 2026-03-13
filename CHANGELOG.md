# Changelog

All notable changes to PR Zipper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026

### Added
- Initial release.
- Download all changed files from a GitHub PR as a ZIP with folder structure preserved.
- Optional GitHub PAT storage via extension popup.
- Supports Chrome, Edge, and Firefox with dedicated builds.
- Multiple fallback strategies for toolbar injection (12 strategies total).
- In-page token dialog for private repo authentication.
- Paginated file list fetching for PRs with 100+ changed files.
- Fallback download chain: Blob API → Contents API → Raw download.
- Batched file downloads (5 at a time) to avoid overwhelming the GitHub API.
- Progress percentage shown on the button during download.
- Dark mode support for the token modal.
- SPA-aware — survives GitHub's Turbo/Pjax navigation.
