# Changelog

All notable changes to WhyNoRun are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release's section lands with its version-bump PR, so there is no Unreleased section.

A released rule ID never changes meaning. A release that changes any pinned
`value`, `possible` or `root` is at least a minor version, and lists each
affected rule under `### Affected rules` as `- RULE-ID: what changed`
([ADR 0002](docs/adr/0002-test-files-embed-the-core-scenario.md)).
